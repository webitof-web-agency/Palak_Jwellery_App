import mongoose from 'mongoose'
import { Supplier } from '../models/Supplier.js'
import { detectSupplier, parseQR } from '../services/qrParser.service.js'
import { normalize } from '../services/qrNormalization.service.js'
import { validate } from '../services/qrValidation.service.js'
import { valuate } from '../services/qrValuation.service.js'
import { loadSettlementSettings } from '../services/settlementSettings.service.js'
import {
  getSupplierBusinessSettings,
  normalizeBusinessSettings,
} from '../services/supplierBusinessSettings.service.js'

const sendSuccess = (res, data, message) => {
  const payload = { success: true, data }
  if (message) {
    payload.message = message
  }
  return res.status(200).json(payload)
}

const sendError = (res, status, error, code, details = undefined) => {
  const payload = { success: false, error, code }
  if (details !== undefined) {
    payload.details = details
  }
  return res.status(status).json(payload)
}

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    if (normalized === '1') return true
    if (normalized === '0') return false
  }

  if (value === null || value === undefined) {
    return fallback
  }

  return Boolean(value)
}

const normalizeCategories = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => normalizeText(item))
      .filter(Boolean)
  }

  return []
}

const normalizeNonNegativeNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

const normalizePercentage = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return fallback
  }

  return parsed
}

const normalizeFieldMapValue = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return fallback

    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed)
    }

    const sumMatch = trimmed.match(/^sum\s*:\s*(.+)$/i)
    if (sumMatch) {
      const sumIndices = sumMatch[1]
        .split('+')
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((item) => Number.isInteger(item) && item >= 0)

      if (sumIndices.length > 0) {
        return { sumIndices }
      }
    }

    const prefixMatch = trimmed.match(/^idx\s*:\s*(\d+)\s*(?:\u00b7|\||\.)\s*prefix\s*:\s*(.+)$/i)
    if (prefixMatch) {
      return {
        index: Number.parseInt(prefixMatch[1], 10),
        stripPrefix: prefixMatch[2].trim(),
      }
    }

    const suffixMatch = trimmed.match(/^idx\s*:\s*(\d+)\s*(?:\u00b7|\||\.)\s*suffix\s*:\s*(.+)$/i)
    if (suffixMatch) {
      return {
        index: Number.parseInt(suffixMatch[1], 10),
        stripSuffix: suffixMatch[2].trim(),
      }
    }

    const indexMatch = trimmed.match(/^idx\s*:\s*(\d+)$/i)
    if (indexMatch) {
      return Number.parseInt(indexMatch[1], 10)
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  return fallback
}

const normalizeFieldMap = (fieldMap = {}, fallback = {}) => ({
  supplierCode: normalizeFieldMapValue(fieldMap.supplierCode, fallback.supplierCode ?? 0),
  category: normalizeFieldMapValue(fieldMap.category, fallback.category ?? 1),
  grossWeight: normalizeFieldMapValue(fieldMap.grossWeight, fallback.grossWeight ?? 2),
  stoneWeight: normalizeFieldMapValue(fieldMap.stoneWeight, fallback.stoneWeight ?? 3),
  netWeight: normalizeFieldMapValue(fieldMap.netWeight, fallback.netWeight ?? 4),
})

const normalizeQrMapping = (input = {}, existing = {}, supplierName = '', supplierCode = '') => {
  const strategyRaw = normalizeText(input.strategy ?? existing.strategy ?? 'delimiter').toLowerCase()
  const strategy = strategyRaw === 'labeled' ? 'key_value' : strategyRaw
  const normalizedName = normalizeText(supplierName).toLowerCase()
  const normalizedCode = normalizeText(supplierCode).toLowerCase()
  const isAdinath = normalizedName === 'adinath' || normalizedCode === 'adinath'

  if (!['delimiter', 'key_value', 'venzora'].includes(strategy)) {
    return { error: 'Unsupported QR strategy' }
  }

  if (isAdinath) {
    return {
      strategy: 'delimiter',
      delimiter: '/',
      fieldMap: {
        grossWeight: normalizeFieldMapValue(input.fieldMap?.grossWeight, existing.fieldMap?.grossWeight ?? 0),
        stoneWeight: normalizeFieldMapValue(input.fieldMap?.stoneWeight, existing.fieldMap?.stoneWeight ?? 1),
        netWeight: normalizeFieldMapValue(input.fieldMap?.netWeight, existing.fieldMap?.netWeight ?? 6),
        category: normalizeFieldMapValue(input.fieldMap?.category, existing.fieldMap?.category ?? 7),
      },
    }
  }

  if (strategy === 'key_value') {
    return { strategy: 'key_value' }
  }

  if (strategy === 'venzora') {
    return { strategy: 'venzora' }
  }

  const delimiter = normalizeText(input.delimiter ?? existing.delimiter ?? '|') || '|'
  const fieldMap = normalizeFieldMap(input.fieldMap || {}, existing.fieldMap || {})

  return {
    strategy: 'delimiter',
    delimiter,
    fieldMap,
  }
}

const normalizeDetectionPattern = (input = {}, existing = null) => {
  if (input === null) {
    return null
  }

  const source = input && typeof input === 'object' ? input : {}
  const type = source.type ?? existing?.type ?? null
  const pattern = normalizeText(source.pattern ?? existing?.pattern ?? '')

  if (!type && !pattern) {
    return null
  }

  if (!['regex', 'contains', 'prefix'].includes(type)) {
    return { error: 'Invalid detectionPattern.type' }
  }

  if (!pattern) {
    return { error: 'detectionPattern.pattern is required when detectionPattern is provided' }
  }

  return { type, pattern }
}

const normalizePatternVariant = (input = {}, existing = null, index = 0) => {
  if (input === null || input === undefined) {
    return null
  }

  const source = input && typeof input === 'object' ? input : {}
  const name = normalizeText(source.name ?? existing?.name ?? `variant_${index + 1}`)
  const strategyRaw = normalizeText(source.strategy ?? source.parsingStrategy ?? existing?.strategy ?? 'delimiter').toLowerCase()
  const strategy = strategyRaw === 'labeled' ? 'key_value' : strategyRaw
  const detectionInput = source.detectionPattern !== undefined
    ? source.detectionPattern
    : (source.match !== undefined
      ? source.match
      : (source.matcher !== undefined
        ? source.matcher
        : (source.regex !== undefined
          ? { type: 'regex', pattern: source.regex }
          : (source.pattern !== undefined
            ? { type: 'regex', pattern: source.pattern }
            : null))))
  const detectionPattern = normalizeDetectionPattern(detectionInput, existing?.detectionPattern || null)

  if (!name) {
    return { error: 'patternVariants[].name is required' }
  }

  if (!['delimiter', 'key_value', 'venzora'].includes(strategy)) {
    return { error: 'patternVariants[].strategy is invalid' }
  }

  if (detectionPattern && detectionPattern.error) {
    return { error: detectionPattern.error }
  }

  const priorityValue = source.priority ?? existing?.priority ?? (index + 100)
  const priority = Number.isInteger(priorityValue) ? priorityValue : Number.parseInt(String(priorityValue), 10)

  return {
    name,
    strategy,
    delimiter: normalizeText(source.delimiter ?? existing?.delimiter ?? '|') || '|',
    priority: Number.isInteger(priority) ? priority : index + 100,
    detectionPattern,
    fieldMap: source.fieldMap ?? existing?.fieldMap ?? {},
    active: normalizeBoolean(source.active ?? source.isActive ?? existing?.active ?? true, true),
  }
}

const normalizePatternVariants = (value, existing = []) => {
  if (value === null) {
    return null
  }

  const source = Array.isArray(value) ? value : []
  return source
    .map((item, index) => normalizePatternVariant(item, existing?.[index] || null, index))
    .filter(Boolean)
}

const normalizeFallbackRules = (value, existing = null) => {
  if (value === null) {
    return null
  }

  const source = value && typeof value === 'object' ? value : {}
  return {
    allowPartial: normalizeBoolean(source.allowPartial ?? existing?.allowPartial ?? true, true),
    minFieldsRequired: Array.isArray(source.minFieldsRequired)
      ? source.minFieldsRequired.map((item) => normalizeText(item)).filter(Boolean)
      : (Array.isArray(existing?.minFieldsRequired) ? existing.minFieldsRequired : ['design_code']),
    defaultStatus: normalizeText(source.defaultStatus ?? existing?.defaultStatus ?? 'needs_review') || 'needs_review',
  }
}

const normalizeBusinessCategories = (items, existing = []) => {
  if (!Array.isArray(items)) {
    return existing
  }

  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item : { name: item }
    const existingItem = existing?.[index] || null
    const name = normalizeText(source.name ?? existingItem?.name)
    const code = normalizeText(source.code ?? existingItem?.code ?? name.toUpperCase().replace(/\s+/g, '_'))
    const colorLabel = normalizeText(source.colorLabel ?? existingItem?.colorLabel ?? '')
    let wastagePercent = existingItem?.wastagePercent ?? null

    if (source.wastagePercent !== undefined) {
      if (source.wastagePercent === null || source.wastagePercent === '') {
        wastagePercent = null
      } else {
        const parsedWastage = Number(source.wastagePercent)
        if (!Number.isFinite(parsedWastage) || parsedWastage < 0) {
          return { error: 'businessSettings.categories[].wastagePercent must be non-negative' }
        }
        wastagePercent = parsedWastage
      }
    }

    if (!name) {
      return { error: 'businessSettings.categories[].name is required' }
    }

    return {
      name,
      code,
      colorLabel,
      wastagePercent,
      isActive: normalizeBoolean(source.isActive ?? existingItem?.isActive ?? true, true),
      sortOrder: Number.isFinite(Number(source.sortOrder ?? existingItem?.sortOrder))
        ? Number(source.sortOrder ?? existingItem?.sortOrder)
        : (index + 100),
    }
  })
}

const normalizePurityOverrides = (items, existing = []) => {
  if (!Array.isArray(items)) {
    return existing
  }

  return items.map((item, index) => {
    const source = item && typeof item === 'object' ? item : {}
    const existingItem = existing?.[index] || null
    const karat = normalizeText(source.karat ?? existingItem?.karat).replace(/\s+/g, '').toUpperCase()
    let purityPercent = existingItem?.purityPercent ?? null

    if (source.purityPercent !== undefined) {
      if (source.purityPercent === null || source.purityPercent === '') {
        purityPercent = null
      } else {
        const parsedPurity = Number(source.purityPercent)
        if (!Number.isFinite(parsedPurity) || parsedPurity < 0 || parsedPurity > 100) {
          return { error: 'businessSettings.purityOverrides[].purityPercent must be between 0 and 100' }
        }
        purityPercent = parsedPurity
      }
    }

    if (!karat) {
      return { error: 'businessSettings.purityOverrides[].karat is required' }
    }

    return {
      karat,
      purityPercent,
      isActive: normalizeBoolean(source.isActive ?? existingItem?.isActive ?? true, true),
    }
  })
}

const normalizeBusinessSettingsPayload = (value, existing = null, supplierContext = {}) => {
  const hasIncoming = value !== undefined
  const source = value && typeof value === 'object' ? value : {}
  const existingSettings = existing && typeof existing === 'object' ? existing : null
  const normalizedSource = normalizeBusinessSettings(source, supplierContext)

  const categories = hasIncoming
    ? normalizeBusinessCategories(source.categories, existingSettings?.categories || [])
    : (existingSettings?.categories || normalizedSource.categories || [])
  if (Array.isArray(categories) && categories.some((item) => item?.error)) {
    return { error: categories.find((item) => item?.error)?.error }
  }

  const purityOverrides = hasIncoming
    ? normalizePurityOverrides(source.purityOverrides, existingSettings?.purityOverrides || [])
    : (existingSettings?.purityOverrides || normalizedSource.purityOverrides || [])
  if (Array.isArray(purityOverrides) && purityOverrides.some((item) => item?.error)) {
    return { error: purityOverrides.find((item) => item?.error)?.error }
  }

  const defaultWastagePercent = source.defaultWastagePercent === undefined
    ? (existingSettings?.defaultWastagePercent ?? normalizedSource.defaultWastagePercent ?? null)
    : (source.defaultWastagePercent === null || source.defaultWastagePercent === ''
      ? null
      : (() => {
          const parsed = Number(source.defaultWastagePercent)
          return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : NaN
        })())
  if (Number.isNaN(defaultWastagePercent)) {
    return { error: 'businessSettings.defaultWastagePercent must be between 0 and 100' }
  }
  if (defaultWastagePercent !== null && (defaultWastagePercent < 0 || defaultWastagePercent > 100)) {
    return { error: 'businessSettings.defaultWastagePercent must be between 0 and 100' }
  }

  const defaultStoneRate = source.defaultStoneRate === undefined
    ? (existingSettings?.defaultStoneRate ?? normalizedSource.defaultStoneRate ?? null)
    : (source.defaultStoneRate === null || source.defaultStoneRate === ''
      ? null
      : (() => {
          const parsed = Number(source.defaultStoneRate)
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN
        })())
  if (Number.isNaN(defaultStoneRate)) {
    return { error: 'businessSettings.defaultStoneRate must be non-negative' }
  }
  if (defaultStoneRate !== null && defaultStoneRate < 0) {
    return { error: 'businessSettings.defaultStoneRate must be non-negative' }
  }

  const netWeightRule = normalizeText(source.netWeightRule ?? existingSettings?.netWeightRule ?? normalizedSource.netWeightRule)
  const stoneWeightRule = normalizeText(source.stoneWeightRule ?? existingSettings?.stoneWeightRule ?? normalizedSource.stoneWeightRule)

  if (source.netWeightRule !== undefined && !['computed', 'qr_trusted_with_validation', 'manual'].includes(netWeightRule)) {
    return { error: 'businessSettings.netWeightRule is invalid' }
  }

  if (source.stoneWeightRule !== undefined && !['single', 'component_sum', 'manual'].includes(stoneWeightRule)) {
    return { error: 'businessSettings.stoneWeightRule is invalid' }
  }

  const otherWeightRuleSource = source.otherWeightRule && typeof source.otherWeightRule === 'object'
    ? source.otherWeightRule
    : {}
  const existingOtherWeightRule = existingSettings?.otherWeightRule || normalizedSource.otherWeightRule || {}
  const deductOtherWeight = source.otherWeightRule !== undefined
    ? normalizeBoolean(otherWeightRuleSource.deductOtherWeight, existingOtherWeightRule.deductOtherWeight ?? false)
    : (existingOtherWeightRule.deductOtherWeight ?? false)
  const defaultOtherWeight = source.otherWeightRule !== undefined
    ? (otherWeightRuleSource.defaultOtherWeight === null || otherWeightRuleSource.defaultOtherWeight === ''
      ? 0
      : (() => {
          const parsed = Number(otherWeightRuleSource.defaultOtherWeight)
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN
        })())
    : (existingOtherWeightRule.defaultOtherWeight ?? 0)
  if (Number.isNaN(defaultOtherWeight)) {
    return { error: 'businessSettings.otherWeightRule.defaultOtherWeight must be non-negative' }
  }

  if (defaultOtherWeight !== null && defaultOtherWeight < 0) {
    return { error: 'businessSettings.otherWeightRule.defaultOtherWeight must be non-negative' }
  }

  const qrNetTolerance = source.qrNetTolerance === undefined
    ? (existingSettings?.qrNetTolerance ?? normalizedSource.qrNetTolerance ?? 0.005)
    : (source.qrNetTolerance === null || source.qrNetTolerance === ''
      ? 0.005
      : (() => {
          const parsed = Number(source.qrNetTolerance)
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN
        })())
  if (Number.isNaN(qrNetTolerance)) {
    return { error: 'businessSettings.qrNetTolerance must be non-negative' }
  }
  if (qrNetTolerance !== null && qrNetTolerance < 0) {
    return { error: 'businessSettings.qrNetTolerance must be non-negative' }
  }

  return {
    categories,
    purityOverrides,
    defaultWastagePercent,
    defaultStoneRate,
    netWeightRule: ['computed', 'qr_trusted_with_validation', 'manual'].includes(netWeightRule) ? netWeightRule : 'computed',
    stoneWeightRule: ['single', 'component_sum', 'manual'].includes(stoneWeightRule) ? stoneWeightRule : 'single',
    otherWeightRule: {
      deductOtherWeight,
      defaultOtherWeight: defaultOtherWeight ?? 0,
    },
    qrNetTolerance: qrNetTolerance ?? 0.005,
  }
}

const normalizeQrProfile = (value, existing = null) => {
  if (value === null) {
    return null
  }

  if (value === undefined) {
    return existing || null
  }

  const source = value && typeof value === 'object' ? value : {}
  const profileKey = normalizeText(source.profileKey ?? existing?.profileKey)
  const version = normalizeText(source.version ?? existing?.version)
  const description = normalizeText(source.description ?? existing?.description)

  if (!profileKey && !version && !description) {
    return existing || null
  }

  return {
    profileKey,
    version,
    description,
  }
}

const buildSupplierPayload = (body, existingSupplier = null) => {
  const hasQrMappingFallback = Boolean(
    body?.qrMapping &&
    Object.prototype.hasOwnProperty.call(body.qrMapping, 'fallback'),
  )

  const mergedQrMapping = normalizeQrMapping(
    body.qrMapping ?? {},
    existingSupplier?.qrMapping || {},
    body.name ?? existingSupplier?.name ?? '',
    body.code ?? existingSupplier?.code ?? ''
  )
  if (mergedQrMapping.error) {
    return { error: mergedQrMapping.error }
  }

  const mergedDetectionPattern = body.detectionPattern !== undefined
    ? normalizeDetectionPattern(body.detectionPattern)
    : (existingSupplier?.detectionPattern || null)

  if (mergedDetectionPattern && mergedDetectionPattern.error) {
    return { error: mergedDetectionPattern.error }
  }

  const mergedPatternVariants = body.qrMapping?.patternVariants !== undefined
    ? normalizePatternVariants(body.qrMapping.patternVariants, existingSupplier?.qrMapping?.patternVariants || [])
    : (existingSupplier?.qrMapping?.patternVariants || [])

  if (mergedPatternVariants && mergedPatternVariants.some((variant) => variant?.error)) {
    return { error: mergedPatternVariants.find((variant) => variant?.error)?.error || 'Invalid pattern variant' }
  }

  const existingFallback = existingSupplier?.qrMapping?.fallback || null
  const mergedFallback = hasQrMappingFallback
    ? normalizeFallbackRules(body.qrMapping.fallback, existingFallback)
    : (existingSupplier?.qrMapping?.fallback || null)
  const fallbackPayload = mergedFallback && typeof mergedFallback === 'object'
    ? {
        allowPartial: normalizeBoolean(mergedFallback.allowPartial ?? true, true),
        minFieldsRequired: Array.isArray(mergedFallback.minFieldsRequired)
          ? mergedFallback.minFieldsRequired.map((item) => normalizeText(item)).filter(Boolean)
          : ['design_code'],
        defaultStatus: ['approved', 'needs_review'].includes(mergedFallback.defaultStatus)
          ? mergedFallback.defaultStatus
          : 'needs_review',
      }
    : {
        allowPartial: true,
        minFieldsRequired: ['design_code'],
        defaultStatus: 'needs_review',
      }

  const mergedBusinessSettings = normalizeBusinessSettingsPayload(
    body.businessSettings,
    existingSupplier?.businessSettings || null,
    {
      name: body.name ?? existingSupplier?.name ?? '',
      code: body.code ?? existingSupplier?.code ?? '',
    }
  )
  if (mergedBusinessSettings.error) {
    return { error: mergedBusinessSettings.error }
  }

  const mergedQrProfile = normalizeQrProfile(body.qrProfile, existingSupplier?.qrProfile || null)

  return {
    name: normalizeText(body.name ?? existingSupplier?.name),
    code: normalizeText(body.code ?? existingSupplier?.code),
    gst: normalizeText(body.gst ?? existingSupplier?.gst ?? ''),
    address: normalizeText(body.address ?? existingSupplier?.address ?? ''),
    paymentMode: normalizeText(body.paymentMode ?? existingSupplier?.paymentMode ?? 'other') || 'other',
    qrMapping: {
      ...mergedQrMapping,
      patternVariants: mergedPatternVariants || [],
      fallback: fallbackPayload,
    },
    detectionPattern: mergedDetectionPattern,
    categories: body.categories !== undefined
      ? normalizeCategories(body.categories)
      : (existingSupplier?.categories || []),
    businessSettings: mergedBusinessSettings || existingSupplier?.businessSettings || null,
    qrProfile: mergedQrProfile,
    isActive: body.isActive !== undefined
      ? normalizeBoolean(body.isActive, existingSupplier?.isActive ?? true)
      : (existingSupplier?.isActive ?? true),
  }
}

const toPublicSupplier = (supplier) => {
  if (!supplier) {
    return null
  }

  const plain = typeof supplier.toObject === 'function' ? supplier.toObject() : { ...supplier }
  delete plain.__v
  plain.businessSettings = getSupplierBusinessSettings(plain)
  return plain
}

const enrichParseResultWithSupplier = (parseResult, supplier) => {
  if (!parseResult || !supplier?.code) {
    return parseResult
  }

  const fields = parseResult.fields ? { ...parseResult.fields } : null
  if (!fields?.supplierCode) {
    return parseResult
  }

  fields.supplierCode = {
    value: supplier.code,
    parsed: true,
  }

  return {
    ...parseResult,
    fields,
  }
}

const getSupplierId = (req) => req.params.id || req.params.supplierId

const normalizeMongooseValidationDetails = (error) => {
  if (!error || typeof error !== 'object') {
    return null
  }

  if (error.name === 'ValidationError' && error.errors && typeof error.errors === 'object') {
    const details = Object.entries(error.errors)
      .map(([path, validationError]) => ({
        path,
        message: validationError?.message || 'Invalid value',
        kind: validationError?.kind || 'validation',
      }))
      .filter((item) => item.path)

    return details.length > 0 ? details : null
  }

  if (error.name === 'CastError' && error.path) {
    return [{
      path: error.path,
      message: error.message || 'Invalid value',
      kind: 'cast',
    }]
  }

  return null
}

const logSupplierSaveError = (operation, error, context = {}) => {
  const details = normalizeMongooseValidationDetails(error)
  console.error(`[suppliers] ${operation} failed`, {
    ...context,
    name: error?.name,
    message: error?.message,
    code: error?.code,
    details,
    stack: error?.stack,
  })
}

export const listSuppliers = async (req, res) => {
  try {
    const query = req.user?.role === 'admin' ? {} : { isActive: true }
    const suppliers = await Supplier.find(query).sort({ name: 1 }).lean()
    return sendSuccess(res, suppliers.map((supplier) => toPublicSupplier(supplier)))
  } catch (error) {
    return sendError(res, 500, 'Failed to load suppliers', 'SERVER_ERROR')
  }
}

export const createSupplier = async (req, res) => {
  try {
    const payload = buildSupplierPayload(req.body)
    if (payload.error) {
      return sendError(res, 400, payload.error, 'VALIDATION_ERROR')
    }

    if (!payload.name || !payload.code) {
      return sendError(res, 400, 'Name and code are required', 'MISSING_FIELDS')
    }

    if (!['cash', 'cheque', 'credit', 'bank_transfer', 'other'].includes(payload.paymentMode)) {
      return sendError(res, 400, 'Invalid payment mode', 'INVALID_PAYMENT_MODE')
    }

    const existing = await Supplier.findOne({ code: payload.code }).lean()
    if (existing) {
      return sendError(res, 409, 'Supplier code already exists', 'DUPLICATE_SUPPLIER_CODE')
    }

    const supplier = await Supplier.create(payload)
    return res.status(201).json({ success: true, data: toPublicSupplier(supplier) })
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'Supplier code already exists', 'DUPLICATE_SUPPLIER_CODE')
    }

    const details = normalizeMongooseValidationDetails(error)
    logSupplierSaveError('create supplier', error, {
      supplierCode: req.body?.code,
      supplierName: req.body?.name,
    })

    if (details) {
      const firstMessage = details[0]?.message || 'Invalid supplier payload'
      return sendError(res, 400, firstMessage, 'VALIDATION_ERROR', details)
    }

    return sendError(res, 500, 'Failed to create supplier', 'SERVER_ERROR')
  }
}

export const updateSupplier = async (req, res) => {
  const supplierId = getSupplierId(req)

  try {
    if (!mongoose.isValidObjectId(supplierId)) {
      return sendError(res, 400, 'Invalid supplier id', 'INVALID_ID')
    }

    const existingSupplier = await Supplier.findById(supplierId)
    if (!existingSupplier) {
      return sendError(res, 404, 'Supplier not found', 'SUPPLIER_NOT_FOUND')
    }

    const payload = buildSupplierPayload(req.body, existingSupplier)
    if (payload.error) {
      return sendError(res, 400, payload.error, 'VALIDATION_ERROR')
    }

    if (!payload.name || !payload.code) {
      return sendError(res, 400, 'Name and code are required', 'MISSING_FIELDS')
    }

    if (!['cash', 'cheque', 'credit', 'bank_transfer', 'other'].includes(payload.paymentMode)) {
      return sendError(res, 400, 'Invalid payment mode', 'INVALID_PAYMENT_MODE')
    }

    const duplicate = await Supplier.findOne({ code: payload.code, _id: { $ne: supplierId } }).lean()
    if (duplicate) {
      return sendError(res, 409, 'Supplier code already exists', 'DUPLICATE_SUPPLIER_CODE')
    }

    existingSupplier.name = payload.name
    existingSupplier.code = payload.code
    existingSupplier.gst = payload.gst
    existingSupplier.address = payload.address
    existingSupplier.paymentMode = payload.paymentMode
    existingSupplier.qrMapping = payload.qrMapping
    if (payload.detectionPattern !== undefined) {
      existingSupplier.detectionPattern = payload.detectionPattern
    }
    existingSupplier.categories = payload.categories
    existingSupplier.businessSettings = payload.businessSettings
    existingSupplier.qrProfile = payload.qrProfile
    existingSupplier.isActive = payload.isActive

    await existingSupplier.save()
    return sendSuccess(res, toPublicSupplier(existingSupplier))
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'Supplier code already exists', 'DUPLICATE_SUPPLIER_CODE')
    }

    const details = normalizeMongooseValidationDetails(error)
    logSupplierSaveError('update supplier', error, {
      supplierId,
      supplierCode: req.body?.code,
      supplierName: req.body?.name,
    })

    if (details) {
      const firstMessage = details[0]?.message || 'Invalid supplier payload'
      return sendError(res, 400, firstMessage, 'VALIDATION_ERROR', details)
    }

    return sendError(res, 500, 'Failed to update supplier', 'SERVER_ERROR')
  }
}

export const deleteSupplier = async (req, res) => {
  try {
    const supplierId = getSupplierId(req)
    if (!mongoose.isValidObjectId(supplierId)) {
      return sendError(res, 400, 'Invalid supplier id', 'INVALID_ID')
    }

    const deleted = await Supplier.findByIdAndDelete(supplierId)
    if (!deleted) {
      return sendError(res, 404, 'Supplier not found', 'SUPPLIER_NOT_FOUND')
    }

    return sendSuccess(res, null, 'Supplier deleted')
  } catch (error) {
    return sendError(res, 500, 'Failed to delete supplier', 'SERVER_ERROR')
  }
}

export const parseSupplierQr = async (req, res) => {
  try {
    const settlementSettings = await loadSettlementSettings()
    const raw = req.body.raw ?? req.body.rawQr ?? req.body.rawQR ?? req.body.qrRaw ?? req.body.qr ?? req.body.string
    const rawString = typeof raw === 'string' ? raw : ''

    if (!rawString.trim()) {
      return sendError(res, 400, 'Raw QR string is required', 'MISSING_FIELDS')
    }

    const supplierId = req.body.supplierId ?? req.body.id ?? null

    if (supplierId) {
      if (!mongoose.isValidObjectId(supplierId)) {
        return sendError(res, 400, 'Invalid supplier id', 'INVALID_ID')
      }

      const supplier = await Supplier.findById(supplierId).lean()
      if (!supplier) {
        return sendError(res, 404, 'Supplier not found', 'SUPPLIER_NOT_FOUND')
      }

      const parseResult = parseQR(rawString, supplier)
      const normalizedResult = normalize(parseResult, supplier)
      const validatedResult = validate(normalizedResult, settlementSettings)
      const valuation = valuate(validatedResult, settlementSettings)
      return sendSuccess(res, {
        supplier: toPublicSupplier(supplier),
        matchType: 'manual',
        parseResult,
        normalizedResult,
        validatedResult,
        valuation,
      })
    }

    const suppliers = await Supplier.find().lean()
    const detection = detectSupplier(rawString, suppliers)
    const supplier = detection?.supplier || null
    const parseResult = parseQR(rawString, supplier)
    const normalizedResult = normalize(parseResult, supplier)
    const validatedResult = validate(normalizedResult, settlementSettings)
    const valuation = valuate(validatedResult, settlementSettings)

    return sendSuccess(res, {
      supplier: toPublicSupplier(supplier),
      matchType: detection?.matchType || null,
      parseResult,
      normalizedResult,
      validatedResult,
      valuation,
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to parse QR', 'SERVER_ERROR')
  }
}

