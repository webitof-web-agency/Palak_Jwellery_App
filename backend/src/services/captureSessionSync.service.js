import mongoose from 'mongoose'
import { CaptureSession } from '../models/CaptureSession.js'
import { ScanBatch } from '../models/ScanBatch.js'
import {
  buildSessionSummary,
  calculateSessionTotals,
  validateUniqueSupplierBatches,
} from './captureSessionLifecycle.service.js'
import { toText } from './qrParser.shared.js'

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

const normalizeChildBatchStatus = (value) => normalizeText(value).toLowerCase()

const isCancelledBatch = (batch = {}) => normalizeChildBatchStatus(batch?.status) === 'cancelled'
const isActiveBatch = (batch = {}) => ['draft', 'open', 'reopened'].includes(normalizeChildBatchStatus(batch?.status))

const determineSessionStatusFromChildren = (sessionStatus, childBatches = []) => {
  const current = normalizeText(sessionStatus).toLowerCase() || 'draft'
  const activeBatches = Array.isArray(childBatches)
    ? childBatches.filter((batch) => !isCancelledBatch(batch))
    : []

  if (current === 'cancelled') {
    return 'cancelled'
  }

  if (activeBatches.length === 0) {
    return 'draft'
  }

  if (activeBatches.some((batch) => isActiveBatch(batch))) {
    return 'open'
  }

  if (current === 'draft') {
    return 'open'
  }

  if (current === 'submitted' || current === 'finalized') {
    return current
  }

  return current || 'open'
}

const loadSessionBatches = async (sessionId) => {
  return ScanBatch.find({ sessionId })
    .sort({ createdAt: 1, _id: 1 })
    .populate('supplierId', 'name code isActive')
    .populate('assignedSalesmanId', 'name email phone role isActive')
    .populate('salesmanId', 'name email phone role isActive')
    .lean()
}

const refreshSessionDocument = async (session, { operation = 'captureSessionSync', strict = false } = {}) => {
  const childBatches = await loadSessionBatches(session._id)
  validateUniqueSupplierBatches(childBatches)

  const nextStatus = determineSessionStatusFromChildren(session.status, childBatches)
  const totals = calculateSessionTotals(childBatches)
  const summaryBeforeSave = buildSessionSummary(
    {
      ...session.toObject(),
      status: nextStatus,
      totals,
    },
    childBatches
  )

  session.batchIds = childBatches.map((batch) => resolveIdValue(batch._id)).filter(Boolean)
  session.totals = totals
  session.warningsCount = summaryBeforeSave.warningsCount
  session.reviewCount = summaryBeforeSave.reviewCount
  session.duplicateCount = summaryBeforeSave.duplicateCount
  session.manualOverrideCount = summaryBeforeSave.manualOverrideCount
  session.status = nextStatus

  try {
    await session.save()
    const saved = session.toObject()
    const summary = buildSessionSummary(saved, childBatches)
    return {
      synced: true,
      warning: false,
      session,
      childBatches,
      sessionSummary: summary,
      summary,
      operation,
    }
  } catch (error) {
    const fallbackSummary = buildSessionSummary(
      {
        ...session.toObject(),
        status: nextStatus,
        totals,
      },
      childBatches
    )
    return handleSessionSyncError(error, {
      operation,
      strict,
      fallbackSessionSummary: fallbackSummary,
      fallbackSummary,
    })
  }
}

const handleSessionSyncError = (error, { operation = 'captureSessionSync', context = null, strict = false, fallbackSessionSummary = null, fallbackSummary = null } = {}) => {
  const safeContext = context && typeof context === 'object'
    ? {
        operation,
        ...Object.fromEntries(
          Object.entries(context).filter(([, value]) => {
            return ['string', 'number', 'boolean'].includes(typeof value) || value === null
          })
        ),
      }
    : { operation }

  console.error(`${operation} warning:`, {
    ...safeContext,
    name: error?.name,
    message: error?.message,
    code: error?.code,
  })

  if (strict) {
    throw error
  }

  return {
    synced: false,
    warning: true,
    sessionSummary: fallbackSessionSummary,
    summary: fallbackSummary,
    operation,
  }
}

export const refreshCaptureSessionAggregate = async (sessionOrId, { operation = 'refreshCaptureSessionAggregate', strict = false, context = null } = {}) => {
  try {
    const resolvedId = resolveIdValue(sessionOrId?._id || sessionOrId?.id || sessionOrId)
    if (!resolvedId || !mongoose.isValidObjectId(resolvedId)) {
      throw new Error('Invalid session id')
    }

    const session = sessionOrId && typeof sessionOrId === 'object' && typeof sessionOrId.save === 'function'
      ? sessionOrId
      : await CaptureSession.findById(resolvedId)
          .populate('assignedSalesmanId', 'name email phone role isActive')
          .populate('createdBy', 'name email phone role isActive')
          .populate('submittedBy', 'name email phone role isActive')
          .populate('finalizedBy', 'name email phone role isActive')
          .populate('cancelledBy', 'name email phone role isActive')

    if (!session) {
      throw new Error('Session not found')
    }

    return await refreshSessionDocument(session, { operation, strict })
  } catch (error) {
    return handleSessionSyncError(error, { operation, context, strict })
  }
}

export const syncParentSessionForBatchBestEffort = async (batchOrBatchId, context = {}) => {
  try {
    const batchId = resolveIdValue(batchOrBatchId?._id || batchOrBatchId?.id || batchOrBatchId)
    if (!batchId || !mongoose.isValidObjectId(batchId)) {
      return { skipped: true, warning: false, synced: false, sessionSummary: null }
    }

    const batch = batchOrBatchId && typeof batchOrBatchId === 'object' && batchOrBatchId.sessionId !== undefined
      ? batchOrBatchId
      : await ScanBatch.findById(batchId).lean()

    if (!batch) {
      return { skipped: true, warning: false, synced: false, sessionSummary: null }
    }

    const sessionId = resolveIdValue(batch.sessionId)
    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return { skipped: true, warning: false, synced: false, sessionSummary: null }
    }

    const result = await refreshCaptureSessionAggregate(sessionId, {
      operation: context.operation || 'syncParentSessionForBatchBestEffort',
      strict: false,
      context: {
        batchId,
        sessionId,
        batchRef: normalizeText(batch.batchRef) || null,
      },
    })

    return {
      ...result,
      skipped: false,
    }
  } catch (error) {
    console.error('syncParentSessionForBatchBestEffort warning:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      batchId: resolveIdValue(batchOrBatchId?._id || batchOrBatchId?.id || batchOrBatchId) || null,
    })
    return {
      skipped: false,
      warning: true,
      synced: false,
      sessionSummary: null,
      summary: null,
    }
  }
}
