import mongoose from 'mongoose'
import { CaptureSession } from '../models/CaptureSession.js'
import { Customer } from '../models/Customer.js'
import { Supplier } from '../models/Supplier.js'
import { User } from '../models/User.js'
import { buildSessionRef } from './captureSessionLifecycle.service.js'
import { toNumber, toText } from './qrParser.shared.js'

class MobileCaptureSessionSyncError extends Error {
  constructor(message, code = 'MOBILE_CAPTURE_SESSION_SYNC_ERROR', statusCode = 400, details = null) {
    super(message)
    this.name = 'MobileCaptureSessionSyncError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

const normalizeText = (value) => toText(value) || ''

const resolveIdValue = (value) => {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString()
  }
  if (value?._bsontype === 'ObjectId' || value?._bsontype === 'ObjectID') {
    return value.toString()
  }
  if (typeof value === 'object') {
    if (value._id) return resolveIdValue(value._id)
    if (value.id) return resolveIdValue(value.id)
  }
  return normalizeText(value) || null
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normalizePhone = (value) => normalizeText(value).replace(/\D/g, '')
const normalizeEmail = (value) => {
  const email = normalizeText(value).toLowerCase()
  return email || null
}
const normalizeDateInput = (value) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const asFiniteNumber = (value, fallback = 0) => {
  const numericValue = toNumber(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}
const asInteger = (value, fallback = 0) => {
  const numericValue = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(numericValue) ? numericValue : fallback
}
const roundWeight = (value) => Number(asFiniteNumber(value, 0).toFixed(3))
const roundAmount = (value) => Number(asFiniteNumber(value, 0).toFixed(2))
const normalizeStringList = (values = []) => (
  Array.isArray(values)
    ? values.map((value) => normalizeText(value)).filter(Boolean)
    : []
)

const buildItemWarnings = (item = {}) => {
  const warnings = new Set(normalizeStringList(item.warnings))
  const warningLabel = normalizeText(item.warningLabel)
  if (warningLabel) warnings.add(warningLabel)
  if (item.hasKaratMismatch === true) warnings.add('QR Karat Mismatch')
  if (item.hasSupplierMismatch === true) warnings.add('Supplier Mismatch')
  if (item.hasWeightMismatch === true) warnings.add('Net Weight Mismatch')
  if (item.isDuplicate === true) warnings.add('Duplicate')
  if (item.hasPurityOverride === true) warnings.add('Custom Purity')
  if (item.hasWastageOverride === true) warnings.add('Custom Wastage')
  if (item.requiresReview === true) warnings.add('Needs Review')
  return Array.from(warnings)
}

const buildDerivedParsedSnapshot = (item = {}) => ({
  display: {
    item: {
      itemCode: item.itemCode || '',
      category: item.category || '',
      jewelType: item.jewelType || '',
      karat: item.qrKarat || item.appliedKarat || '',
    },
    supplier: {
      name: item.supplierName || '',
    },
    weights: {
      grossWeight: item.grossWeight ?? 0,
      stoneWeight: item.stoneWeight ?? 0,
      otherWeight: item.otherWeight ?? 0,
    },
    amounts: {
      stoneAmount: item.stoneAmount ?? 0,
      otherAmount: item.otherAmount ?? 0,
    },
    calculation: {
      netWeight: item.netWeight ?? 0,
      fineWeight: item.fineWeight ?? 0,
    },
    warnings: normalizeStringList(item.warnings),
    requiresReview: item.requiresReview === true,
  },
})

const normalizeMobileItem = (rawItem = {}, index = 0) => {
  const itemCode = normalizeText(rawItem.itemCode)
  if (!itemCode) {
    throw new MobileCaptureSessionSyncError(
      `Item at position ${index + 1} is missing itemCode`,
      'VALIDATION_ERROR',
      400,
    )
  }

  const supplierName = normalizeText(rawItem.supplierName || rawItem.supplier)
  const category = normalizeText(rawItem.category)
  const jewelType = normalizeText(rawItem.jewelType)
  const appliedKarat = normalizeText(rawItem.appliedKarat || rawItem.karat)
  const qrKarat = normalizeText(rawItem.qrKarat)
  const purity = asFiniteNumber(rawItem.purity ?? rawItem.purityPercent, 0)
  const wastage = asFiniteNumber(rawItem.wastage ?? rawItem.wastagePercent, 0)
  const grossWeight = roundWeight(rawItem.grossWeight)
  const stoneWeight = roundWeight(rawItem.stoneWeight)
  const otherWeight = roundWeight(rawItem.otherWeight)
  const netWeight = roundWeight(rawItem.netWeight ?? (grossWeight - stoneWeight - otherWeight))
  const fineWeight = roundWeight(rawItem.fineWeight ?? (netWeight * (purity + wastage) / 100))
  const normalizedItem = {
    clientItemId: normalizeText(rawItem.clientItemId || rawItem.id || `${itemCode}-${index + 1}`),
    srNo: Math.max(1, asInteger(rawItem.srNo, index + 1)),
    itemCode,
    supplierName: supplierName || 'Unknown',
    category,
    jewelType,
    appliedKarat,
    qrKarat,
    purity,
    wastage,
    grossWeight,
    stoneWeight,
    otherWeight,
    netWeight,
    fineWeight,
    stoneAmount: roundAmount(rawItem.stoneAmount),
    otherAmount: roundAmount(rawItem.otherAmount),
    rawQr: normalizeText(rawItem.rawQr),
    parsedSnapshot: rawItem.parsedSnapshot && typeof rawItem.parsedSnapshot === 'object' ? rawItem.parsedSnapshot : null,
    warnings: [],
    hasKaratMismatch: rawItem.hasKaratMismatch === true,
    hasSupplierMismatch: rawItem.hasSupplierMismatch === true,
    hasWeightMismatch: rawItem.hasWeightMismatch === true,
    isDuplicate: rawItem.isDuplicate === true,
    hasPurityOverride: rawItem.hasPurityOverride === true,
    hasWastageOverride: rawItem.hasWastageOverride === true,
    requiresReview: rawItem.requiresReview === true,
    addedAt: normalizeDateInput(rawItem.addedAt),
  }

  normalizedItem.warnings = buildItemWarnings({
    ...rawItem,
    ...normalizedItem,
  })

  if (!normalizedItem.parsedSnapshot) {
    normalizedItem.parsedSnapshot = buildDerivedParsedSnapshot(normalizedItem)
  }

  return normalizedItem
}
const calculateMobileSnapshot = ({ items = [], warningCounts = {} } = {}) => {
  const normalizedItems = Array.isArray(items)
    ? items.map((item, index) => normalizeMobileItem(item, index))
    : []

  const supplierNames = new Set()
  const totals = {
    supplierCount: 0,
    itemCount: normalizedItems.length,
    grossWeight: 0,
    stoneWeight: 0,
    otherWeight: 0,
    netWeight: 0,
    fineWeight: 0,
    stoneAmount: 0,
    otherAmount: 0,
  }

  let warningsCountTotal = 0
  let reviewCount = 0
  let duplicateCount = 0
  let manualOverrideCount = 0
  let karatMismatch = 0
  let supplierMismatch = 0
  let netMismatch = 0

  for (const item of normalizedItems) {
    if (item.supplierName) {
      supplierNames.add(item.supplierName.toUpperCase())
    }

    totals.grossWeight += item.grossWeight
    totals.stoneWeight += item.stoneWeight
    totals.otherWeight += item.otherWeight
    totals.netWeight += item.netWeight
    totals.fineWeight += item.fineWeight
    totals.stoneAmount += item.stoneAmount
    totals.otherAmount += item.otherAmount

    const hasWarning =
      item.warnings.length > 0 ||
      item.requiresReview ||
      item.hasKaratMismatch ||
      item.hasSupplierMismatch ||
      item.hasWeightMismatch ||
      item.isDuplicate ||
      item.hasPurityOverride ||
      item.hasWastageOverride

    if (hasWarning) warningsCountTotal += 1
    if (item.requiresReview || item.hasKaratMismatch || item.hasSupplierMismatch || item.hasWeightMismatch) reviewCount += 1
    if (item.isDuplicate) duplicateCount += 1
    if (item.hasPurityOverride || item.hasWastageOverride) manualOverrideCount += 1
    if (item.hasKaratMismatch) karatMismatch += 1
    if (item.hasSupplierMismatch) supplierMismatch += 1
    if (item.hasWeightMismatch) netMismatch += 1
  }

  totals.supplierCount = supplierNames.size
  totals.grossWeight = roundWeight(totals.grossWeight)
  totals.stoneWeight = roundWeight(totals.stoneWeight)
  totals.otherWeight = roundWeight(totals.otherWeight)
  totals.netWeight = roundWeight(totals.netWeight)
  totals.fineWeight = roundWeight(totals.fineWeight)
  totals.stoneAmount = roundAmount(totals.stoneAmount)
  totals.otherAmount = roundAmount(totals.otherAmount)

  return {
    items: normalizedItems,
    totals,
    flags: {
      warningsCount: warningsCountTotal,
      reviewCount,
      duplicateCount,
      manualOverrideCount,
    },
    warningCounts: {
      total: warningsCountTotal,
      karatMismatch,
      supplierMismatch,
      netMismatch,
      unknownQr: Math.max(0, asInteger(warningCounts.unknownQr, 0)),
      duplicate: duplicateCount,
      customPurityOverride: normalizedItems.filter((item) => item.hasPurityOverride).length,
      customWastageOverride: normalizedItems.filter((item) => item.hasWastageOverride).length,
    },
  }
}

const resolveSalesman = async (payload = {}, actor = {}) => {
  const rawSalesmanId = actor?.role === 'salesman' ? actor.id : payload?.salesman?.id
  const salesmanId = resolveIdValue(rawSalesmanId)

  if (!salesmanId) {
    throw new MobileCaptureSessionSyncError('Assigned salesman is required for mobile sync', 'VALIDATION_ERROR', 400)
  }

  if (!mongoose.isValidObjectId(salesmanId)) {
    throw new MobileCaptureSessionSyncError('Invalid salesman id', 'INVALID_ID', 400)
  }

  const salesman = await User.findById(salesmanId).lean()
  if (!salesman) {
    throw new MobileCaptureSessionSyncError('Assigned salesman not found', 'NOT_FOUND', 404)
  }

  if (salesman.role !== 'salesman') {
    throw new MobileCaptureSessionSyncError('Assigned user must be a salesman', 'VALIDATION_ERROR', 400)
  }

  if (actor?.role === 'salesman' && resolveIdValue(actor.id || actor._id) !== salesmanId) {
    throw new MobileCaptureSessionSyncError('Salesman can only sync own sessions', 'ASSIGNMENT_MISMATCH', 403)
  }

  return salesman
}

const findOrCreateCustomer = async (customer = {}) => {
  const requestedCustomerId = resolveIdValue(customer.id)
  if (requestedCustomerId && mongoose.isValidObjectId(requestedCustomerId)) {
    const existingById = await Customer.findOne({ _id: requestedCustomerId, isArchived: false })
    if (existingById) {
      return existingById
    }
  }

  const phone = normalizePhone(customer.phone)
  if (phone) {
    const existingByPhone = await Customer.findOne({ phone, isArchived: false })
    if (existingByPhone) {
      return existingByPhone
    }
  }

  const name = normalizeText(customer.name)
  const area = normalizeText(customer.area)
  const email = normalizeEmail(customer.email)

  if (!name) {
    throw new MobileCaptureSessionSyncError('Customer name is required for mobile sync', 'VALIDATION_ERROR', 400)
  }

  if (!area) {
    throw new MobileCaptureSessionSyncError('Customer area is required to create a new customer during mobile sync', 'VALIDATION_ERROR', 400)
  }

  return Customer.create({
    name,
    phone: phone || null,
    area,
    email,
  })
}

const resolveSupplier = async (lockedSettings = {}) => {
  const supplierId = resolveIdValue(lockedSettings?.supplierId)
  if (supplierId && mongoose.isValidObjectId(supplierId)) {
    const supplier = await Supplier.findById(supplierId).lean()
    if (supplier) {
      return supplier
    }
  }

  const supplierName = normalizeText(lockedSettings?.supplierName)
  if (!supplierName) {
    return null
  }

  return Supplier.findOne(
    {
      $or: [
        { name: { $regex: `^${escapeRegex(supplierName)}$`, $options: 'i' } },
        { code: { $regex: `^${escapeRegex(supplierName)}$`, $options: 'i' } },
      ],
    },
    { _id: 1, name: 1, code: 1, isActive: 1 }
  ).lean()
}

const buildUniqueSessionRef = async ({ preferredRef, createdAt, excludeId = null } = {}) => {
  const normalizedPreferred = normalizeText(preferredRef).toUpperCase()
  const buildQuery = (sessionRef) => (
    excludeId
      ? { sessionRef, _id: { $ne: excludeId } }
      : { sessionRef }
  )

  if (normalizedPreferred) {
    const existingPreferred = await CaptureSession.findOne(buildQuery(normalizedPreferred), { _id: 1 }).lean()
    if (!existingPreferred) {
      return normalizedPreferred
    }
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = buildSessionRef({
      prefix: 'SESSION',
      createdAt: createdAt || new Date(),
      sequence: attempt === 0 ? null : attempt + 1,
    })
    const existing = await CaptureSession.findOne(buildQuery(candidate), { _id: 1 }).lean()
    if (!existing) {
      return candidate
    }
  }

  throw new MobileCaptureSessionSyncError('Failed to reserve session reference', 'SERVER_ERROR', 500)
}
const hydrateSession = (session = {}, { resolveId, normalize, buildUserSummary, buildListItem } = {}) => {
  const summary = buildListItem(session)
  const items = Array.isArray(session.mobileItems)
    ? session.mobileItems.map((item) => ({
        _id: item.clientItemId,
        id: item.clientItemId,
        ref: item.itemCode || null,
        itemCode: item.itemCode || null,
        supplierName: item.supplierName || 'Unknown',
        category: item.category || null,
        jewelType: item.jewelType || null,
        supplier: {
          name: item.supplierName || 'Unknown',
        },
        grossWeight: item.grossWeight ?? 0,
        stoneWeight: item.stoneWeight ?? 0,
        otherWeight: item.otherWeight ?? 0,
        netWeight: item.netWeight ?? 0,
        fineWeight: item.fineWeight ?? 0,
        isDuplicate: item.isDuplicate === true,
        wasManuallyEdited: item.hasPurityOverride === true || item.hasWastageOverride === true,
        calculationSnapshot: {
          grossWeight: item.grossWeight ?? 0,
          stoneWeight: item.stoneWeight ?? 0,
          otherWeight: item.otherWeight ?? 0,
          netWeight: item.netWeight ?? 0,
          fineWeight: item.fineWeight ?? 0,
          stoneAmount: item.stoneAmount ?? 0,
          otherAmount: item.otherAmount ?? 0,
          purityPercent: item.purity ?? 0,
          wastagePercent: item.wastage ?? 0,
          warnings: normalizeStringList(item.warnings),
          requiresReview:
            item.requiresReview === true ||
            item.hasWeightMismatch === true ||
            item.hasSupplierMismatch === true ||
            item.hasKaratMismatch === true,
        },
        settlementInputs: {
          karat: item.appliedKarat || item.qrKarat || null,
          purityPercent: item.purity ?? 0,
          wastagePercent: item.wastage ?? 0,
          purityOverridden: item.hasPurityOverride === true,
          wastageOverridden: item.hasWastageOverride === true,
        },
        rawQr: normalize(item.rawQr) || null,
        parsedSnapshot: item.parsedSnapshot || buildDerivedParsedSnapshot(item),
      }))
    : []

  return {
    ...summary,
    id: summary._id,
    _id: summary._id,
    customerId: resolveId(session.customerId) || null,
    customerArea: normalize(session.customerArea) || '',
    customerEmail: normalize(session.customerEmail) || '',
    assignedSalesman: buildUserSummary(session.assignedSalesmanId),
    createdBy: buildUserSummary(session.createdBy),
    submittedBy: buildUserSummary(session.submittedBy),
    finalizedBy: buildUserSummary(session.finalizedBy),
    cancelledBy: buildUserSummary(session.cancelledBy),
    batchIds: [],
    batches: [],
    lockedSettings: session.lockedSettingsSnapshot || null,
    mobileWarningCounts: session.mobileWarningCounts || null,
    items,
    submittedAt: session.submittedAt || null,
    finalizedAt: session.finalizedAt || null,
    cancelledAt: session.cancelledAt || null,
    cancelReason: normalize(session.cancelReason) || null,
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
  }
}

const mobileSyncSession = async ({ payload = {}, actor = {} } = {}) => {
  if (actor?.role !== 'admin' && actor?.role !== 'salesman') {
    throw new MobileCaptureSessionSyncError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  const clientSessionId = normalizeText(payload?.clientSessionId)
  if (!clientSessionId) {
    throw new MobileCaptureSessionSyncError('clientSessionId is required', 'VALIDATION_ERROR', 400)
  }

  const rawItems = Array.isArray(payload?.items) ? payload.items : []
  if (rawItems.length === 0) {
    throw new MobileCaptureSessionSyncError('At least one item is required for mobile sync', 'VALIDATION_ERROR', 400)
  }

  let existingSession = await CaptureSession.findOne({ clientSessionId })
  if (existingSession && actor?.role === 'salesman' && resolveIdValue(existingSession.assignedSalesmanId) !== resolveIdValue(actor.id || actor._id)) {
    throw new MobileCaptureSessionSyncError('Insufficient permissions', 'FORBIDDEN', 403)
  }
  const existingStatus = normalizeText(existingSession?.status).toLowerCase()
  if (existingSession && existingStatus === 'cancelled') {
    throw new MobileCaptureSessionSyncError('Cancelled sessions cannot be re-synced from mobile', 'SESSION_LOCKED', 409)
  }
  if (existingSession && existingStatus === 'finalized') {
    throw new MobileCaptureSessionSyncError('Finalized sessions cannot be re-synced from mobile', 'SESSION_LOCKED', 409)
  }

  const salesman = await resolveSalesman(payload, actor)
  const customer = await findOrCreateCustomer(payload?.customer || {})
  const supplier = await resolveSupplier(payload?.lockedSettings || {})
  const snapshot = calculateMobileSnapshot({
    items: rawItems,
    warningCounts: payload?.warningCounts || {},
  })

  const createdAt = existingSession?.createdAt || normalizeDateInput(payload?.createdAt) || new Date()
  const actorId = resolveIdValue(actor?.id || actor?._id) || null
  const sessionRef = existingSession?.sessionRef || await buildUniqueSessionRef({
    preferredRef: payload?.sessionRef,
    createdAt,
  })
  const lockedSettingsSnapshot = {
    supplierId: supplier?._id || null,
    supplierName: normalizeText(payload?.lockedSettings?.supplierName || supplier?.name || supplier?.code),
    category: normalizeText(payload?.lockedSettings?.category),
    karat: normalizeText(payload?.lockedSettings?.karat),
    purity: asFiniteNumber(payload?.lockedSettings?.purity, 0),
    wastage: asFiniteNumber(payload?.lockedSettings?.wastage, 0),
  }

  const nextValues = {
    sessionRef,
    customerId: customer._id,
    customerName: normalizeText(customer.name),
    customerPhone: normalizePhone(customer.phone),
    customerArea: normalizeText(customer.area),
    customerEmail: normalizeText(customer.email),
    referenceNote: normalizeText(payload?.notes || payload?.referenceNote),
    clientSessionId,
    assignedSalesmanId: salesman._id,
    status: existingSession?.status === 'finalized' ? 'finalized' : 'submitted',
    totals: snapshot.totals,
    lockedSettingsSnapshot,
    mobileWarningCounts: snapshot.warningCounts,
    mobileItems: snapshot.items,
    syncSource: 'mobile',
    syncMeta: {
      source: 'mobile',
      appVersion: normalizeText(payload?.syncMeta?.appVersion) || null,
      deviceId: normalizeText(payload?.syncMeta?.deviceId) || null,
      clientCreatedAt: normalizeDateInput(payload?.createdAt)?.toISOString() || null,
      clientUpdatedAt: normalizeDateInput(payload?.updatedAt)?.toISOString() || null,
    },
    syncedAt: new Date(),
    warningsCount: snapshot.flags.warningsCount,
    reviewCount: snapshot.flags.reviewCount,
    duplicateCount: snapshot.flags.duplicateCount,
    manualOverrideCount: snapshot.flags.manualOverrideCount,
    submittedAt: existingSession?.submittedAt || createdAt,
    submittedBy: existingSession?.submittedBy || actorId,
    createdBy: existingSession?.createdBy || actorId,
  }

  let syncedSession = existingSession
  try {
    if (!syncedSession) {
      syncedSession = await CaptureSession.create({
        ...nextValues,
        batchIds: [],
        createdAt,
      })
    } else {
      syncedSession.set(nextValues)
      await syncedSession.save()
    }
  } catch (error) {
    if (error?.code !== 11000) {
      throw error
    }

    const duplicateSession = await CaptureSession.findOne({ clientSessionId })
    if (!duplicateSession) {
      throw error
    }
    if (actor?.role === 'salesman' && resolveIdValue(duplicateSession.assignedSalesmanId) !== resolveIdValue(actor.id || actor._id)) {
      throw new MobileCaptureSessionSyncError('Insufficient permissions', 'FORBIDDEN', 403)
    }
    const duplicateStatus = normalizeText(duplicateSession.status).toLowerCase()
    if (duplicateStatus === 'cancelled') {
      throw new MobileCaptureSessionSyncError('Cancelled sessions cannot be re-synced from mobile', 'SESSION_LOCKED', 409)
    }
    if (duplicateStatus === 'finalized') {
      throw new MobileCaptureSessionSyncError('Finalized sessions cannot be re-synced from mobile', 'SESSION_LOCKED', 409)
    }

    duplicateSession.set(nextValues)
    await duplicateSession.save()
    syncedSession = duplicateSession
  }

  return {
    backendSessionId: resolveIdValue(syncedSession._id),
    sessionRef: syncedSession.sessionRef,
    syncStatus: 'synced',
    syncedAt: syncedSession.syncedAt || new Date(),
    customerId: resolveIdValue(customer._id),
    customer: customer.toSafeObject ? customer.toSafeObject() : {
      id: resolveIdValue(customer._id),
      name: customer.name,
      phone: customer.phone || '',
      area: customer.area || '',
      email: customer.email || null,
    },
  }
}
export {
  MobileCaptureSessionSyncError,
  mobileSyncSession,
  hydrateSession as buildMobileSessionDetail,
}



