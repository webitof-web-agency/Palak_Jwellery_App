import mongoose from 'mongoose'
import { Supplier } from '../models/Supplier.js'
import { detectSupplier, normalizeParsedQR, parseQR } from '../services/qrParser.service.js'

const sendSuccess = (res, data, message) => {
  const payload = { success: true, data }
  if (message) {
    payload.message = message
  }
  return res.status(200).json(payload)
}

const sendError = (res, status, error, code) => {
  return res.status(status).json({ success: false, error, code })
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

const buildSupplierPayload = (body, existingSupplier = null) => {
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

  return {
    name: normalizeText(body.name ?? existingSupplier?.name),
    code: normalizeText(body.code ?? existingSupplier?.code),
    gst: normalizeText(body.gst ?? existingSupplier?.gst ?? ''),
    address: normalizeText(body.address ?? existingSupplier?.address ?? ''),
    paymentMode: normalizeText(body.paymentMode ?? existingSupplier?.paymentMode ?? 'other') || 'other',
    qrMapping: mergedQrMapping,
    detectionPattern: mergedDetectionPattern,
    categories: body.categories !== undefined
      ? normalizeCategories(body.categories)
      : (existingSupplier?.categories || []),
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

export const listSuppliers = async (req, res) => {
  try {
    const query = req.user?.role === 'admin' ? {} : { isActive: true }
    const suppliers = await Supplier.find(query).sort({ name: 1 }).lean()
    return sendSuccess(res, suppliers.map((supplier) => {
      delete supplier.__v
      return supplier
    }))
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

    return sendError(res, 500, 'Failed to create supplier', 'SERVER_ERROR')
  }
}

export const updateSupplier = async (req, res) => {
  try {
    const supplierId = getSupplierId(req)
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
    existingSupplier.isActive = payload.isActive

    await existingSupplier.save()
    return sendSuccess(res, toPublicSupplier(existingSupplier))
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'Supplier code already exists', 'DUPLICATE_SUPPLIER_CODE')
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

      const parseResult = parseQR(rawString, supplier.qrMapping)
      const normalizedResult = normalizeParsedQR(parseResult, supplier)
      return sendSuccess(res, {
        supplier: toPublicSupplier(supplier),
        matchType: 'manual',
        parseResult: normalizedResult,
      })
    }

    const suppliers = await Supplier.find().lean()
    const detection = detectSupplier(rawString, suppliers)
    const supplier = detection?.supplier || null
    const parseResult = parseQR(rawString, supplier?.qrMapping)
    const normalizedResult = normalizeParsedQR(parseResult, supplier)

    return sendSuccess(res, {
      supplier: toPublicSupplier(supplier),
      matchType: detection?.matchType || null,
      parseResult: normalizedResult,
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to parse QR', 'SERVER_ERROR')
  }
}

