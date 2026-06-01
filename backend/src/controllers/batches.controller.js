import { BatchLifecycleError } from '../services/batchLifecycle.service.js'
import {
  BatchServiceError,
  addBatchItems as addBatchItemsService,
  createBatch as createBatchService,
  finalizeBatch as finalizeBatchService,
  getBatchDetail as getBatchDetailService,
  getBatchRevisions as getBatchRevisionsService,
  listBatches as listBatchesService,
  reopenBatch as reopenBatchService,
  submitBatch as submitBatchService,
  updateBatchAssignment as updateBatchAssignmentService,
} from '../services/batch.service.js'

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

const handleBatchError = (res, operation, error) => {
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

  if (error instanceof BatchLifecycleError || error instanceof BatchServiceError || error?.statusCode) {
    const status = error.statusCode || 400
    const extra = error.details ? { details: error.details } : {}
    return sendError(res, status, error.message || 'Batch operation failed', error.code || 'BATCH_ERROR', extra)
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

  return sendError(res, 500, 'Failed to process batch', 'SERVER_ERROR')
}

export const listBatches = async (req, res) => {
  try {
    const data = await listBatchesService({
      actor: req.user,
      page: req.query.page,
      limit: req.query.limit,
      supplier: req.query.supplier,
      assignedSalesman: req.query.assignedSalesman,
      status: req.query.status,
      entryMode: req.query.entryMode,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      q: req.query.q,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    })

    return sendSuccess(res, data)
  } catch (error) {
    return handleBatchError(res, 'listBatches', error)
  }
}

export const getBatchDetail = async (req, res) => {
  try {
    const data = await getBatchDetailService({ id: req.params.id, actor: req.user })
    return sendSuccess(res, data)
  } catch (error) {
    return handleBatchError(res, 'getBatchDetail', error)
  }
}

export const getBatchRevisions = async (req, res) => {
  try {
    const data = await getBatchRevisionsService({ id: req.params.id, actor: req.user })
    return sendSuccess(res, data)
  } catch (error) {
    return handleBatchError(res, 'getBatchRevisions', error)
  }
}

export const createBatch = async (req, res) => {
  try {
    const data = await createBatchService({ body: req.body, actor: req.user })
    return sendSuccess(res, data, 'Batch created', 201)
  } catch (error) {
    return handleBatchError(res, 'createBatch', error)
  }
}

export const addBatchItems = async (req, res) => {
  try {
    const data = await addBatchItemsService({ id: req.params.id, body: req.body, actor: req.user })
    return sendSuccess(res, data, 'Batch items updated')
  } catch (error) {
    return handleBatchError(res, 'addBatchItems', error)
  }
}

export const submitBatch = async (req, res) => {
  try {
    const data = await submitBatchService({ id: req.params.id, actor: req.user })
    return sendSuccess(res, data, 'Batch submitted')
  } catch (error) {
    return handleBatchError(res, 'submitBatch', error)
  }
}

export const finalizeBatch = async (req, res) => {
  try {
    const data = await finalizeBatchService({ id: req.params.id, actor: req.user })
    return sendSuccess(res, data, 'Batch finalized')
  } catch (error) {
    return handleBatchError(res, 'finalizeBatch', error)
  }
}

export const reopenBatch = async (req, res) => {
  try {
    const data = await reopenBatchService({ id: req.params.id, body: req.body, actor: req.user })
    return sendSuccess(res, data, 'Batch reopened')
  } catch (error) {
    return handleBatchError(res, 'reopenBatch', error)
  }
}

export const updateBatchAssignment = async (req, res) => {
  try {
    const data = await updateBatchAssignmentService({ id: req.params.id, body: req.body, actor: req.user })
    return sendSuccess(res, data, 'Batch assignment updated')
  } catch (error) {
    return handleBatchError(res, 'updateBatchAssignment', error)
  }
}
