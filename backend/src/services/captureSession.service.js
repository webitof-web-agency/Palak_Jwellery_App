import mongoose from 'mongoose'
import { CaptureSession } from '../models/CaptureSession.js'
import { ScanBatch } from '../models/ScanBatch.js'
import { Supplier } from '../models/Supplier.js'
import { User } from '../models/User.js'
import { createBatch as createBatchService, buildBatchSummary, buildUserSummary, buildSupplierSummary } from './batch.service.js'
import { refreshCaptureSessionAggregate, syncParentSessionForBatchBestEffort } from './captureSessionSync.service.js'
import {
  assertAllowedSessionTransition,
  buildSessionRef,
  buildSessionSummary as buildLifecycleSessionSummary,
  calculateSessionTotals,
  canFinalizeSession,
  canSessionAcceptBatches,
  canSubmitSession,
  validateUniqueSupplierBatches,
} from './captureSessionLifecycle.service.js'
import { toNumber, toText } from './qrParser.shared.js'

class CaptureSessionServiceError extends Error {
  constructor(message, code = 'CAPTURE_SESSION_SERVICE_ERROR', statusCode = 400, details = null) {
    super(message)
    this.name = 'CaptureSessionServiceError'
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

const buildSessionUserSummary = (user) => buildUserSummary(user)
const buildSessionSupplierSummary = (supplier) => buildSupplierSummary(supplier)

const buildChildBatchSummary = (batch = {}) => ({
  id: resolveIdValue(batch._id) || null,
  _id: batch._id || null,
  batchRef: normalizeText(batch.batchRef) || null,
  supplier: buildSessionSupplierSummary(batch.supplierId),
  assignedSalesman: buildSessionUserSummary(batch.assignedSalesmanId),
  status: normalizeText(batch.status) || 'draft',
  revision: toNumber(batch.revision) ?? 1,
  itemCount: toNumber(batch.itemCount) ?? 0,
  totals: batch.totals || {
    grossWeight: 0,
    stoneWeight: 0,
    otherWeight: 0,
    netWeight: 0,
    fineWeight: 0,
    stoneAmount: 0,
  },
  warningsCount: toNumber(batch.warningsCount) ?? 0,
  reviewCount: toNumber(batch.reviewCount) ?? 0,
  duplicateCount: toNumber(batch.duplicateCount) ?? 0,
  manualOverrideCount: toNumber(batch.manualOverrideCount) ?? 0,
  createdAt: batch.createdAt || null,
  submittedAt: batch.submittedAt || null,
  finalizedAt: batch.finalizedAt || null,
  reopenedAt: batch.reopenedAt || null,
  reopenReason: normalizeText(batch.reopenReason) || null,
})

const buildSessionListItem = (session = {}) => ({
  id: resolveIdValue(session._id) || null,
  _id: session._id || null,
  sessionRef: normalizeText(session.sessionRef) || null,
  customerName: normalizeText(session.customerName) || '',
  customerPhone: normalizeText(session.customerPhone) || '',
  referenceNote: normalizeText(session.referenceNote) || '',
  assignedSalesman: buildSessionUserSummary(session.assignedSalesmanId),
  status: normalizeText(session.status) || 'draft',
  supplierCount: toNumber(session.totals?.supplierCount) ?? 0,
  itemCount: toNumber(session.totals?.itemCount) ?? 0,
  totals: session.totals || {
    supplierCount: 0,
    itemCount: 0,
    grossWeight: 0,
    stoneWeight: 0,
    otherWeight: 0,
    netWeight: 0,
    fineWeight: 0,
    stoneAmount: 0,
  },
  warningsCount: toNumber(session.warningsCount) ?? 0,
  reviewCount: toNumber(session.reviewCount) ?? 0,
  duplicateCount: toNumber(session.duplicateCount) ?? 0,
  manualOverrideCount: toNumber(session.manualOverrideCount) ?? 0,
  createdAt: session.createdAt || null,
  updatedAt: session.updatedAt || null,
  submittedAt: session.submittedAt || null,
  finalizedAt: session.finalizedAt || null,
})

const buildSessionDetail = (session = {}, scanBatches = []) => {
  const summary = buildLifecycleSessionSummary(session, scanBatches)
  return {
    ...summary,
    id: summary._id,
    _id: summary._id,
    assignedSalesman: buildSessionUserSummary(session.assignedSalesmanId),
    createdBy: buildSessionUserSummary(session.createdBy),
    submittedBy: buildSessionUserSummary(session.submittedBy),
    finalizedBy: buildSessionUserSummary(session.finalizedBy),
    cancelledBy: buildSessionUserSummary(session.cancelledBy),
    batchIds: Array.isArray(session.batchIds)
      ? session.batchIds.map((batchId) => resolveIdValue(batchId)).filter(Boolean)
      : [],
    batches: scanBatches.map(buildChildBatchSummary),
    submittedAt: session.submittedAt || null,
    finalizedAt: session.finalizedAt || null,
    cancelledAt: session.cancelledAt || null,
    cancelledBy: buildSessionUserSummary(session.cancelledBy),
    cancelReason: normalizeText(session.cancelReason) || null,
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
  }
}

const normalizeSessionStatusFilter = (value) => {
  const status = normalizeText(value).toLowerCase()
  return ['draft', 'open', 'submitted', 'finalized', 'cancelled'].includes(status) ? status : null
}

const normalizeSortOrder = (value) => String(value || '').toLowerCase() === 'asc' ? 'asc' : 'desc'

const resolveAssignedSalesman = async (body = {}, actor = {}) => {
  const raw = actor?.role === 'salesman' ? actor.id : body.assignedSalesmanId
  const assignedSalesmanId = resolveIdValue(raw)

  if (!assignedSalesmanId) {
    throw new CaptureSessionServiceError('Assigned salesman is required', 'VALIDATION_ERROR', 400)
  }

  if (!mongoose.isValidObjectId(assignedSalesmanId)) {
    throw new CaptureSessionServiceError('Invalid salesman id', 'INVALID_ID', 400)
  }

  const salesman = await User.findById(assignedSalesmanId).lean()
  if (!salesman) {
    throw new CaptureSessionServiceError('Assigned salesman not found', 'NOT_FOUND', 404)
  }

  if (salesman.role !== 'salesman') {
    throw new CaptureSessionServiceError('Assigned user must be a salesman', 'VALIDATION_ERROR', 400)
  }

  if (actor?.role === 'salesman' && resolveIdValue(actor.id) !== assignedSalesmanId) {
    throw new CaptureSessionServiceError('Salesman can only assign session to self', 'ASSIGNMENT_MISMATCH', 403)
  }

  return salesman
}

const resolveSessionById = async (sessionId) => {
  const resolvedId = resolveIdValue(sessionId)
  if (!resolvedId || !mongoose.isValidObjectId(resolvedId)) {
    throw new CaptureSessionServiceError('Invalid session id', 'INVALID_ID', 400)
  }

  const session = await CaptureSession.findById(resolvedId)
    .populate('assignedSalesmanId', 'name email phone role isActive')
    .populate('createdBy', 'name email phone role isActive')
    .populate('submittedBy', 'name email phone role isActive')
    .populate('finalizedBy', 'name email phone role isActive')
    .populate('cancelledBy', 'name email phone role isActive')

  if (!session) {
    throw new CaptureSessionServiceError('Session not found', 'NOT_FOUND', 404)
  }

  return session
}

const ensureSessionAccessible = (session = {}, actor = {}) => {
  if (actor?.role === 'admin') {
    return true
  }

  const actorId = resolveIdValue(actor?.id || actor?._id)
  const assignedId = resolveIdValue(session?.assignedSalesmanId)
  if (!actorId || !assignedId || actorId !== assignedId) {
    throw new CaptureSessionServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  return true
}

const ensureSessionAdminOnly = (actor = {}) => {
  if (actor?.role !== 'admin') {
    throw new CaptureSessionServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }
}

const loadSessionBatches = async (sessionId) => {
  return ScanBatch.find({ sessionId })
    .sort({ createdAt: 1, _id: 1 })
    .populate('supplierId', 'name code isActive')
    .populate('assignedSalesmanId', 'name email phone role isActive')
    .populate('salesmanId', 'name email phone role isActive')
    .lean()
}

const resolveSessionFilters = async ({ actor = {}, page = 1, limit = 20, status, assignedSalesman, q, startDate, endDate, sortBy = 'updatedAt', sortOrder = 'desc' } = {}) => {
  const p = Math.max(1, Number.parseInt(page, 10) || 1)
  const l = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20))
  const skip = (p - 1) * l
  const andConditions = []

  if (actor?.role !== 'admin') {
    const actorId = resolveIdValue(actor?.id || actor?._id)
    if (actorId) {
      andConditions.push({ assignedSalesmanId: actorId })
    }
  }

  if (status) {
    const normalizedStatus = normalizeSessionStatusFilter(status)
    if (!normalizedStatus) {
      throw new CaptureSessionServiceError('Invalid session status filter', 'INVALID_FILTER', 400)
    }
    andConditions.push({ status: normalizedStatus })
  }

  if (assignedSalesman) {
    const salesmanText = normalizeText(assignedSalesman)
    if (!salesmanText) {
      throw new CaptureSessionServiceError('Invalid assigned salesman filter', 'INVALID_FILTER', 400)
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

  const start = normalizeDateInput(startDate)
  const end = normalizeDateInput(endDate)
  if (startDate && !start) {
    throw new CaptureSessionServiceError('Invalid start date', 'INVALID_FILTER', 400)
  }
  if (endDate && !end) {
    throw new CaptureSessionServiceError('Invalid end date', 'INVALID_FILTER', 400)
  }
  if (start || end) {
    const createdAt = {}
    if (start) createdAt.$gte = start
    if (end) {
      const endOfDay = new Date(end)
      endOfDay.setHours(23, 59, 59, 999)
      createdAt.$lte = endOfDay
    }
    andConditions.push({ createdAt })
  }

  const searchText = normalizeText(q)
  if (searchText) {
    const searchOr = [
      { sessionRef: { $regex: escapeRegex(searchText), $options: 'i' } },
      { customerName: { $regex: escapeRegex(searchText), $options: 'i' } },
      { customerPhone: { $regex: escapeRegex(searchText), $options: 'i' } },
      { referenceNote: { $regex: escapeRegex(searchText), $options: 'i' } },
    ]

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
    }

    andConditions.push({ $or: searchOr })
  }

  const query = andConditions.length > 0 ? { $and: andConditions } : {}

  const sortMap = {
    sessionRef: { sessionRef: normalizeSortOrder(sortOrder) === 'asc' ? 1 : -1 },
    createdAt: { createdAt: normalizeSortOrder(sortOrder) === 'asc' ? 1 : -1 },
    updatedAt: { updatedAt: normalizeSortOrder(sortOrder) === 'asc' ? 1 : -1 },
    status: { status: normalizeSortOrder(sortOrder) === 'asc' ? 1 : -1, updatedAt: -1 },
    itemCount: { 'totals.itemCount': normalizeSortOrder(sortOrder) === 'asc' ? 1 : -1, updatedAt: -1 },
    supplierCount: { 'totals.supplierCount': normalizeSortOrder(sortOrder) === 'asc' ? 1 : -1, updatedAt: -1 },
    submittedAt: { submittedAt: normalizeSortOrder(sortOrder) === 'asc' ? 1 : -1, updatedAt: -1 },
    finalizedAt: { finalizedAt: normalizeSortOrder(sortOrder) === 'asc' ? 1 : -1, updatedAt: -1 },
  }

  return {
    p,
    l,
    skip,
    query,
    sort: sortMap[sortBy] || { updatedAt: -1 },
    sortBy: sortBy || 'updatedAt',
    sortOrder: normalizeSortOrder(sortOrder),
  }
}

const buildSessionListRow = (session = {}) => buildSessionListItem(session)

const refreshSessionAggregates = async (sessionOrId, actor = null) => {
  const resolvedId = resolveIdValue(sessionOrId?._id || sessionOrId?.id || sessionOrId)
  if (!resolvedId || !mongoose.isValidObjectId(resolvedId)) {
    throw new CaptureSessionServiceError('Invalid session id', 'INVALID_ID', 400)
  }

  const session = sessionOrId && typeof sessionOrId === 'object' && typeof sessionOrId.save === 'function'
    ? sessionOrId
    : await resolveSessionById(resolvedId)

  if (actor) {
    ensureSessionAccessible(session, actor)
  }

  const refreshed = await refreshCaptureSessionAggregate(session, {
    operation: 'refreshSessionAggregates',
    strict: true,
  })

  return {
    session: refreshed.session,
    childBatches: refreshed.childBatches,
    summary: refreshed.summary,
  }
}

const createSession = async ({ assignedSalesmanId, customerName, customerPhone, referenceNote, createdBy, actor = {} } = {}) => {
  if (actor?.role !== 'admin' && actor?.role !== 'salesman') {
    throw new CaptureSessionServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  const salesman = await resolveAssignedSalesman({ assignedSalesmanId }, actor)
  const now = new Date()
  const base = {
    customerName: normalizeText(customerName),
    customerPhone: normalizeText(customerPhone),
    referenceNote: normalizeText(referenceNote),
    assignedSalesmanId: salesman._id,
    status: 'draft',
    batchIds: [],
    totals: {
      supplierCount: 0,
      itemCount: 0,
      grossWeight: 0,
      stoneWeight: 0,
      otherWeight: 0,
      netWeight: 0,
      fineWeight: 0,
      stoneAmount: 0,
    },
    createdBy: resolveIdValue(createdBy || actor.id || actor._id) || null,
  }

  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sessionRef = buildSessionRef({ prefix: 'SESSION', createdAt: now, sequence: attempt === 0 ? null : attempt + 1 })
    try {
      const session = await CaptureSession.create({
        sessionRef,
        ...base,
      })
      return buildSessionListRow(session.toObject())
    } catch (error) {
      lastError = error
      if (error?.code !== 11000) {
        throw error
      }
    }
  }

  throw new CaptureSessionServiceError(
    'Failed to create session',
    'SERVER_ERROR',
    500,
    lastError ? { reason: lastError.message } : null
  )
}

const listSessions = async ({ actor = {}, page = 1, limit = 20, status, assignedSalesman, q, startDate, endDate, sortBy = 'updatedAt', sortOrder = 'desc' } = {}) => {
  const { p, l, skip, query, sort, sortBy: normalizedSortBy, sortOrder: normalizedSortOrder } =
    await resolveSessionFilters({ actor, page, limit, status, assignedSalesman, q, startDate, endDate, sortBy, sortOrder })

  const [sessions, total] = await Promise.all([
    CaptureSession.find(query)
      .sort(sort)
      .skip(skip)
      .limit(l)
      .populate('assignedSalesmanId', 'name email phone role isActive')
      .lean(),
    CaptureSession.countDocuments(query),
  ])

  return {
    sessions: sessions.map(buildSessionListRow),
    total,
    page: p,
    pages: Math.ceil(total / l),
    limit: l,
    sortBy: normalizedSortBy,
    sortOrder: normalizedSortOrder,
  }
}

const getSessionById = async (sessionId, actor = {}) => {
  const session = await resolveSessionById(sessionId)
  ensureSessionAccessible(session, actor)
  const childBatches = await loadSessionBatches(session._id)
  return buildSessionDetail(session.toObject(), childBatches)
}

const ensureSessionCanAcceptBatch = (session = {}, actor = {}) => {
  ensureSessionAccessible(session, actor)
  const status = normalizeText(session.status).toLowerCase()
  if (!canSessionAcceptBatches(session)) {
    throw new CaptureSessionServiceError('Session is not open for batch updates', 'SESSION_LOCKED', 409)
  }
  if (status === 'cancelled') {
    throw new CaptureSessionServiceError('Session is cancelled', 'SESSION_LOCKED', 409)
  }
}

const ensureSupplierNotDuplicatedInSession = async (sessionId, supplierId, excludeBatchId = null) => {
  const query = {
    sessionId,
    supplierId,
  }
  if (excludeBatchId) {
    query._id = { $ne: excludeBatchId }
  }

  const existing = await ScanBatch.findOne(query, { _id: 1 }).lean()
  if (existing) {
    throw new CaptureSessionServiceError('Supplier already exists in this session', 'SESSION_SUPPLIER_EXISTS', 409)
  }
}

const createSupplierBatchInSession = async ({ sessionId, supplierId, actor = {}, customerName, customerPhone, referenceNote } = {}) => {
  const session = await resolveSessionById(sessionId)
  ensureSessionCanAcceptBatch(session, actor)

  const supplierObjectId = resolveIdValue(supplierId)
  if (!supplierObjectId || !mongoose.isValidObjectId(supplierObjectId)) {
    throw new CaptureSessionServiceError('Invalid supplier id', 'INVALID_ID', 400)
  }

  const supplier = await Supplier.findById(supplierObjectId).lean()
  if (!supplier) {
    throw new CaptureSessionServiceError('Supplier not found', 'NOT_FOUND', 404)
  }

  await ensureSupplierNotDuplicatedInSession(session._id, supplier._id)

  const batchBody = {
    supplierId: supplier._id,
    customerName: customerName ?? session.customerName ?? '',
    customerPhone: customerPhone ?? session.customerPhone ?? '',
    referenceNote: referenceNote ?? session.referenceNote ?? '',
  }

  if (actor?.role === 'admin') {
    batchBody.assignedSalesmanId = resolveIdValue(session.assignedSalesmanId)
  }

  const createdBatch = await createBatchService({
    body: batchBody,
    actor,
    sessionId: session._id,
  })

  const refreshed = await syncParentSessionForBatchBestEffort(createdBatch, {
    operation: 'createSupplierBatchInSession',
  })
  const sessionSummary = refreshed.summary || buildLifecycleSessionSummary(
    session.toObject(),
    await loadSessionBatches(session._id)
  )
  return {
    session: sessionSummary,
    batch: buildBatchSummary(createdBatch),
    sessionSyncWarning: Boolean(refreshed.warning),
  }
}

const attachExistingBatchToSession = async ({ sessionId, batchId, actor = {} } = {}) => {
  const session = await resolveSessionById(sessionId)
  ensureSessionAdminOnly(actor)
  ensureSessionCanAcceptBatch(session, actor)

  const resolvedBatchId = resolveIdValue(batchId)
  if (!resolvedBatchId || !mongoose.isValidObjectId(resolvedBatchId)) {
    throw new CaptureSessionServiceError('Invalid batch id', 'INVALID_ID', 400)
  }

  const batch = await ScanBatch.findById(resolvedBatchId)
    .populate('supplierId', 'name code isActive')
    .populate('assignedSalesmanId', 'name email phone role isActive')
    .lean()

  if (!batch) {
    throw new CaptureSessionServiceError('Batch not found', 'NOT_FOUND', 404)
  }

  const linkedSessionId = resolveIdValue(batch.sessionId)
  if (linkedSessionId && linkedSessionId !== resolveIdValue(session._id)) {
    throw new CaptureSessionServiceError('Batch already belongs to another session', 'BATCH_ALREADY_SESSION_LINKED', 409)
  }

  const batchSupplierId = resolveIdValue(batch.supplierId)
  if (batchSupplierId) {
    await ensureSupplierNotDuplicatedInSession(session._id, batchSupplierId, batch._id)
  }

  const assignedId = resolveIdValue(session.assignedSalesmanId)
  const batchAssignedId = resolveIdValue(batch.assignedSalesmanId)
  if (batchAssignedId !== assignedId) {
    throw new CaptureSessionServiceError('Assignment mismatch', 'ASSIGNMENT_MISMATCH', 403)
  }

  const batchStatus = normalizeText(batch.status).toLowerCase()
  if (['finalized', 'cancelled'].includes(batchStatus)) {
    throw new CaptureSessionServiceError('Batch is not compatible with this session', 'SESSION_LOCKED', 409)
  }

  if (!linkedSessionId) {
    await ScanBatch.updateOne(
      { _id: batch._id },
      {
        $set: {
          sessionId: session._id,
        },
      }
    )
  }

  const refreshed = await syncParentSessionForBatchBestEffort(batch, {
    operation: 'attachExistingBatchToSession',
  })
  const sessionSummary = refreshed.summary || buildLifecycleSessionSummary(
    session.toObject(),
    await loadSessionBatches(session._id)
  )
  return {
    session: sessionSummary,
    batch: buildBatchSummary(batch),
    sessionSyncWarning: Boolean(refreshed.warning),
  }
}

const submitSession = async ({ sessionId, actor = {} } = {}) => {
  const session = await resolveSessionById(sessionId)
  ensureSessionAccessible(session, actor)

  if (actor?.role === 'salesman' && resolveIdValue(session.assignedSalesmanId) !== resolveIdValue(actor.id || actor._id)) {
    throw new CaptureSessionServiceError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  const refreshed = await refreshSessionAggregates(session._id)
  const childBatches = refreshed.childBatches.filter((batch) => normalizeText(batch.status).toLowerCase() !== 'cancelled')

  if (childBatches.length === 0) {
    throw new CaptureSessionServiceError('Session requires at least one batch', 'SESSION_EMPTY', 400)
  }

  if (!canSubmitSession(refreshed.session, childBatches)) {
    throw new CaptureSessionServiceError('Session has active batches', 'SESSION_ACTIVE_BATCHES', 409)
  }

  assertAllowedSessionTransition(session.status, 'submitted')

  session.status = 'submitted'
  session.submittedAt = new Date()
  session.submittedBy = resolveIdValue(actor.id || actor._id) || null
  await session.save()

  const updated = await refreshSessionAggregates(session._id)
  return updated.summary
}

const finalizeSession = async ({ sessionId, actor = {} } = {}) => {
  ensureSessionAdminOnly(actor)

  const session = await resolveSessionById(sessionId)
  const refreshed = await refreshSessionAggregates(session._id)
  const childBatches = refreshed.childBatches.filter((batch) => normalizeText(batch.status).toLowerCase() !== 'cancelled')

  if (childBatches.length === 0) {
    throw new CaptureSessionServiceError('Session requires at least one batch', 'SESSION_EMPTY', 400)
  }

  if (!canFinalizeSession(refreshed.session, childBatches)) {
    throw new CaptureSessionServiceError('Session has unfinalized batches', 'SESSION_UNFINALIZED_BATCHES', 409)
  }

  assertAllowedSessionTransition(session.status, 'finalized', { allowAdminCorrection: true })

  session.status = 'finalized'
  session.finalizedAt = new Date()
  session.finalizedBy = resolveIdValue(actor.id || actor._id) || null
  await session.save()

  const updated = await refreshSessionAggregates(session._id)
  return updated.summary
}

const cancelSession = async ({ sessionId, actor = {}, reason } = {}) => {
  ensureSessionAdminOnly(actor)
  const cancelReason = normalizeText(reason)
  if (!cancelReason) {
    throw new CaptureSessionServiceError('Cancel reason is required', 'CANCEL_REASON_REQUIRED', 400)
  }

  const session = await resolveSessionById(sessionId)
  const currentStatus = normalizeText(session.status).toLowerCase()
  if (!['draft', 'open'].includes(currentStatus)) {
    throw new CaptureSessionServiceError('Session cannot be cancelled in the current state', 'SESSION_LOCKED', 409)
  }

  assertAllowedSessionTransition(session.status, 'cancelled', { allowAdminCorrection: true })

  session.status = 'cancelled'
  session.cancelledAt = new Date()
  session.cancelledBy = resolveIdValue(actor.id || actor._id) || null
  session.cancelReason = cancelReason
  await session.save()

  const updated = await refreshSessionAggregates(session._id)
  return updated.summary
}

export const captureSessionService = {
  createSession,
  listSessions,
  getSessionById,
  createSupplierBatchInSession,
  attachExistingBatchToSession,
  submitSession,
  finalizeSession,
  cancelSession,
  refreshSessionAggregates,
  buildSessionDetail,
}

export {
  CaptureSessionServiceError,
  buildSessionDetail,
  buildSessionListItem,
  createSession,
  listSessions,
  getSessionById,
  createSupplierBatchInSession,
  attachExistingBatchToSession,
  submitSession,
  finalizeSession,
  cancelSession,
  refreshSessionAggregates,
}
