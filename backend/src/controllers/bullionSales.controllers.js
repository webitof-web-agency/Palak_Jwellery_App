import { BullionServiceError, createBullionSale as createBullionSaleService, getBullionInventory as getBullionInventoryService, getBullionSaleDetail as getBullionSaleDetailService, getBullionSalesAnalyticsSummary as getBullionSalesAnalyticsSummaryService, listBullionPurchaseOrders as listBullionPurchaseOrdersService, listBullionSales as listBullionSalesService, listBullionSalesByCustomer as listBullionSalesByCustomerService, markBullionPurchaseOrderDone as markBullionPurchaseOrderDoneService, updateBullionInventory as updateBullionInventoryService, createBullionPurchaseOrder as createBullionPurchaseOrderService } from '../services/bullionSales.service.js'

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

const handleBullionError = (res, operation, error) => {
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

  if (error instanceof BullionServiceError || error?.statusCode) {
    const status = error.statusCode || 400
    const extra = error.details ? { details: error.details } : {}
    return sendError(res, status, error.message || 'Bullion operation failed', error.code || 'BULLION_ERROR', extra)
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

  return sendError(res, 500, 'Failed to process bullion request', 'SERVER_ERROR')
}

export const createBullionSale = async (req, res) => {
  try {
    const data = await createBullionSaleService({ body: req.body, actor: req.user })
    return sendSuccess(res, data, 'Bullion sale created', 201)
  } catch (error) {
    return handleBullionError(res, 'createBullionSale', error)
  }
}

export const listBullionSales = async (req, res) => {
  try {
    const data = await listBullionSalesService({ actor: req.user, query: req.query })
    return sendSuccess(res, data)
  } catch (error) {
    return handleBullionError(res, 'listBullionSales', error)
  }
}

export const getBullionSaleDetail = async (req, res) => {
  try {
    const data = await getBullionSaleDetailService({ id: req.params.id, actor: req.user })
    return sendSuccess(res, data)
  } catch (error) {
    return handleBullionError(res, 'getBullionSaleDetail', error)
  }
}

export const listBullionSalesByCustomer = async (req, res) => {
  try {
    const data = await listBullionSalesByCustomerService({
      customerId: req.params.customerId,
      actor: req.user,
      query: req.query,
    })
    return sendSuccess(res, data)
  } catch (error) {
    return handleBullionError(res, 'listBullionSalesByCustomer', error)
  }
}

export const getBullionSalesAnalyticsSummary = async (req, res) => {
  try {
    const data = await getBullionSalesAnalyticsSummaryService({ actor: req.user, query: req.query })
    return sendSuccess(res, data)
  } catch (error) {
    return handleBullionError(res, 'getBullionSalesAnalyticsSummary', error)
  }
}

export const getBullionInventory = async (req, res) => {
  try {
    const data = await getBullionInventoryService()
    return sendSuccess(res, data)
  } catch (error) {
    return handleBullionError(res, 'getBullionInventory', error)
  }
}

export const updateBullionInventory = async (req, res) => {
  try {
    const data = await updateBullionInventoryService({ body: req.body, actor: req.user })
    return sendSuccess(res, data, 'Bullion inventory updated')
  } catch (error) {
    return handleBullionError(res, 'updateBullionInventory', error)
  }
}

export const createBullionPurchaseOrder = async (req, res) => {
  try {
    const data = await createBullionPurchaseOrderService({ body: req.body, actor: req.user })
    return sendSuccess(res, data, 'Purchase order created', 201)
  } catch (error) {
    return handleBullionError(res, 'createBullionPurchaseOrder', error)
  }
}

export const listBullionPurchaseOrders = async (req, res) => {
  try {
    const data = await listBullionPurchaseOrdersService({ query: req.query })
    return sendSuccess(res, data)
  } catch (error) {
    return handleBullionError(res, 'listBullionPurchaseOrders', error)
  }
}

export const markBullionPurchaseOrderDone = async (req, res) => {
  try {
    const data = await markBullionPurchaseOrderDoneService({ id: req.params.id, body: req.body })
    return sendSuccess(res, data, 'Purchase order marked done')
  } catch (error) {
    return handleBullionError(res, 'markBullionPurchaseOrderDone', error)
  }
}

