import crypto from 'node:crypto'
import { cloneValue, toNumber, toText } from './qrParser.shared.js'

const ALLOWED_BATCH_STATUSES = ['draft', 'open', 'submitted', 'finalized', 'reopened', 'cancelled']
const ALLOWED_BATCH_ENTRY_MODES = ['qr_scan', 'manual', 'mixed']
const ALLOWED_SALE_ENTRY_MODES = ['qr_scan', 'manual', 'qr_scan_with_manual_override']

class BatchLifecycleError extends Error {
  constructor(message, code = 'BATCH_LIFECYCLE_ERROR', statusCode = 400) {
    super(message)
    this.name = 'BatchLifecycleError'
    this.code = code
    this.statusCode = statusCode
  }
}

const normalizeStatus = (value) => {
  const status = toText(value)?.toLowerCase() || null
  return status && ALLOWED_BATCH_STATUSES.includes(status) ? status : null
}

const normalizeBatchEntryMode = (value) => {
  const mode = toText(value)?.toLowerCase() || null
  return mode && ALLOWED_BATCH_ENTRY_MODES.includes(mode) ? mode : null
}

const normalizeSaleEntryMode = (value) => {
  const mode = toText(value)?.toLowerCase() || null
  return mode && ALLOWED_SALE_ENTRY_MODES.includes(mode) ? mode : null
}

const normalizeId = (value) => toText(value) || null

const normalizeDate = (value) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const roundTo = (value, precision = 6) => {
  const numeric = toNumber(value)
  if (numeric === null) {
    return 0
  }

  return Number(numeric.toFixed(precision))
}

const sanitizeBatchPrefix = (value) => {
  const raw = toText(value)?.toUpperCase() || 'BATCH'
  const cleaned = raw.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'BATCH'
}

const buildBatchRef = ({ supplierCode, createdAt = new Date(), sequence = null } = {}) => {
  const supplierPart = sanitizeBatchPrefix(supplierCode)
  const datePart = normalizeDate(createdAt) ?? new Date()
  const yyyy = datePart.getFullYear()
  const mm = String(datePart.getMonth() + 1).padStart(2, '0')
  const dd = String(datePart.getDate()).padStart(2, '0')
  const suffix = sequence !== null && sequence !== undefined
    ? String(sequence).padStart(4, '0')
    : crypto.randomBytes(2).toString('hex').toUpperCase()

  return `${supplierPart}-${yyyy}${mm}${dd}-${suffix}`
}

const resolveSaleSupplierId = (sale = {}) => {
  return normalizeId(sale?.supplier?._id || sale?.supplierId || sale?.supplier)
}

const resolveSaleWarnings = (sale = {}) => {
  const warnings = []
  const calculation = sale?.calculationSnapshot && typeof sale.calculationSnapshot === 'object'
    ? sale.calculationSnapshot
    : {}
  const parsedSnapshot = sale?.parsedSnapshot && typeof sale.parsedSnapshot === 'object'
    ? sale.parsedSnapshot
    : {}
  const parsedDisplay = parsedSnapshot?.display && typeof parsedSnapshot.display === 'object'
    ? parsedSnapshot.display
    : {}

  const sources = [calculation?.warnings, parsedSnapshot?.warnings, parsedDisplay?.warnings]
  for (const source of sources) {
    if (Array.isArray(source)) {
      warnings.push(...source.filter((entry) => entry !== null && entry !== undefined && entry !== ''))
    } else if (source !== null && source !== undefined && source !== '') {
      warnings.push(source)
    }
  }

  return warnings
}

const resolveSaleTotals = (sale = {}) => {
  const calculation = sale?.calculationSnapshot && typeof sale.calculationSnapshot === 'object'
    ? sale.calculationSnapshot
    : {}
  const settlementInputs = sale?.settlementInputs && typeof sale.settlementInputs === 'object'
    ? sale.settlementInputs
    : {}

  const grossWeight = toNumber(calculation?.grossWeight ?? sale?.grossWeight ?? sale?.gross_weight) ?? 0
  const stoneWeight = toNumber(calculation?.stoneWeight ?? sale?.stoneWeight ?? sale?.stone_weight) ?? 0
  const otherWeight = toNumber(
    calculation?.otherWeight ??
    settlementInputs?.otherWeight ??
    sale?.otherWeight ??
    sale?.other_weight
  ) ?? 0
  const netWeight = toNumber(
    calculation?.selectedNetWeight ??
    calculation?.computedNetWeight ??
    sale?.netWeight ??
    sale?.net_weight
  ) ?? 0
  const fineWeight = toNumber(calculation?.fineWeight ?? sale?.fineWeight ?? sale?.fine_weight) ?? 0
  const stoneAmount = toNumber(calculation?.stoneAmount ?? sale?.stoneAmount ?? sale?.stone_amount) ?? 0

  return {
    grossWeight: roundTo(grossWeight, 6),
    stoneWeight: roundTo(stoneWeight, 6),
    otherWeight: roundTo(otherWeight, 6),
    netWeight: roundTo(netWeight, 6),
    fineWeight: roundTo(fineWeight, 6),
    stoneAmount: roundTo(stoneAmount, 2),
  }
}

const countSaleFlags = (saleItems = []) => {
  let warningsCount = 0
  let reviewCount = 0
  let duplicateCount = 0
  let manualOverrideCount = 0

  for (const sale of saleItems) {
    const calculation = sale?.calculationSnapshot && typeof sale.calculationSnapshot === 'object'
      ? sale.calculationSnapshot
      : {}
    const parsedSnapshot = sale?.parsedSnapshot && typeof sale.parsedSnapshot === 'object'
      ? sale.parsedSnapshot
      : {}
    const parsedDisplay = parsedSnapshot?.display && typeof parsedSnapshot.display === 'object'
      ? parsedSnapshot.display
      : {}
    const settlementInputs = sale?.settlementInputs && typeof sale.settlementInputs === 'object'
      ? sale.settlementInputs
      : {}

    warningsCount += resolveSaleWarnings(sale).length

    if (calculation?.requiresReview === true || parsedDisplay?.requiresReview === true) {
      reviewCount += 1
    }

    if (sale?.isDuplicate === true) {
      duplicateCount += 1
    }

    if (
      settlementInputs?.purityOverridden === true ||
      settlementInputs?.wastageOverridden === true ||
      sale?.wasManuallyEdited === true
    ) {
      manualOverrideCount += 1
    }
  }

  return {
    warningsCount,
    reviewCount,
    duplicateCount,
    manualOverrideCount,
  }
}

const assertBatchSaleItems = (batch, saleItems = []) => {
  if (!Array.isArray(saleItems) || saleItems.length === 0) {
    throw new BatchLifecycleError('Batch requires at least one sale item', 'BATCH_EMPTY')
  }

  const batchSupplierId = normalizeId(batch?.supplierId)
  const supplierIds = new Set()

  for (const sale of saleItems) {
    const supplierId = resolveSaleSupplierId(sale)
    if (!supplierId) {
      throw new BatchLifecycleError('Each sale item must have a supplier', 'BATCH_ITEM_SUPPLIER_MISSING')
    }

    supplierIds.add(supplierId)

    if (batchSupplierId && supplierId !== batchSupplierId) {
      throw new BatchLifecycleError('Mixed supplier batches are not allowed', 'BATCH_MIXED_SUPPLIER')
    }
  }

  if (supplierIds.size > 1) {
    throw new BatchLifecycleError('Mixed supplier batches are not allowed', 'BATCH_MIXED_SUPPLIER')
  }

  return true
}

const assertAllowedTransition = (currentStatus, nextStatus, options = {}) => {
  const current = normalizeStatus(currentStatus)
  const next = normalizeStatus(nextStatus)
  const allowAdminCorrection = options?.allowAdminCorrection === true

  if (!current) {
    throw new BatchLifecycleError('Invalid current batch status', 'BATCH_STATUS_INVALID')
  }

  if (!next) {
    throw new BatchLifecycleError('Invalid next batch status', 'BATCH_STATUS_INVALID')
  }

  if (current === next) {
    return true
  }

  const allowedTransitions = {
    draft: ['open', 'cancelled'],
    open: ['submitted', 'cancelled'],
    submitted: allowAdminCorrection ? ['finalized', 'open'] : ['finalized'],
    finalized: ['reopened'],
    reopened: ['submitted', 'cancelled'],
    cancelled: [],
  }

  if (!allowedTransitions[current].includes(next)) {
    throw new BatchLifecycleError(
      `Transition ${current} -> ${next} is not allowed`,
      'BATCH_STATUS_TRANSITION_INVALID'
    )
  }

  return true
}

const canSalesmanAddItems = (batch = {}) => {
  const status = normalizeStatus(batch?.status)
  return ['draft', 'open', 'reopened'].includes(status) && Boolean(batch?.assignedSalesmanId)
}

const canAdminReopen = (batch = {}) => {
  return normalizeStatus(batch?.status) === 'finalized'
}

const deriveBatchEntryMode = (saleItems = []) => {
  const modes = new Set()

  for (const sale of saleItems) {
    const explicit = normalizeSaleEntryMode(sale?.entryMode)
    if (explicit === 'qr_scan_with_manual_override') {
      modes.add('qr_scan')
      continue
    }

    if (explicit) {
      modes.add(explicit)
      continue
    }

    if (sale?.wasManuallyEdited === true && !sale?.qrRaw) {
      modes.add('manual')
      continue
    }

    if (sale?.qrRaw) {
      modes.add('qr_scan')
    }
  }

  if (modes.size === 0) {
    return 'mixed'
  }

  return modes.size > 1 ? 'mixed' : [...modes][0]
}

const calculateBatchTotals = (saleItems = []) => {
  const totals = {
    grossWeight: 0,
    stoneWeight: 0,
    otherWeight: 0,
    netWeight: 0,
    fineWeight: 0,
    stoneAmount: 0,
  }

  for (const sale of saleItems) {
    const saleTotals = resolveSaleTotals(sale)
    totals.grossWeight += saleTotals.grossWeight
    totals.stoneWeight += saleTotals.stoneWeight
    totals.otherWeight += saleTotals.otherWeight
    totals.netWeight += saleTotals.netWeight
    totals.fineWeight += saleTotals.fineWeight
    totals.stoneAmount += saleTotals.stoneAmount
  }

  return {
    grossWeight: roundTo(totals.grossWeight, 6),
    stoneWeight: roundTo(totals.stoneWeight, 6),
    otherWeight: roundTo(totals.otherWeight, 6),
    netWeight: roundTo(totals.netWeight, 6),
    fineWeight: roundTo(totals.fineWeight, 6),
    stoneAmount: roundTo(totals.stoneAmount, 2),
  }
}

const createRevisionSnapshot = (batch = {}, saleItems = [], actorId = null) => {
  const totals = calculateBatchTotals(saleItems)
  const flags = countSaleFlags(saleItems)
  const revision = Math.max(1, Math.floor(toNumber(batch?.revision) ?? 1))
  const saleIds = saleItems
    .map((sale) => normalizeId(sale?._id || sale?.id))
    .filter(Boolean)

  return {
    revision,
    status: normalizeStatus(batch?.status) || 'finalized',
    saleIds,
    totals,
    itemCount: saleItems.length,
    warningsCount: flags.warningsCount,
    reviewCount: flags.reviewCount,
    duplicateCount: flags.duplicateCount,
    manualOverrideCount: flags.manualOverrideCount,
    finalizedAt: normalizeDate(batch?.finalizedAt),
    finalizedBy: normalizeId(batch?.finalizedBy ?? actorId),
    reopenReason: toText(batch?.reopenReason) || null,
    reopenedAt: normalizeDate(batch?.reopenedAt),
    reopenedBy: normalizeId(batch?.reopenedBy) || null,
    exports: [],
  }
}

const reopenBatchState = (batch = {}, { actorId = null, reason } = {}) => {
  const currentStatus = normalizeStatus(batch?.status)
  assertAllowedTransition(currentStatus, 'reopened')

  const reopenReason = toText(reason)
  if (!reopenReason) {
    throw new BatchLifecycleError('Reopen reason is required', 'BATCH_REOPEN_REASON_REQUIRED')
  }

  const nextRevision = Math.max(1, Math.floor(toNumber(batch?.revision) ?? 1)) + 1

  return {
    ...cloneValue(batch),
    status: 'reopened',
    revision: nextRevision,
    reopenedAt: new Date(),
    reopenedBy: normalizeId(actorId),
    reopenReason,
    finalizedAt: null,
    finalizedBy: null,
  }
}

const finalizeBatchState = (batch = {}, { actorId = null, saleItems = [] } = {}) => {
  const currentStatus = normalizeStatus(batch?.status)
  assertAllowedTransition(currentStatus, 'finalized')
  assertBatchSaleItems(batch, saleItems)

  const normalizedRevision = Math.max(1, Math.floor(toNumber(batch?.revision) ?? 1))
  const revisions = Array.isArray(batch?.revisions) ? cloneValue(batch.revisions) : []
  const existingRevision = revisions.find((entry) => toNumber(entry?.revision) === normalizedRevision)
  if (existingRevision) {
    throw new BatchLifecycleError(
      `Revision ${normalizedRevision} has already been finalized`,
      'BATCH_REVISION_ALREADY_FINALIZED',
      409
    )
  }

  const finalizedAt = new Date()
  const derivedEntryMode = deriveBatchEntryMode(saleItems)
  const nextBatch = {
    ...cloneValue(batch),
    status: 'finalized',
    finalizedAt,
    finalizedBy: normalizeId(actorId),
    entryMode: normalizeBatchEntryMode(batch?.entryMode) || derivedEntryMode,
    itemCount: saleItems.length,
    totals: calculateBatchTotals(saleItems),
    ...countSaleFlags(saleItems),
  }

  const revisionSnapshot = createRevisionSnapshot(
    {
      ...nextBatch,
      finalizedAt,
      finalizedBy: normalizeId(actorId),
      status: 'finalized',
    },
    saleItems,
    actorId
  )

  return {
    ...nextBatch,
    revisions: [...revisions, revisionSnapshot],
  }
}

export {
  ALLOWED_BATCH_ENTRY_MODES,
  ALLOWED_BATCH_STATUSES,
  ALLOWED_SALE_ENTRY_MODES,
  BatchLifecycleError,
  assertAllowedTransition,
  buildBatchRef,
  canAdminReopen,
  canSalesmanAddItems,
  calculateBatchTotals,
  createRevisionSnapshot,
  deriveBatchEntryMode,
  finalizeBatchState,
  reopenBatchState,
  normalizeBatchEntryMode,
  normalizeSaleEntryMode,
}
