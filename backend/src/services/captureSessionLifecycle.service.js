import crypto from 'node:crypto'
import { toNumber, toText } from './qrParser.shared.js'

const ALLOWED_CAPTURE_SESSION_STATUSES = ['draft', 'open', 'submitted', 'finalized', 'cancelled']
const ALLOWED_CAPTURE_CHILD_BATCH_STATUSES = ['draft', 'open', 'submitted', 'finalized', 'reopened', 'cancelled']

class CaptureSessionLifecycleError extends Error {
  constructor(message, code = 'CAPTURE_SESSION_LIFECYCLE_ERROR', statusCode = 400) {
    super(message)
    this.name = 'CaptureSessionLifecycleError'
    this.code = code
    this.statusCode = statusCode
  }
}

const normalizeStatus = (value) => {
  const status = toText(value)?.toLowerCase() || null
  return status && ALLOWED_CAPTURE_SESSION_STATUSES.includes(status) ? status : null
}

const normalizeId = (value) => {
  if (!value) return null
  if (typeof value === 'string') {
    return toText(value) || null
  }
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return value.toHexString()
    }
    if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') {
      return value.toString()
    }
    if (value._id) {
      return normalizeId(value._id)
    }
    if (value.id && value.id !== value) {
      return normalizeId(value.id)
    }
  }
  return toText(value) || null
}

const normalizeBatchStatus = (batch = {}) => normalizeStatus(batch?.status)

const normalizeChildBatchStatus = (value) => {
  const status = toText(value)?.toLowerCase() || null
  return status && ALLOWED_CAPTURE_CHILD_BATCH_STATUSES.includes(status) ? status : null
}

const isCancelledBatch = (batch = {}) => normalizeChildBatchStatus(batch?.status) === 'cancelled'
const isActiveBatch = (batch = {}) => ['draft', 'open', 'reopened'].includes(normalizeChildBatchStatus(batch?.status))
const isSubmittedBatch = (batch = {}) => normalizeChildBatchStatus(batch?.status) === 'submitted'
const isFinalizedBatch = (batch = {}) => normalizeChildBatchStatus(batch?.status) === 'finalized'

const resolveSessionBatches = (scanBatches = []) =>
  Array.isArray(scanBatches)
    ? scanBatches.filter((batch) => batch && normalizeId(batch.sessionId))
    : []

const sanitizePrefix = (value) => {
  const raw = toText(value)?.toUpperCase() || 'SESSION'
  const cleaned = raw.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'SESSION'
}

const buildSessionRef = ({ createdAt = new Date(), sequence = null, prefix = 'SESSION' } = {}) => {
  const prefixPart = sanitizePrefix(prefix)
  const datePart = createdAt instanceof Date && !Number.isNaN(createdAt.getTime()) ? createdAt : new Date()
  const yyyy = datePart.getFullYear()
  const mm = String(datePart.getMonth() + 1).padStart(2, '0')
  const dd = String(datePart.getDate()).padStart(2, '0')
  const suffix = sequence !== null && sequence !== undefined
    ? String(sequence).padStart(4, '0')
    : crypto.randomBytes(2).toString('hex').toUpperCase()

  return `${prefixPart}-${yyyy}${mm}${dd}-${suffix}`
}

const assertAllowedSessionTransition = (currentStatus, nextStatus) => {
  const current = normalizeStatus(currentStatus)
  const next = normalizeStatus(nextStatus)

  if (!current) {
    throw new CaptureSessionLifecycleError('Invalid current session status', 'SESSION_STATUS_INVALID')
  }

  if (!next) {
    throw new CaptureSessionLifecycleError('Invalid next session status', 'SESSION_STATUS_INVALID')
  }

  if (current === next) {
    return true
  }

  const allowedTransitions = {
    draft: ['open', 'cancelled'],
    open: ['submitted', 'cancelled'],
    submitted: ['finalized', 'open'],
    finalized: [],
    cancelled: [],
  }

  if (!allowedTransitions[current].includes(next)) {
    throw new CaptureSessionLifecycleError(
      `Transition ${current} -> ${next} is not allowed`,
      'SESSION_STATUS_TRANSITION_INVALID'
    )
  }

  return true
}

const canSessionAcceptBatches = (session = {}) => {
  const status = normalizeStatus(session?.status)
  return ['draft', 'open'].includes(status)
}

const validateUniqueSupplierBatches = (scanBatches = []) => {
  const seenBatchIds = new Set()
  const sessionSupplierIds = new Map()

  for (const batch of resolveSessionBatches(scanBatches)) {
    const batchId = normalizeId(batch?._id || batch?.id)
    const sessionId = normalizeId(batch?.sessionId)
    const supplierId = normalizeId(batch?.supplierId || batch?.supplier?.id || batch?.supplier?._id)

    if (!sessionId) {
      continue
    }

    if (batchId && seenBatchIds.has(batchId)) {
      throw new CaptureSessionLifecycleError('Duplicate child batch in session', 'SESSION_DUPLICATE_BATCH')
    }
    if (batchId) {
      seenBatchIds.add(batchId)
    }

    if (!supplierId) {
      throw new CaptureSessionLifecycleError('Each session batch must have a supplier', 'SESSION_ITEM_SUPPLIER_MISSING')
    }

    const supplierSet = sessionSupplierIds.get(sessionId) || new Set()
    if (supplierSet.has(supplierId)) {
      throw new CaptureSessionLifecycleError(
        'One supplier can appear only once in a capture session',
        'SESSION_DUPLICATE_SUPPLIER'
      )
    }

    supplierSet.add(supplierId)
    sessionSupplierIds.set(sessionId, supplierSet)
  }

  return true
}

const resolveSessionBatchTotals = (batch = {}) => {
  const totals = batch?.totals && typeof batch.totals === 'object' ? batch.totals : {}
  return {
    grossWeight: toNumber(totals.grossWeight ?? totals.gross_weight) ?? 0,
    stoneWeight: toNumber(totals.stoneWeight ?? totals.stone_weight) ?? 0,
    otherWeight: toNumber(totals.otherWeight ?? totals.other_weight) ?? 0,
    netWeight: toNumber(totals.netWeight ?? totals.net_weight) ?? 0,
    fineWeight: toNumber(totals.fineWeight ?? totals.fine_weight) ?? 0,
    stoneAmount: toNumber(totals.stoneAmount ?? totals.stone_amount) ?? 0,
  }
}

const resolveSessionBatchCounts = (batch = {}) => {
  return {
    warningsCount: toNumber(batch?.warningsCount) ?? 0,
    reviewCount: toNumber(batch?.reviewCount) ?? 0,
    duplicateCount: toNumber(batch?.duplicateCount) ?? 0,
    manualOverrideCount: toNumber(batch?.manualOverrideCount) ?? 0,
    itemCount: toNumber(batch?.itemCount) ?? 0,
  }
}

const calculateSessionTotals = (scanBatches = []) => {
  validateUniqueSupplierBatches(scanBatches)

  const includedBatches = resolveSessionBatches(scanBatches).filter((batch) => !isCancelledBatch(batch))
  const supplierIds = new Set()
  const totals = {
    supplierCount: 0,
    itemCount: 0,
    grossWeight: 0,
    stoneWeight: 0,
    otherWeight: 0,
    netWeight: 0,
    fineWeight: 0,
    stoneAmount: 0,
  }

  for (const batch of includedBatches) {
    const supplierId = normalizeId(batch?.supplierId || batch?.supplier?.id || batch?.supplier?._id)
    if (supplierId) {
      supplierIds.add(supplierId)
    }

    const batchTotals = resolveSessionBatchTotals(batch)
    const batchCounts = resolveSessionBatchCounts(batch)
    totals.itemCount += batchCounts.itemCount
    totals.grossWeight += batchTotals.grossWeight
    totals.stoneWeight += batchTotals.stoneWeight
    totals.otherWeight += batchTotals.otherWeight
    totals.netWeight += batchTotals.netWeight
    totals.fineWeight += batchTotals.fineWeight
    totals.stoneAmount += batchTotals.stoneAmount
  }

  totals.supplierCount = supplierIds.size

  return {
    supplierCount: totals.supplierCount,
    itemCount: totals.itemCount,
    grossWeight: Number(totals.grossWeight.toFixed(6)),
    stoneWeight: Number(totals.stoneWeight.toFixed(6)),
    otherWeight: Number(totals.otherWeight.toFixed(6)),
    netWeight: Number(totals.netWeight.toFixed(6)),
    fineWeight: Number(totals.fineWeight.toFixed(6)),
    stoneAmount: Number(totals.stoneAmount.toFixed(2)),
  }
}

const countSessionFlags = (scanBatches = []) => {
  let warningsCount = 0
  let reviewCount = 0
  let duplicateCount = 0
  let manualOverrideCount = 0

  for (const batch of resolveSessionBatches(scanBatches)) {
    if (isCancelledBatch(batch)) {
      continue
    }

    warningsCount += toNumber(batch?.warningsCount) ?? 0
    reviewCount += toNumber(batch?.reviewCount) ?? 0
    duplicateCount += toNumber(batch?.duplicateCount) ?? 0
    manualOverrideCount += toNumber(batch?.manualOverrideCount) ?? 0
  }

  return {
    warningsCount,
    reviewCount,
    duplicateCount,
    manualOverrideCount,
  }
}

const deriveSessionStatus = (scanBatches = [], currentSessionStatus = null) => {
  const current = normalizeStatus(currentSessionStatus)
  if (current === 'cancelled') {
    return 'cancelled'
  }

  const activeBatches = resolveSessionBatches(scanBatches).filter((batch) => !isCancelledBatch(batch))
  if (activeBatches.length === 0) {
    return current || 'draft'
  }

  if (activeBatches.some((batch) => isActiveBatch(batch))) {
    return 'open'
  }

  if (current === 'draft') {
    return 'open'
  }

  return current || 'draft'
}

const canSubmitSession = (session = {}, scanBatches = []) => {
  const status = normalizeStatus(session?.status)
  if (!['draft', 'open'].includes(status)) {
    return false
  }

  const activeBatches = resolveSessionBatches(scanBatches).filter((batch) => !isCancelledBatch(batch))
  if (activeBatches.length === 0) {
    return false
  }

  if (activeBatches.some((batch) => isActiveBatch(batch))) {
    return false
  }

  return activeBatches.every((batch) => isSubmittedBatch(batch) || isFinalizedBatch(batch))
}

const canFinalizeSession = (session = {}, scanBatches = []) => {
  const status = normalizeStatus(session?.status)
  if (status !== 'submitted') {
    return false
  }

  const activeBatches = resolveSessionBatches(scanBatches).filter((batch) => !isCancelledBatch(batch))
  if (activeBatches.length === 0) {
    return false
  }

  return activeBatches.every((batch) => isFinalizedBatch(batch))
}

const buildSessionSummary = (session = {}, scanBatches = []) => {
  const totals = calculateSessionTotals(scanBatches)
  const flags = countSessionFlags(scanBatches)
  const status = normalizeStatus(session?.status) || 'draft'

  return {
    _id: normalizeId(session?._id || session?.id) || session?._id || session?.id || null,
    sessionRef: toText(session?.sessionRef) || null,
    customerName: toText(session?.customerName) || '',
    customerPhone: toText(session?.customerPhone) || '',
    referenceNote: toText(session?.referenceNote) || '',
    assignedSalesmanId: normalizeId(session?.assignedSalesmanId) || null,
    status,
    supplierCount: totals.supplierCount,
    itemCount: totals.itemCount,
    totals,
    warningsCount: flags.warningsCount,
    reviewCount: flags.reviewCount,
    duplicateCount: flags.duplicateCount,
    manualOverrideCount: flags.manualOverrideCount,
    createdAt: session?.createdAt || null,
    updatedAt: session?.updatedAt || null,
  }
}

export {
  ALLOWED_CAPTURE_SESSION_STATUSES,
  CaptureSessionLifecycleError,
  assertAllowedSessionTransition,
  buildSessionRef,
  buildSessionSummary,
  calculateSessionTotals,
  canFinalizeSession,
  canSessionAcceptBatches,
  canSubmitSession,
  deriveSessionStatus,
  validateUniqueSupplierBatches,
}
