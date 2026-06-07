import { BatchServiceError } from '../services/batch.service.js'
import { CaptureSessionLifecycleError } from '../services/captureSessionLifecycle.service.js'
import {
  CaptureSessionServiceError,
  attachExistingBatchToSession as attachExistingBatchToSessionService,
  cancelSession as cancelSessionService,
  createSession as createSessionService,
  createSupplierBatchInSession as createSupplierBatchInSessionService,
  getSessionById as getSessionByIdService,
  listSessions as listSessionsService,
  refreshSessionAggregates as refreshSessionAggregatesService,
  finalizeSession as finalizeSessionService,
  submitSession as submitSessionService,
} from '../services/captureSession.service.js'

const sendSuccess = (res, data, message, status = 200) => {
  const payload = { success: true, data }
  if (message) payload.message = message
  return res.status(status).json(payload)
}

const sendError = (res, status, error, code, extra = {}) => {
  return res.status(status).json({ success: false, error, code, ...extra })
}

const mapValidationDetails = (error) => {
  if (error?.name !== 'ValidationError' || !error?.errors) {
    return null
  }

  const details = {}
  for (const [field, entry] of Object.entries(error.errors)) {
    details[field] = entry?.message || 'Invalid value'
  }
  return details
}

const handleSessionError = (res, operation, error) => {
  console.error(`${operation} error:`, {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    statusCode: error?.statusCode,
    stack: error?.stack,
  })

  if (error?.code === 11000) {
    return sendError(res, 409, 'Duplicate record', 'DUPLICATE_KEY')
  }

  if (error instanceof CaptureSessionServiceError || error instanceof CaptureSessionLifecycleError || error instanceof BatchServiceError || error?.statusCode) {
    const status = error.statusCode || 400
    const extra = error.details ? { details: error.details } : {}
    return sendError(res, status, error.message || 'Capture session operation failed', error.code || 'CAPTURE_SESSION_ERROR', extra)
  }

  const validationDetails = mapValidationDetails(error)
  if (validationDetails) {
    return sendError(res, 400, 'Validation failed', 'VALIDATION_ERROR', { details: validationDetails })
  }

  if (error?.name === 'CastError') {
    const field = error.path || 'value'
    return sendError(res, 400, `Invalid ${field}`, 'INVALID_VALUE', {
      details: {
        [field]: error.message || 'Invalid value',
      },
    })
  }

  return sendError(res, 500, 'Failed to process capture session', 'SERVER_ERROR')
}

export const listSessions = async (req, res) => {
  try {
    const data = await listSessionsService({
      actor: req.user,
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      assignedSalesman: req.query.assignedSalesman,
      q: req.query.q,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    })

    return sendSuccess(res, data)
  } catch (error) {
    return handleSessionError(res, 'listSessions', error)
  }
}

export const getSessionDetail = async (req, res) => {
  try {
    const data = await getSessionByIdService(req.params.id, req.user)
    return sendSuccess(res, data)
  } catch (error) {
    return handleSessionError(res, 'getSessionDetail', error)
  }
}

export const createSession = async (req, res) => {
  try {
    const data = await createSessionService({
      assignedSalesmanId: req.body.assignedSalesmanId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      referenceNote: req.body.referenceNote,
      createdBy: req.user?.id || req.user?._id || null,
      actor: req.user,
    })
    return sendSuccess(res, data, 'Capture session created', 201)
  } catch (error) {
    return handleSessionError(res, 'createSession', error)
  }
}

export const createSupplierBatchInSession = async (req, res) => {
  try {
    const data = await createSupplierBatchInSessionService({
      sessionId: req.params.id,
      supplierId: req.body.supplierId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      referenceNote: req.body.referenceNote,
      actor: req.user,
    })
    return sendSuccess(res, data, 'Supplier batch created in session', 201)
  } catch (error) {
    return handleSessionError(res, 'createSupplierBatchInSession', error)
  }
}

export const attachExistingBatchToSession = async (req, res) => {
  try {
    const data = await attachExistingBatchToSessionService({
      sessionId: req.params.id,
      batchId: req.body.batchId,
      actor: req.user,
    })
    return sendSuccess(res, data, 'Batch attached to session')
  } catch (error) {
    return handleSessionError(res, 'attachExistingBatchToSession', error)
  }
}

export const refreshSessionAggregates = async (req, res) => {
  try {
    const data = await refreshSessionAggregatesService(req.params.id, req.user)
    return sendSuccess(res, data.summary, 'Session aggregates refreshed')
  } catch (error) {
    return handleSessionError(res, 'refreshSessionAggregates', error)
  }
}

export const submitSession = async (req, res) => {
  try {
    const data = await submitSessionService({ sessionId: req.params.id, actor: req.user })
    return sendSuccess(res, data, 'Capture session submitted')
  } catch (error) {
    return handleSessionError(res, 'submitSession', error)
  }
}

export const finalizeSession = async (req, res) => {
  try {
    const data = await finalizeSessionService({ sessionId: req.params.id, actor: req.user })
    return sendSuccess(res, data, 'Capture session finalized')
  } catch (error) {
    return handleSessionError(res, 'finalizeSession', error)
  }
}

export const cancelSession = async (req, res) => {
  try {
    const data = await cancelSessionService({
      sessionId: req.params.id,
      reason: req.body.reason || req.body.cancelReason,
      actor: req.user,
    })
    return sendSuccess(res, data, 'Capture session cancelled')
  } catch (error) {
    return handleSessionError(res, 'cancelSession', error)
  }
}
