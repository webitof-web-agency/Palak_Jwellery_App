import mongoose from 'mongoose'
import { ScanBatch } from '../models/ScanBatch.js'
import { Sale } from '../models/Sale.js'
import { Supplier } from '../models/Supplier.js'
import { User } from '../models/User.js'
import { syncParentSessionForBatchBestEffort } from './captureSessionSync.service.js'
import {
  ALLOWED_BATCH_ENTRY_MODES,
  ALLOWED_BATCH_STATUSES,
  assertAllowedTransition,
  buildBatchRef,
  calculateBatchTotals,
  deriveBatchEntryMode,
  finalizeBatchState,
  canSalesmanAddItems,
  reopenBatchState,
} from './batchLifecycle.service.js'
import { toNumber, toText } from './qrParser.shared.js'

class BatchServiceError extends Error {
  constructor(message, code = 'BATCH_SERVICE_ERROR', statusCode = 400, details = null) {
    super(message)
    this.name = 'BatchServiceError'
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

const normalizeDateInput = (value) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const normalizeStatusFilter = (value) => {
  const status = normalizeText(value).toLowerCase()
  return status && ALLOWED_BATCH_STATUSES.includes(status) ? status : null
}

const normalizeEntryModeFilter = (value) => {
  const mode = normalizeText(value).toLowerCase()
  return mode && ALLOWED_BATCH_ENTRY_MODES.includes(mode) ? mode : null
}

const toSaleRef = (id) => {
  if (!id) return null
  return `#${String(id).slice(-6).toUpperCase()}`
}

const buildUserSummary = (user) => {
  const resolved = user && typeof user === 'object' ? user : null
  if (!resolved) return null

  const id = resolveIdValue(resolved._id || resolved.id || resolved)
  return {
    _id: id,
    name: normalizeText(resolved.name) || null,
    email: normalizeText(resolved.email) || null,
    phone: normalizeText(resolved.phone) || null,
    role: normalizeText(resolved.role) || null,
    isActive: resolved.isActive ?? null,
  }
}

const buildSupplierSummary = (supplier) => {
  const resolved = supplier && typeof supplier === 'object' ? supplier : null
  if (!resolved) return null

  const id = resolveIdValue(resolved._id || resolved.id || resolved)
  return {
    _id: id,
    name: normalizeText(resolved.name) || null,
    code: normalizeText(resolved.code) || null,
    isActive: resolved.isActive ?? null,
  }
}

const buildRevisionSummary = (revision = {}) => ({
  revision: toNumber(revision.revision) ?? 1,
  status: normalizeText(revision.status) || 'finalized',
  saleCount: Array.isArray(revision.saleIds) ? revision.saleIds.length : 0,
  totals: revision.totals || {
    grossWeight: 0,
    stoneWeight: 0,
    otherWeight: 0,
    netWeight: 0,
    fineWeight: 0,
    stoneAmount: 0,
  },
  itemCount: toNumber(revision.itemCount) ?? 0,
  warningsCount: toNumber(revision.warningsCount) ?? 0,
  reviewCount: toNumber(revision.reviewCount) ?? 0,
  duplicateCount: toNumber(revision.duplicateCount) ?? 0,
  manualOverrideCount: toNumber(revision.manualOverrideCount) ?? 0,
  finalizedAt: revision.finalizedAt || null,
  finalizedBy: resolveIdValue(revision.finalizedBy) || null,
  reopenReason: normalizeText(revision.reopenReason) || null,
  reopenedAt: revision.reopenedAt || null,
  reopenedBy: resolveIdValue(revision.reopenedBy) || null,
  exportsCount: Array.isArray(revision.exports) ? revision.exports.length : 0,
})

const buildCurrentRevisionSummary = (batch = {}, saleItems = []) => {
  const totals = batch.totals || calculateBatchTotals(saleItems)
  const entryMode = saleItems.length > 0 ? deriveBatchEntryMode(saleItems) : resolveIdValue(batch.entryMode) || null
  return {
    revision: toNumber(batch.revision) ?? 1,
    status: normalizeText(batch.status) || 'draft',
    totals,
    itemCount: toNumber(batch.itemCount) ?? saleItems.length,
    warningsCount: toNumber(batch.warningsCount) ?? 0,
    reviewCount: toNumber(batch.reviewCount) ?? 0,
    duplicateCount: toNumber(batch.duplicateCount) ?? 0,
    manualOverrideCount: toNumber(batch.manualOverrideCount) ?? 0,
    entryMode,
    submittedAt: batch.submittedAt || null,
    submittedBy: buildUserSummary(batch.submittedBy),
    finalizedAt: batch.finalizedAt || null,
    finalizedBy: buildUserSummary(batch.finalizedBy),
    reopenedAt: batch.reopenedAt || null,
    reopenedBy: buildUserSummary(batch.reopenedBy),
    reopenReason: normalizeText(batch.reopenReason) || null,
  }
}

const buildSaleFlags = (saleItems = []) => {
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

    const warnings = []
    for (const source of [calculation?.warnings, parsedSnapshot?.warnings, parsedDisplay?.warnings]) {
      if (Array.isArray(source)) {
        warnings.push(...source.filter((entry) => entry !== null && entry !== undefined && entry !== ''))
      } else if (source !== null && source !== undefined && source !== '') {
        warnings.push(source)
      }
    }

    warningsCount += warnings.length

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

const buildBatchTotals = (saleItems = []) => ({
  ...calculateBatchTotals(saleItems),
})

const buildBatchStats = (saleItems = []) => {
  const totals = buildBatchTotals(saleItems)
  const flags = buildSaleFlags(saleItems)
  const itemCount = saleItems.length
  const entryMode = itemCount > 0 ? deriveBatchEntryMode(saleItems) : null

  return {
    itemCount,
    totals,
    entryMode,
    ...flags,
  }
}

const buildBatchListItem = (batch = {}) => ({
  _id: batch._id,
  batchRef: batch.batchRef || null,
  supplier: buildSupplierSummary(batch.supplierId),
  supplierCode: normalizeText(batch.supplierCode) || normalizeText(batch.supplierId?.code) || null,
  salesman: buildUserSummary(batch.salesmanId),
  assignedSalesman: buildUserSummary(batch.assignedSalesmanId),
  status: normalizeText(batch.status) || 'draft',
  revision: toNumber(batch.revision) ?? 1,
  entryMode: normalizeText(batch.entryMode) || null,
  itemCount: toNumber(batch.itemCount) ?? 0,
  totals: batch.totals || buildBatchTotals([]),
  warningsCount: toNumber(batch.warningsCount) ?? 0,
  reviewCount: toNumber(batch.reviewCount) ?? 0,
  duplicateCount: toNumber(batch.duplicateCount) ?? 0,
  manualOverrideCount: toNumber(batch.manualOverrideCount) ?? 0,
  customerName: normalizeText(batch.customerName) || '',
  customerPhone: normalizeText(batch.customerPhone) || '',
  referenceNote: normalizeText(batch.referenceNote) || '',
  createdBy: buildUserSummary(batch.createdBy),
  submittedAt: batch.submittedAt || null,
  finalizedAt: batch.finalizedAt || null,
  reopenedAt: batch.reopenedAt || null,
  reopenReason: normalizeText(batch.reopenReason) || null,
  createdAt: batch.createdAt || null,
  updatedAt: batch.updatedAt || null,
})

const buildSaleSummary = (sale = {}) => ({
  _id: sale._id,
  ref: toSaleRef(sale._id),
  batchId: resolveIdValue(sale.batchId) || null,
  revisionAdded: toNumber(sale.revisionAdded) ?? null,
  entryMode: normalizeText(sale.entryMode) || null,
  addedBy: buildUserSummary(sale.addedBy),
  addedAt: sale.addedAt || null,
  supplier: buildSupplierSummary(sale.supplier),
  salesman: buildUserSummary(sale.salesman),
  category: normalizeText(sale.category) || null,
  itemCode: normalizeText(sale.itemCode) || null,
  metalType: normalizeText(sale.metalType) || null,
  purity: normalizeText(sale.purity) || null,
  grossWeight: sale.grossWeight ?? null,
  stoneWeight: sale.stoneWeight ?? null,
  netWeight: sale.netWeight ?? null,
  ratePerGram: sale.ratePerGram ?? null,
  totalValue: sale.totalValue ?? null,
  isDuplicate: Boolean(sale.isDuplicate),
  wasManuallyEdited: Boolean(sale.wasManuallyEdited),
  qrRaw: sale.qrRaw ?? null,
  settlementInputs: sale.settlementInputs ?? null,
  calculationSnapshot: sale.calculationSnapshot ?? null,
  parsedSnapshot: sale.parsedSnapshot ?? null,
  saleDate: sale.saleDate || null,
  createdAt: sale.createdAt || null,
  updatedAt: sale.updatedAt || null,
})

const buildBatchDetailResponse = (batch = {}, saleItems = []) => {
  const totals = batch.totals || buildBatchTotals(saleItems)
  return {
    _id: batch._id,
    batchRef: batch.batchRef || null,
    supplier: buildSupplierSummary(batch.supplierId),
    supplierCode: normalizeText(batch.supplierCode) || normalizeText(batch.supplierId?.code) || null,
    salesman: buildUserSummary(batch.salesmanId),
    assignedSalesman: buildUserSummary(batch.assignedSalesmanId),
    status: normalizeText(batch.status) || 'draft',
    revision: toNumber(batch.revision) ?? 1,
    entryMode: normalizeText(batch.entryMode) || null,
    itemCount: toNumber(batch.itemCount) ?? saleItems.length,
    totals,
    warningsCount: toNumber(batch.warningsCount) ?? 0,
    reviewCount: toNumber(batch.reviewCount) ?? 0,
    duplicateCount: toNumber(batch.duplicateCount) ?? 0,
    manualOverrideCount: toNumber(batch.manualOverrideCount) ?? 0,
    customerName: normalizeText(batch.customerName) || '',
    customerPhone: normalizeText(batch.customerPhone) || '',
    referenceNote: normalizeText(batch.referenceNote) || '',
    createdBy: buildUserSummary(batch.createdBy),
    submittedAt: batch.submittedAt || null,
    submittedBy: buildUserSummary(batch.submittedBy),
    finalizedAt: batch.finalizedAt || null,
    finalizedBy: buildUserSummary(batch.finalizedBy),
    reopenedAt: batch.reopenedAt || null,
    reopenedBy: buildUserSummary(batch.reopenedBy),
    reopenReason: normalizeText(batch.reopenReason) || null,
    createdAt: batch.createdAt || null,
    updatedAt: batch.updatedAt || null,
    currentRevision: buildCurrentRevisionSummary(batch, saleItems),
    revisionHistory: Array.isArray(batch.revisions) ? batch.revisions.map(buildRevisionSummary) : [],
    items: saleItems.map(buildSaleSummary),
  }
}

const buildBatchSummary = (batch = {}) => ({
  _id: batch._id,
  batchRef: batch.batchRef || null,
  status: normalizeText(batch.status) || 'draft',
  revision: toNumber(batch.revision) ?? 1,
  itemCount: toNumber(batch.itemCount) ?? 0,
  totals: batch.totals || buildBatchTotals([]),
})

const resolveAccessibleBatchFilter = (actor = {}) => {
  if (actor?.role === 'admin') {
    return null
  }

  const actorId = resolveIdValue(actor?.id || actor?._id)
  if (!actorId) {
    return null
  }

  return {
    $or: [
      { assignedSalesmanId: actorId },
      { salesmanId: actorId },
    ],
  }
}

const ensureBatchAccessible = (batch = {}, actor = {}) => {
  if (actor?.role === 'admin') {
    return true
  }

  const actorId = resolveIdValue(actor?.id || actor?._id)
  const allowedIds = [
    resolveIdValue(batch.assignedSalesmanId),
    resolveIdValue(batch.salesmanId),
  ].filter(Boolean)

  if (!actorId || !allowedIds.includes(actorId)) {
    throw new BatchServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  return true
}

const ensureBatchMutationAllowed = (batch = {}, actor = {}) => {
  ensureBatchAccessible(batch, actor)

  const currentStatus = normalizeText(batch.status).toLowerCase()
  if (!['draft', 'open', 'reopened'].includes(currentStatus)) {
    throw new BatchServiceError('Batch is not open for item updates', 'BATCH_LOCKED', 409)
  }

  if (actor?.role === 'salesman') {
    const actorId = resolveIdValue(actor.id || actor._id)
    const assignedId = resolveIdValue(batch.assignedSalesmanId)
    if (!actorId || actorId !== assignedId) {
      throw new BatchServiceError('Batch is not assigned to you', 'FORBIDDEN', 403)
    }
  }

  if (actor?.role === 'salesman' && !canSalesmanAddItems(batch)) {
    throw new BatchServiceError('Batch is not assigned to you or cannot accept items', 'FORBIDDEN', 403)
  }

  return true
}

const ensureBatchTransitionable = (batch = {}, nextStatus, actor = {}) => {
  ensureBatchAccessible(batch, actor)
  assertAllowedTransition(batch.status, nextStatus, { allowAdminCorrection: actor?.role === 'admin' })
}

const loadBatchDocument = async (id) => {
  return ScanBatch.findById(id)
    .populate('supplierId', 'name code isActive')
    .populate('salesmanId', 'name email phone role isActive')
    .populate('assignedSalesmanId', 'name email phone role isActive')
    .populate('createdBy', 'name email phone role isActive')
    .populate('submittedBy', 'name email phone role isActive')
    .populate('finalizedBy', 'name email phone role isActive')
    .populate('reopenedBy', 'name email phone role isActive')
}

const loadBatchSales = async (batchId) => {
  return Sale.find({ batchId })
    .sort({ addedAt: 1, saleDate: 1, createdAt: 1, _id: 1 })
    .populate('supplier', 'name code isActive')
    .populate('salesman', 'name email phone role isActive')
    .populate('addedBy', 'name email phone role isActive')
    .lean()
}

const loadBatchDetail = async (batchId, actor = {}) => {
  const batch = await loadBatchDocument(batchId)
  if (!batch) {
    throw new BatchServiceError('Batch not found', 'NOT_FOUND', 404)
  }

  ensureBatchAccessible(batch, actor)
  const items = await loadBatchSales(batch._id)
  return buildBatchDetailResponse(batch.toObject(), items)
}

const normalizeCreateStatus = (value, actor = {}) => {
  const requested = normalizeText(value).toLowerCase()
  if (requested) {
    if (!['draft', 'open'].includes(requested)) {
      throw new BatchServiceError('Invalid batch status', 'INVALID_STATUS', 400)
    }
    return requested
  }

  return actor?.role === 'salesman' ? 'open' : 'draft'
}

const resolveAssignedSalesman = async (body = {}, actor = {}) => {
  const raw = actor?.role === 'salesman'
    ? actor.id
    : body.assignedSalesmanId || body.salesmanId
  const assignedSalesmanId = resolveIdValue(raw)

  if (!assignedSalesmanId) {
    throw new BatchServiceError('Assigned salesman is required', 'VALIDATION_ERROR', 400)
  }

  if (!mongoose.isValidObjectId(assignedSalesmanId)) {
    throw new BatchServiceError('Invalid salesman id', 'INVALID_ID', 400)
  }

  const salesman = await User.findById(assignedSalesmanId).lean()
  if (!salesman) {
    throw new BatchServiceError('Assigned salesman not found', 'NOT_FOUND', 404)
  }

  if (salesman.role !== 'salesman') {
    throw new BatchServiceError('Assigned user must be a salesman', 'VALIDATION_ERROR', 400)
  }

  return salesman
}

const resolveSupplier = async (body = {}) => {
  const supplierId = resolveIdValue(body.supplierId || body.supplier)
  if (!supplierId) {
    throw new BatchServiceError('Supplier is required', 'VALIDATION_ERROR', 400)
  }

  if (!mongoose.isValidObjectId(supplierId)) {
    throw new BatchServiceError('Invalid supplier id', 'INVALID_ID', 400)
  }

  const supplier = await Supplier.findById(supplierId).lean()
  if (!supplier) {
    throw new BatchServiceError('Supplier not found', 'NOT_FOUND', 404)
  }

  return supplier
}

const resolveMutationBatch = async (id, actor = {}) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new BatchServiceError('Invalid batch id', 'INVALID_ID', 400)
  }

  const batch = await loadBatchDocument(id)
  if (!batch) {
    throw new BatchServiceError('Batch not found', 'NOT_FOUND', 404)
  }

  ensureBatchAccessible(batch, actor)
  return batch
}

const resolveBatchSalesByIds = async (saleIds = []) => {
  const uniqueIds = [...new Set(
    saleIds
      .map((saleId) => resolveIdValue(saleId))
      .filter(Boolean)
  )]

  if (uniqueIds.length === 0) {
    throw new BatchServiceError('At least one sale item is required', 'BATCH_EMPTY', 400)
  }

  for (const saleId of uniqueIds) {
    if (!mongoose.isValidObjectId(saleId)) {
      throw new BatchServiceError(`Invalid sale id: ${saleId}`, 'INVALID_ID', 400)
    }
  }

  const sales = await Sale.find({ _id: { $in: uniqueIds } })
    .populate('supplier', 'name code isActive')
    .populate('salesman', 'name email phone role isActive')
    .populate('addedBy', 'name email phone role isActive')
    .lean()

  if (sales.length !== uniqueIds.length) {
    throw new BatchServiceError('One or more sale items were not found', 'NOT_FOUND', 404)
  }

  const byId = new Map(sales.map((sale) => [resolveIdValue(sale._id), sale]))
  return uniqueIds.map((saleId) => byId.get(saleId))
}

const resolveSaleEntryMode = (sale = {}) => {
  const mode = normalizeText(sale.entryMode).toLowerCase()
  if (mode === 'qr_scan' || mode === 'manual' || mode === 'qr_scan_with_manual_override') {
    return mode
  }

  if (sale.qrRaw) {
    return sale.wasManuallyEdited === true ? 'qr_scan_with_manual_override' : 'qr_scan'
  }

  return 'manual'
}

const refreshBatchCountsAndTotals = async (batch = {}) => {
  const currentSales = await loadBatchSales(batch._id)
  const stats = buildBatchStats(currentSales)
  const currentEntryMode = stats.itemCount > 0 ? stats.entryMode : null
  batch.itemCount = stats.itemCount
  batch.totals = stats.totals
  batch.entryMode = currentEntryMode
  batch.warningsCount = stats.warningsCount
  batch.reviewCount = stats.reviewCount
  batch.duplicateCount = stats.duplicateCount
  batch.manualOverrideCount = stats.manualOverrideCount
  return { batch, currentSales }
}

export const refreshBatchAggregates = async (batchOrId = {}) => {
  const batchId = resolveIdValue(batchOrId?._id || batchOrId?.id || batchOrId)
  if (!batchId || !mongoose.isValidObjectId(batchId)) {
    throw new BatchServiceError('Invalid batch id', 'INVALID_ID', 400)
  }

  const batch = batchOrId && typeof batchOrId === 'object' && typeof batchOrId.save === 'function'
    ? batchOrId
    : await loadBatchDocument(batchId)

  if (!batch) {
    throw new BatchServiceError('Batch not found', 'NOT_FOUND', 404)
  }

  const { batch: batchDoc, currentSales } = await refreshBatchCountsAndTotals(batch)
  await batchDoc.save()
  const sessionSync = await syncParentSessionForBatchBestEffort(batchDoc, {
    operation: 'refreshBatchAggregates',
  })

  return {
    batch: batchDoc,
    currentSales,
    summary: buildBatchSummary(batchDoc),
    sessionSyncWarning: Boolean(sessionSync?.warning),
  }
}

export const listBatches = async ({ actor = {}, page = 1, limit = 20, supplier, assignedSalesman, status, entryMode, startDate, endDate, q, sortBy = 'updatedAt', sortOrder = 'desc' } = {}) => {
  const p = Math.max(1, Number.parseInt(page, 10) || 1)
  const l = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20))
  const skip = (p - 1) * l

  const andConditions = []
  const accessFilter = resolveAccessibleBatchFilter(actor)
  if (accessFilter) {
    andConditions.push(accessFilter)
  }

  if (status) {
    const normalizedStatus = normalizeStatusFilter(status)
    if (!normalizedStatus) {
      throw new BatchServiceError('Invalid batch status filter', 'INVALID_FILTER', 400)
    }
    andConditions.push({ status: normalizedStatus })
  }

  if (entryMode) {
    const normalizedEntryMode = normalizeEntryModeFilter(entryMode)
    if (!normalizedEntryMode) {
      throw new BatchServiceError('Invalid batch entry mode filter', 'INVALID_FILTER', 400)
    }
    andConditions.push({ entryMode: normalizedEntryMode })
  }

  if (startDate || endDate) {
    const saleDate = {}
    const start = normalizeDateInput(startDate)
    const end = normalizeDateInput(endDate)
    if (startDate && !start) {
      throw new BatchServiceError('Invalid start date', 'INVALID_FILTER', 400)
    }
    if (endDate && !end) {
      throw new BatchServiceError('Invalid end date', 'INVALID_FILTER', 400)
    }
    if (start) saleDate.$gte = start
    if (end) {
      const endOfDay = new Date(end)
      endOfDay.setHours(23, 59, 59, 999)
      saleDate.$lte = endOfDay
    }
    andConditions.push({ createdAt: saleDate })
  }

  if (supplier) {
    const supplierText = normalizeText(supplier)
    if (!supplierText) {
      throw new BatchServiceError('Invalid supplier filter', 'INVALID_FILTER', 400)
    }

    if (mongoose.isValidObjectId(supplierText)) {
      andConditions.push({ supplierId: supplierText })
    } else {
      const matches = await Supplier.find(
        {
          $or: [
            { name: { $regex: escapeRegex(supplierText), $options: 'i' } },
            { code: { $regex: escapeRegex(supplierText), $options: 'i' } },
          ],
        },
        { _id: 1 }
      ).lean()
      andConditions.push({ supplierId: { $in: matches.map((entry) => entry._id) } })
    }
  }

  if (assignedSalesman) {
    const salesmanText = normalizeText(assignedSalesman)
    if (!salesmanText) {
      throw new BatchServiceError('Invalid assigned salesman filter', 'INVALID_FILTER', 400)
    }

    if (mongoose.isValidObjectId(salesmanText)) {
      andConditions.push({ assignedSalesmanId: salesmanText })
    } else {
      const matches = await User.find(
        {
          $or: [
            { name: { $regex: escapeRegex(salesmanText), $options: 'i' } },
            { email: { $regex: escapeRegex(salesmanText), $options: 'i' } },
            { phone: { $regex: escapeRegex(salesmanText), $options: 'i' } },
          ],
        },
        { _id: 1 }
      ).lean()
      andConditions.push({ assignedSalesmanId: { $in: matches.map((entry) => entry._id) } })
    }
  }

  const searchText = normalizeText(q)
  if (searchText) {
    const searchOr = [
      { batchRef: { $regex: escapeRegex(searchText), $options: 'i' } },
      { customerName: { $regex: escapeRegex(searchText), $options: 'i' } },
      { customerPhone: { $regex: escapeRegex(searchText), $options: 'i' } },
      { referenceNote: { $regex: escapeRegex(searchText), $options: 'i' } },
    ]

    const supplierMatches = await Supplier.find(
      {
        $or: [
          { name: { $regex: escapeRegex(searchText), $options: 'i' } },
          { code: { $regex: escapeRegex(searchText), $options: 'i' } },
        ],
      },
      { _id: 1 }
    ).lean()
    if (supplierMatches.length > 0) {
      searchOr.push({ supplierId: { $in: supplierMatches.map((entry) => entry._id) } })
    }

    const salesmanMatches = await User.find(
      {
        $or: [
          { name: { $regex: escapeRegex(searchText), $options: 'i' } },
          { email: { $regex: escapeRegex(searchText), $options: 'i' } },
          { phone: { $regex: escapeRegex(searchText), $options: 'i' } },
        ],
      },
      { _id: 1 }
    ).lean()
    if (salesmanMatches.length > 0) {
      searchOr.push({ assignedSalesmanId: { $in: salesmanMatches.map((entry) => entry._id) } })
      searchOr.push({ salesmanId: { $in: salesmanMatches.map((entry) => entry._id) } })
    }

    andConditions.push({ $or: searchOr })
  }

  const query = andConditions.length > 0 ? { $and: andConditions } : {}

  const sortMap = {
    batchRef: { batchRef: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 },
    createdAt: { createdAt: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 },
    updatedAt: { updatedAt: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 },
    status: { status: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1, updatedAt: -1 },
    revision: { revision: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1, updatedAt: -1 },
    itemCount: { itemCount: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1, updatedAt: -1 },
    submittedAt: { submittedAt: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1, updatedAt: -1 },
    finalizedAt: { finalizedAt: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1, updatedAt: -1 },
    entryMode: { entryMode: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1, updatedAt: -1 },
  }
  const sort = sortMap[sortBy] || { updatedAt: -1 }

  const [batches, total] = await Promise.all([
    ScanBatch.find(query)
      .sort(sort)
      .skip(skip)
      .limit(l)
      .populate('supplierId', 'name code isActive')
      .populate('assignedSalesmanId', 'name email phone role isActive')
      .lean(),
    ScanBatch.countDocuments(query),
  ])

  return {
    batches: batches.map(buildBatchListItem),
    total,
    page: p,
    pages: Math.ceil(total / l),
    limit: l,
    sortBy: sortBy || 'updatedAt',
    sortOrder: String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc',
  }
}

export const getBatchDetail = async ({ id, actor = {} } = {}) => {
  const batch = await resolveMutationBatch(id, actor)
  const items = await loadBatchSales(batch._id)
  return buildBatchDetailResponse(batch.toObject(), items)
}

export const getBatchRevisions = async ({ id, actor = {} } = {}) => {
  const batch = await resolveMutationBatch(id, actor)
  const items = await loadBatchSales(batch._id)

  return {
    _id: batch._id,
    batchRef: batch.batchRef || null,
    status: normalizeText(batch.status) || 'draft',
    revision: toNumber(batch.revision) ?? 1,
    currentRevision: buildCurrentRevisionSummary(batch.toObject(), items),
    revisionHistory: Array.isArray(batch.revisions) ? batch.revisions.map(buildRevisionSummary) : [],
  }
}

export const createBatch = async ({ body = {}, actor = {}, sessionId = null } = {}) => {
  if (actor?.role !== 'admin' && actor?.role !== 'salesman') {
    throw new BatchServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  const supplier = await resolveSupplier(body)
  const salesman = await resolveAssignedSalesman(body, actor)
  const status = normalizeCreateStatus(body.status, actor)
  const now = new Date()
  const batchRef = buildBatchRef({ supplierCode: supplier.code, createdAt: now })
  const customerName = normalizeText(body.customerName)
  const customerPhone = normalizeText(body.customerPhone)
  const referenceNote = normalizeText(body.referenceNote)

  const batch = await ScanBatch.create({
    batchRef,
    supplierId: supplier._id,
    supplierCode: supplier.code || null,
    sessionId,
    salesmanId: salesman._id,
    assignedSalesmanId: salesman._id,
    customerName,
    customerPhone,
    referenceNote,
    status,
    revision: 1,
    createdBy: actor.id || actor._id || null,
  })

  const detail = await getBatchDetail({ id: batch._id, actor })
  const sessionSync = await syncParentSessionForBatchBestEffort(batch, {
    operation: 'createBatch',
  })

  return sessionSync?.warning
    ? { ...detail, sessionSyncWarning: true }
    : detail
}

export const addBatchItems = async ({ id, body = {}, actor = {} } = {}) => {
  const batch = await resolveMutationBatch(id, actor)
  ensureBatchMutationAllowed(batch, actor)

  const saleIds = Array.isArray(body.saleIds)
    ? body.saleIds
    : body.saleId
      ? [body.saleId]
      : []
  const sales = await resolveBatchSalesByIds(saleIds)

  const batchId = resolveIdValue(batch._id)
  const now = new Date()

  for (const sale of sales) {
    const saleBatchId = resolveIdValue(sale.batchId)
    if (saleBatchId && saleBatchId !== batchId) {
      throw new BatchServiceError('Sale already belongs to another batch', 'SALE_ALREADY_IN_BATCH', 409)
    }

    const update = {}
    if (!saleBatchId) {
      update.batchId = batch._id
      update.revisionAdded = toNumber(batch.revision) ?? 1
      update.addedBy = actor.id || actor._id || null
      update.addedAt = now
    } else if (saleBatchId === batchId) {
      if (sale.revisionAdded === null || sale.revisionAdded === undefined) {
        update.revisionAdded = toNumber(batch.revision) ?? 1
      }
      if (!sale.addedAt) {
        update.addedAt = now
      }
    }

    if (!normalizeText(sale.entryMode)) {
      update.entryMode = resolveSaleEntryMode(sale)
    }

    if (Object.keys(update).length > 0) {
      await Sale.updateOne({ _id: sale._id }, { $set: update })
    }
  }

  const refreshed = await resolveMutationBatch(id, actor)
  const { batch: batchDoc, currentSales } = await refreshBatchCountsAndTotals(refreshed)
  batchDoc.status = normalizeText(batchDoc.status) === 'draft' ? 'open' : batchDoc.status
  batchDoc.entryMode = currentSales.length > 0 ? deriveBatchEntryMode(currentSales) : null
  await batchDoc.save()

  const detail = await getBatchDetail({ id: batchDoc._id, actor })
  const sessionSync = await syncParentSessionForBatchBestEffort(batchDoc, {
    operation: 'addBatchItems',
  })

  return sessionSync?.warning
    ? { ...detail, sessionSyncWarning: true }
    : detail
}

export const submitBatch = async ({ id, actor = {} } = {}) => {
  const batch = await resolveMutationBatch(id, actor)
  ensureBatchAccessible(batch, actor)

  if (actor?.role === 'salesman' && resolveIdValue(batch.assignedSalesmanId) !== resolveIdValue(actor.id || actor._id)) {
    throw new BatchServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  const saleItems = await loadBatchSales(batch._id)
  if (saleItems.length === 0) {
    throw new BatchServiceError('Batch requires at least one sale item', 'BATCH_EMPTY', 400)
  }

  const currentStatus = normalizeText(batch.status).toLowerCase()
  if (currentStatus === 'draft') {
    assertAllowedTransition('draft', 'open', { allowAdminCorrection: actor?.role === 'admin' })
    batch.status = 'open'
  }

  assertAllowedTransition(batch.status, 'submitted', { allowAdminCorrection: actor?.role === 'admin' })
  const stats = buildBatchStats(saleItems)

  batch.status = 'submitted'
  batch.submittedAt = new Date()
  batch.submittedBy = actor.id || actor._id || null
  batch.itemCount = stats.itemCount
  batch.totals = stats.totals
  batch.entryMode = stats.entryMode
  batch.warningsCount = stats.warningsCount
  batch.reviewCount = stats.reviewCount
  batch.duplicateCount = stats.duplicateCount
  batch.manualOverrideCount = stats.manualOverrideCount

  await batch.save()
  const detail = await getBatchDetail({ id: batch._id, actor })
  const sessionSync = await syncParentSessionForBatchBestEffort(batch, {
    operation: 'submitBatch',
  })

  return sessionSync?.warning
    ? { ...detail, sessionSyncWarning: true }
    : detail
}

export const finalizeBatch = async ({ id, actor = {} } = {}) => {
  if (actor?.role !== 'admin') {
    throw new BatchServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  const batch = await resolveMutationBatch(id, actor)
  const saleItems = await loadBatchSales(batch._id)
  const batchSnapshot = batch.toObject()
  batchSnapshot._id = resolveIdValue(batchSnapshot._id)
  batchSnapshot.supplierId = resolveIdValue(batchSnapshot.supplierId)
  batchSnapshot.salesmanId = resolveIdValue(batchSnapshot.salesmanId)
  batchSnapshot.assignedSalesmanId = resolveIdValue(batchSnapshot.assignedSalesmanId)
  batchSnapshot.createdBy = resolveIdValue(batchSnapshot.createdBy)
  batchSnapshot.submittedBy = resolveIdValue(batchSnapshot.submittedBy)
  batchSnapshot.finalizedBy = resolveIdValue(batchSnapshot.finalizedBy)
  batchSnapshot.reopenedBy = resolveIdValue(batchSnapshot.reopenedBy)
  batchSnapshot.revisions = Array.isArray(batchSnapshot.revisions)
    ? batchSnapshot.revisions.map((revision) => ({
        ...revision,
        finalizedBy: resolveIdValue(revision.finalizedBy),
        reopenedBy: resolveIdValue(revision.reopenedBy),
        saleIds: Array.isArray(revision.saleIds)
          ? revision.saleIds.map((saleId) => resolveIdValue(saleId)).filter(Boolean)
          : [],
      }))
    : []

  const normalizedSales = saleItems.map((sale) => ({
    ...sale,
    _id: resolveIdValue(sale._id),
    batchId: resolveIdValue(sale.batchId),
    supplier: resolveIdValue(sale.supplier),
    supplierId: resolveIdValue(sale.supplierId),
    salesman: resolveIdValue(sale.salesman),
    addedBy: resolveIdValue(sale.addedBy),
  }))

  const updated = finalizeBatchState(batchSnapshot, { actorId: actor.id || actor._id || null, saleItems: normalizedSales })

  batch.status = updated.status
  batch.revision = updated.revision
  batch.finalizedAt = updated.finalizedAt
  batch.finalizedBy = updated.finalizedBy
  batch.entryMode = updated.entryMode
  batch.itemCount = updated.itemCount
  batch.totals = updated.totals
  batch.warningsCount = updated.warningsCount
  batch.reviewCount = updated.reviewCount
  batch.duplicateCount = updated.duplicateCount
  batch.manualOverrideCount = updated.manualOverrideCount
  batch.revisions = updated.revisions

  await batch.save()
  const detail = await getBatchDetail({ id: batch._id, actor })
  const sessionSync = await syncParentSessionForBatchBestEffort(batch, {
    operation: 'finalizeBatch',
  })

  return sessionSync?.warning
    ? { ...detail, sessionSyncWarning: true }
    : detail
}

export const reopenBatch = async ({ id, body = {}, actor = {} } = {}) => {
  if (actor?.role !== 'admin') {
    throw new BatchServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  const batch = await resolveMutationBatch(id, actor)
  const updated = reopenBatchState(batch.toObject(), {
    actorId: actor.id || actor._id || null,
    reason: body.reason || body.reopenReason,
  })

  batch.status = updated.status
  batch.revision = updated.revision
  batch.reopenedAt = updated.reopenedAt
  batch.reopenedBy = updated.reopenedBy
  batch.reopenReason = updated.reopenReason
  batch.finalizedAt = updated.finalizedAt
  batch.finalizedBy = updated.finalizedBy

  await batch.save()
  const detail = await getBatchDetail({ id: batch._id, actor })
  const sessionSync = await syncParentSessionForBatchBestEffort(batch, {
    operation: 'reopenBatch',
  })

  return sessionSync?.warning
    ? { ...detail, sessionSyncWarning: true }
    : detail
}

export const updateBatchAssignment = async ({ id, body = {}, actor = {} } = {}) => {
  if (actor?.role !== 'admin') {
    throw new BatchServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  const batch = await resolveMutationBatch(id, actor)
  const currentStatus = normalizeText(batch.status).toLowerCase()
  if (['finalized', 'cancelled'].includes(currentStatus)) {
    throw new BatchServiceError('Batch assignment cannot be changed in the current state', 'BATCH_LOCKED', 409)
  }

  const targetId = resolveIdValue(body.assignedSalesmanId || body.salesmanId)
  if (!targetId) {
    throw new BatchServiceError('Assigned salesman is required', 'VALIDATION_ERROR', 400)
  }
  if (!mongoose.isValidObjectId(targetId)) {
    throw new BatchServiceError('Invalid salesman id', 'INVALID_ID', 400)
  }

  const targetSalesman = await User.findById(targetId).lean()
  if (!targetSalesman) {
    throw new BatchServiceError('Assigned salesman not found', 'NOT_FOUND', 404)
  }
  if (targetSalesman.role !== 'salesman') {
    throw new BatchServiceError('Assigned user must be a salesman', 'VALIDATION_ERROR', 400)
  }

  batch.assignedSalesmanId = targetSalesman._id
  batch.salesmanId = targetSalesman._id
  await batch.save()

  const detail = await getBatchDetail({ id: batch._id, actor })
  const sessionSync = await syncParentSessionForBatchBestEffort(batch, {
    operation: 'updateBatchAssignment',
  })

  return sessionSync?.warning
    ? { ...detail, sessionSyncWarning: true }
    : detail
}

export const batchService = {
  listBatches,
  getBatchDetail,
  getBatchRevisions,
  createBatch,
  addBatchItems,
  refreshBatchAggregates,
  submitBatch,
  finalizeBatch,
  reopenBatch,
  updateBatchAssignment,
}

export {
  BatchServiceError,
  buildBatchDetailResponse,
  buildBatchSummary,
  buildBatchListItem,
  buildBatchStats,
  buildCurrentRevisionSummary,
  buildSaleSummary,
  buildUserSummary,
  buildSupplierSummary,
  ensureBatchAccessible,
  ensureBatchMutationAllowed,
}
