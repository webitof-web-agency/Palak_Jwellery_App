import mongoose from 'mongoose'
import { BullionInventory } from '../models/BullionInventory.js'
import { BullionPurchaseOrder } from '../models/BullionPurchaseOrder.js'
import { BullionSale } from '../models/BullionSale.js'
import { Customer } from '../models/Customer.js'
import { User } from '../models/User.js'

export class BullionServiceError extends Error {
  constructor(message, statusCode = 400, code = 'BULLION_ERROR', details = null) {
    super(message)
    this.name = 'BullionServiceError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const roundTo = (value, digits = 3) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Number(numeric.toFixed(digits))
}

const roundMoney = (value) => roundTo(value, 2)

const normalizeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const normalizeNullableText = (value) => {
  const text = normalizeText(value)
  return text ? text : null
}

const normalizeEmail = (value) => {
  const text = normalizeNullableText(value)
  return text ? text.toLowerCase() : null
}

const normalizePhone = (value) => {
  if (value === null || value === undefined) return null
  const digits = String(value).replace(/\D/g, '')
  return digits ? digits : null
}

const normalizeInputUnit = (value) => {
  const text = normalizeText(value).toLowerCase()
  if (text === 'per_kg' || text === 'perkg' || text === 'kg' || text === 'rs/kg' || text === 'rupees/kg') {
    return 'per_kg'
  }
  return 'per_gram'
}

const normalizeTransactionType = (value) => {
  const text = normalizeText(value).toLowerCase()
  if (text === 'return') return 'return'
  return 'sale'
}

const normalizeSyncStatus = (value) => {
  const text = normalizeText(value).toLowerCase()
  if (['pending', 'synced', 'failed'].includes(text)) {
    return text
  }
  return 'synced'
}

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(numeric) ? numeric : null
}

const parsePositiveNumber = (value, fieldName, { allowZero = false, max = null } = {}) => {
  const parsed = parseNumber(value)
  if (parsed === null || Number.isNaN(parsed)) {
    throw new BullionServiceError(`${fieldName} is required and must be a number`, 400, 'MISSING_FIELDS', { [fieldName]: 'Valid number required' })
  }
  if (!allowZero && parsed <= 0) {
    throw new BullionServiceError(`${fieldName} must be greater than 0`, 400, 'INVALID_VALUE', { [fieldName]: 'Must be greater than 0' })
  }
  if (allowZero && parsed < 0) {
    throw new BullionServiceError(`${fieldName} must be at least 0`, 400, 'INVALID_VALUE', { [fieldName]: 'Must be at least 0' })
  }
  if (max !== null && parsed > max) {
    throw new BullionServiceError(`${fieldName} must be at most ${max}`, 400, 'INVALID_VALUE', { [fieldName]: `Must be at most ${max}` })
  }
  return parsed
}

const parseOptionalDate = (value) => {
  const text = normalizeText(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

const toPlain = (doc) => {
  if (!doc) return null
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc }
  delete plain.__v
  return plain
}

const extractObjectId = (value) => {
  if (!value) return null
  if (typeof value === 'object') {
    return value._id || value.id || null
  }
  return value
}

const toSafeCustomer = (customer) => {
  if (!customer) return null
  const plain = toPlain(customer)
  if (!plain) return null
  return {
    _id: plain._id || null,
    id: plain._id?.toString?.() || plain.id || null,
    name: plain.name || null,
    phone: plain.phone || null,
    area: plain.area || null,
    email: plain.email || null,
    isArchived: Boolean(plain.isArchived),
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
  }
}

const toSafeUser = (user) => {
  if (!user) return null
  const plain = toPlain(user)
  return {
    _id: plain._id || null,
    id: plain._id?.toString?.() || plain.id || null,
    name: plain.name || null,
    email: plain.email || null,
    phone: plain.phone || null,
    role: plain.role || null,
    isActive: plain.isActive ?? null,
  }
}

const toBullionSaleRef = (id) => {
  if (!id) return null
  return `BSL-${String(id).slice(-6).toUpperCase()}`
}

const toSafeSale = (sale) => {
  if (!sale) return null
  const plain = toPlain(sale)
  const customer = plain.customerId && typeof plain.customerId === 'object'
    ? toSafeCustomer(plain.customerId)
    : {
        _id: plain.customerId || null,
        id: plain.customerId?.toString?.() || plain.customerId || null,
        name: plain.customerName || null,
        phone: plain.customerPhone || null,
        area: plain.customerArea || null,
        email: plain.customerEmail || null,
      }

  const salesman = plain.salesmanId && typeof plain.salesmanId === 'object'
    ? toSafeUser(plain.salesmanId)
    : {
        _id: plain.salesmanId || null,
        id: plain.salesmanId?.toString?.() || plain.salesmanId || null,
        name: plain.salesmanName || null,
      }

  return {
    ...plain,
    _id: plain._id || null,
    id: plain._id?.toString?.() || plain.id || null,
    ref: toBullionSaleRef(plain._id || plain.id),
    customerId: extractObjectId(customer?._id || plain.customerId),
    customer,
    salesmanId: extractObjectId(salesman?._id || plain.salesmanId),
    salesman,
    weightGrams: plain.weightGrams ?? null,
    ratePerGram: plain.ratePerGram ?? null,
    totalAmount: plain.totalAmount ?? null,
    transactionType: plain.transactionType || 'sale',
    syncStatus: plain.syncStatus || 'synced',
    syncedAt: plain.syncedAt || null,
    syncError: plain.syncError || null,
    syncMeta: plain.syncMeta ?? null,
  }
}

const toSafeInventory = (inventory) => {
  if (!inventory) {
    return {
      currentStockGrams: 0,
      currentMarketRatePerGram: 0,
      lastUpdatedAt: null,
      lastUpdatedBy: null,
      notes: null,
      createdAt: null,
      updatedAt: null,
    }
  }

  const plain = toPlain(inventory)
  return {
    currentStockGrams: plain.currentStockGrams ?? 0,
    currentMarketRatePerGram: plain.currentMarketRatePerGram ?? 0,
    lastUpdatedAt: plain.lastUpdatedAt || null,
    lastUpdatedBy:
      plain.lastUpdatedBy && typeof plain.lastUpdatedBy === 'object'
        ? toSafeUser(plain.lastUpdatedBy)
        : plain.lastUpdatedBy || null,
    notes: plain.notes || null,
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
  }
}

const toSafePurchaseOrder = (order) => {
  if (!order) return null
  const plain = toPlain(order)
  return {
    ...plain,
    _id: plain._id || null,
    id: plain._id?.toString?.() || plain.id || null,
    createdBy:
      plain.createdBy && typeof plain.createdBy === 'object'
        ? toSafeUser(plain.createdBy)
        : plain.createdBy || null,
    suggestedGrams: plain.suggestedGrams ?? 0,
    requestedGrams: plain.requestedGrams ?? 0,
    purchasedGrams: plain.purchasedGrams ?? 0,
    purchasePricePerGram: plain.purchasePricePerGram ?? 0,
    totalPurchaseCost: plain.totalPurchaseCost ?? 0,
    status: plain.status || 'pending',
    notes: plain.notes || null,
    markedDoneAt: plain.markedDoneAt || null,
  }
}

const buildSort = (sortBy, sortOrder) => {
  const order = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1
  switch (String(sortBy || 'createdAt').trim()) {
    case 'weightGrams':
      return { weightGrams: order, createdAt: -1 }
    case 'totalAmount':
      return { totalAmount: order, createdAt: -1 }
    case 'customerName':
      return { customerName: order, createdAt: -1 }
    case 'transactionType':
      return { transactionType: order, createdAt: -1 }
    case 'createdAt':
    default:
      return { createdAt: order }
  }
}

const buildRegexClause = (fields, text) => {
  const regex = new RegExp(escapeRegex(text), 'i')
  return fields.map((field) => ({ [field]: { $regex: regex } }))
}

const resolveCustomer = async ({ customerId, customerName, customerPhone, customerArea, customerEmail }) => {
  const normalizedCustomerId = normalizeText(customerId)
  const normalizedPhone = normalizePhone(customerPhone)
  if (normalizedPhone && normalizedPhone.length !== 10) {
    throw new BullionServiceError('Customer phone must be exactly 10 digits', 400, 'INVALID_VALUE', { customerPhone: 'Must be exactly 10 digits' })
  }
  const normalizedName = normalizeText(customerName)
  const normalizedArea = normalizeText(customerArea)
  const normalizedEmail = normalizeEmail(customerEmail)

  if (normalizedCustomerId) {
    if (!mongoose.isValidObjectId(normalizedCustomerId)) {
      throw new BullionServiceError('Invalid customer id', 400, 'INVALID_ID', { customerId: 'Invalid customer id' })
    }

    const customer = await Customer.findById(normalizedCustomerId).lean()
    if (!customer) {
      throw new BullionServiceError('Customer not found', 404, 'NOT_FOUND')
    }
    return customer
  }

  if (normalizedPhone) {
    const existingCustomer = await Customer.findOne({ phone: normalizedPhone }).lean()
    if (existingCustomer) {
      return existingCustomer
    }
  }

  if (!normalizedName) {
    throw new BullionServiceError('Customer name is required', 400, 'MISSING_FIELDS', { customerName: 'Customer name is required' })
  }

  if (!normalizedArea) {
    throw new BullionServiceError('Customer area is required', 400, 'MISSING_FIELDS', { customerArea: 'Customer area is required' })
  }

  const customer = await Customer.create({
    name: normalizedName,
    phone: normalizedPhone,
    area: normalizedArea,
    email: normalizedEmail,
  })

  return customer.toObject()
}

const resolveSalesman = async ({ actor, salesmanId }) => {
  if (actor?.role === 'admin' && normalizeText(salesmanId)) {
    const id = normalizeText(salesmanId)
    if (!mongoose.isValidObjectId(id)) {
      throw new BullionServiceError('Invalid salesman id', 400, 'INVALID_ID', { salesmanId: 'Invalid salesman id' })
    }
    const salesman = await User.findById(id).lean()
    if (!salesman) {
      throw new BullionServiceError('Salesman not found', 404, 'NOT_FOUND')
    }
    return salesman
  }

  const salesman = await User.findById(actor.id).lean()
  if (!salesman) {
    throw new BullionServiceError('Salesman not found', 404, 'NOT_FOUND')
  }
  return salesman
}

const resolveRatePerGram = ({ inputUnit, ratePerGram, ratePerKg, rate }) => {
  const unit = normalizeInputUnit(inputUnit)
  const rawRatePerGram = parseNumber(ratePerGram ?? rate)
  const rawRatePerKg = parseNumber(ratePerKg ?? (unit === 'per_kg' ? rate : null))

  if (unit === 'per_kg') {
    const source = rawRatePerKg ?? rawRatePerGram
    if (source === null) {
      throw new BullionServiceError('Rate is required', 400, 'MISSING_FIELDS', { ratePerKg: 'Rate is required' })
    }
    return {
      inputUnit: 'per_kg',
      ratePerGram: roundMoney(source / 1000),
    }
  }

  const source = rawRatePerGram ?? rawRatePerKg
  if (source === null) {
    throw new BullionServiceError('Rate is required', 400, 'MISSING_FIELDS', { ratePerGram: 'Rate is required' })
  }

  return {
    inputUnit: 'per_gram',
    ratePerGram: roundMoney(source),
  }
}

const buildSaleQuery = async ({ actor, query = {} }) => {
  const andClauses = []
  const q = normalizeText(query.q)
  const startDate = parseOptionalDate(query.startDate)
  const endDate = parseOptionalDate(query.endDate)
  const transactionType = normalizeText(query.transactionType)
  const syncStatus = normalizeText(query.syncStatus)
  const salesmanFilter = normalizeText(query.salesman || query.salesmanId)
  const customerFilter = normalizeText(query.customer || query.customerId)

  if (actor?.role !== 'admin') {
    andClauses.push({ salesmanId: new mongoose.Types.ObjectId(actor.id) })
  } else if (salesmanFilter) {
    if (mongoose.isValidObjectId(salesmanFilter)) {
      andClauses.push({ salesmanId: new mongoose.Types.ObjectId(salesmanFilter) })
    } else {
      const salesmanIds = await User.find({
        $or: buildRegexClause(['name', 'email', 'phone'], salesmanFilter),
      }, { _id: 1 }).lean()
      const directClauses = buildRegexClause(['salesmanName'], salesmanFilter)
      if (salesmanIds.length > 0) {
        directClauses.push({ salesmanId: { $in: salesmanIds.map((user) => user._id) } })
      }
      andClauses.push({ $or: directClauses })
    }
  }

  if (customerFilter) {
    if (mongoose.isValidObjectId(customerFilter)) {
      andClauses.push({ customerId: new mongoose.Types.ObjectId(customerFilter) })
    } else {
      const customerIds = await Customer.find({
        $or: buildRegexClause(['name', 'phone', 'area', 'email'], customerFilter),
      }, { _id: 1 }).lean()
      const directClauses = buildRegexClause(['customerName', 'customerPhone', 'customerArea', 'customerEmail'], customerFilter)
      if (customerIds.length > 0) {
        directClauses.push({ customerId: { $in: customerIds.map((customer) => customer._id) } })
      }
      andClauses.push({ $or: directClauses })
    }
  }

  if (q) {
    andClauses.push({
      $or: [
        ...buildRegexClause(['customerName', 'customerPhone', 'customerArea', 'customerEmail', 'salesmanName', 'notes', 'clientEntryId', 'goldPurity'], q),
        { transactionType: { $regex: new RegExp(escapeRegex(q), 'i') } },
      ],
    })
  }

  if (transactionType && transactionType !== 'all') {
    const normalizedTransactionType = normalizeTransactionType(transactionType)
    andClauses.push({ transactionType: normalizedTransactionType })
  }

  if (syncStatus && syncStatus !== 'all') {
    andClauses.push({ syncStatus: normalizeSyncStatus(syncStatus) })
  }

  if (startDate || endDate) {
    const createdAtClause = {}
    if (startDate) createdAtClause.$gte = startDate
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      createdAtClause.$lte = end
    }
    andClauses.push({ createdAt: createdAtClause })
  }

  if (andClauses.length === 0) {
    return {}
  }

  if (andClauses.length === 1) {
    return andClauses[0]
  }

  return { $and: andClauses }
}

const paginate = ({ page, limit }) => {
  const parsedPage = Math.max(1, Number.parseInt(page || `${DEFAULT_PAGE}`, 10) || DEFAULT_PAGE)
  const parsedLimit = Math.max(1, Math.min(MAX_LIMIT, Number.parseInt(limit || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT))
  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  }
}

const loadSalesSummaryData = async ({ actor, query = {} } = {}) => {
  const match = await buildSaleQuery({ actor, query })
  const [summary, total] = await Promise.all([
    BullionSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          saleCount: { $sum: { $cond: [{ $eq: ['$transactionType', 'sale'] }, 1, 0] } },
          returnCount: { $sum: { $cond: [{ $eq: ['$transactionType', 'return'] }, 1, 0] } },
          grossSoldGrams: {
            $sum: {
              $cond: [
                { $eq: ['$transactionType', 'return'] },
                { $multiply: ['$weightGrams', -1] },
                '$weightGrams',
              ],
            },
          },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$transactionType', 'return'] },
                { $multiply: ['$totalAmount', -1] },
                '$totalAmount',
              ],
            },
          },
        },
      },
    ]),
    BullionSale.countDocuments(match),
  ])

  const inventoryDoc = await BullionInventory.findOne({}).lean()
  const inventory = toSafeInventory(inventoryDoc)
  const completedOrders = await BullionPurchaseOrder.aggregate([
    { $match: { status: 'done' } },
    {
      $group: {
        _id: null,
        orderCount: { $sum: 1 },
        totalPurchasedGrams: { $sum: '$purchasedGrams' },
        totalPurchaseCost: { $sum: '$totalPurchaseCost' },
      },
    },
  ])
  const pendingOrders = await BullionPurchaseOrder.aggregate([
    { $match: { status: 'pending' } },
    {
      $group: {
        _id: null,
        orderCount: { $sum: 1 },
        totalRequestedGrams: { $sum: '$requestedGrams' },
      },
    },
  ])

  const summaryRow = summary[0] || {}
  const netSoldGrams = roundTo(summaryRow.grossSoldGrams ?? 0, 3)
  const totalRevenue = roundMoney(summaryRow.revenue ?? 0)
  const currentStockGrams = roundTo(inventory.currentStockGrams ?? 0, 3)
  const currentMarketRatePerGram = roundMoney(inventory.currentMarketRatePerGram ?? 0)
  const estimatedStockValue = roundMoney(currentStockGrams * currentMarketRatePerGram)
  const suggestedPurchaseGrams = roundTo(Math.max(netSoldGrams - currentStockGrams, 0), 3)
  const completedOrderRow = completedOrders[0] || {}
  const pendingOrderRow = pendingOrders[0] || {}

  return {
    totalEntries: summaryRow.totalEntries || 0,
    totalSales: total,
    saleCount: summaryRow.saleCount || 0,
    returnCount: summaryRow.returnCount || 0,
    grossSoldGrams: netSoldGrams,
    netSoldGrams,
    totalRevenue,
    revenue: totalRevenue,
    currentStockGrams,
    currentMarketRatePerGram,
    estimatedStockValue,
    suggestedPurchaseGrams,
    completedPurchaseOrdersCount: completedOrderRow.orderCount || 0,
    completedPurchaseGrams: roundTo(completedOrderRow.totalPurchasedGrams || 0, 3),
    completedPurchaseCost: roundMoney(completedOrderRow.totalPurchaseCost || 0),
    pendingPurchaseOrdersCount: pendingOrderRow.orderCount || 0,
    pendingPurchaseGrams: roundTo(pendingOrderRow.totalRequestedGrams || 0, 3),
  }
}

export const createBullionSale = async ({ body, actor }) => {
  const clientEntryId = normalizeNullableText(body?.clientEntryId)
  if (clientEntryId) {
    const existing = await BullionSale.findOne({ clientEntryId })
      .populate('customerId', 'name phone area email isArchived')
      .populate('salesmanId', 'name email phone role isActive')
      .lean()
    if (existing) {
      if (actor?.role !== 'admin' && String(existing.salesmanId?._id || existing.salesmanId || '') !== String(actor.id)) {
        throw new BullionServiceError('Insufficient permissions', 403, 'FORBIDDEN')
      }
      return toSafeSale(existing)
    }
  }

  const customer = await resolveCustomer({
    customerId: body?.customerId || body?.customer?.id,
    customerName: body?.customerName || body?.customer?.name,
    customerPhone: body?.customerPhone || body?.customer?.phone,
    customerArea: body?.customerArea || body?.customer?.area,
    customerEmail: body?.customerEmail || body?.customer?.email,
  })

  const salesman = await resolveSalesman({
    actor,
    salesmanId: body?.salesmanId || body?.salesman?.id,
  })

  const weightGrams = roundTo(parsePositiveNumber(body?.weightGrams, 'weightGrams', { allowZero: false }), 3)
  const { inputUnit, ratePerGram } = resolveRatePerGram({
    inputUnit: body?.inputUnit || body?.rateUnit,
    ratePerGram: body?.ratePerGram,
    ratePerKg: body?.ratePerKg,
    rate: body?.rate,
  })
  const totalAmount = roundMoney(weightGrams * ratePerGram)
  const goldPurity = normalizeNullableText(body?.goldPurity || body?.purity)
  const transactionType = normalizeTransactionType(body?.transactionType)
  const notes = normalizeNullableText(body?.notes)
  const syncStatus = normalizeSyncStatus(body?.syncStatus)
  const syncMeta = body?.syncMeta && typeof body.syncMeta === 'object' ? body.syncMeta : null

  const created = await BullionSale.create({
    clientEntryId,
    customerId: customer?._id || customer?.id || null,
    customerName: customer?.name || normalizeNullableText(body?.customerName) || '',
    customerPhone: customer?.phone || normalizePhone(body?.customerPhone || body?.customer?.phone),
    customerArea: customer?.area || normalizeNullableText(body?.customerArea || body?.customer?.area),
    customerEmail: customer?.email || normalizeEmail(body?.customerEmail || body?.customer?.email),
    salesmanId: salesman?._id || salesman?.id || actor.id,
    salesmanName: salesman?.name || actor?.name || null,
    weightGrams,
    inputUnit,
    ratePerGram,
    totalAmount,
    goldPurity,
    transactionType,
    notes,
    syncStatus,
    syncedAt: syncStatus === 'synced' ? new Date() : null,
    syncError: normalizeNullableText(body?.syncError),
    syncMeta,
  })

  const populated = await BullionSale.findById(created._id)
    .populate('customerId', 'name phone area email isArchived')
    .populate('salesmanId', 'name email phone role isActive')
    .lean()

  return toSafeSale(populated)
}

export const listBullionSales = async ({ actor, query = {} }) => {
  const { page, limit, skip } = paginate(query)
  const match = await buildSaleQuery({ actor, query })
  const sort = buildSort(query.sortBy, query.sortOrder)

  const [rows, total] = await Promise.all([
    BullionSale.find(match)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'name phone area email isArchived')
      .populate('salesmanId', 'name email phone role isActive')
      .lean(),
    BullionSale.countDocuments(match),
  ])

  return {
    sales: rows.map((row) => toSafeSale(row)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    sortBy: String(query.sortBy || 'createdAt'),
    sortOrder: String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
  }
}

export const getBullionSaleDetail = async ({ id, actor }) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new BullionServiceError('Invalid sale id', 400, 'INVALID_ID', { id: 'Invalid sale id' })
  }

  const sale = await BullionSale.findById(id)
    .populate('customerId', 'name phone area email isArchived createdAt updatedAt')
    .populate('salesmanId', 'name email phone role isActive')
    .lean()

  if (!sale) {
    throw new BullionServiceError('Sale not found', 404, 'NOT_FOUND')
  }

  if (actor?.role !== 'admin' && String(sale.salesmanId?._id || sale.salesmanId || '') !== String(actor.id)) {
    throw new BullionServiceError('Insufficient permissions', 403, 'FORBIDDEN')
  }

  return toSafeSale(sale)
}

export const listBullionSalesByCustomer = async ({ customerId, actor, query = {} }) => {
  if (!mongoose.isValidObjectId(customerId)) {
    throw new BullionServiceError('Invalid customer id', 400, 'INVALID_ID', { customerId: 'Invalid customer id' })
  }

  const customer = await Customer.findById(customerId).lean()
  if (!customer) {
    throw new BullionServiceError('Customer not found', 404, 'NOT_FOUND')
  }

  const { page, limit, skip } = paginate(query)
  const match = {
    customerId: new mongoose.Types.ObjectId(customerId),
  }

  if (actor?.role !== 'admin') {
    match.salesmanId = new mongoose.Types.ObjectId(actor.id)
  }

  if (query.transactionType && String(query.transactionType).trim().toLowerCase() !== 'all') {
    match.transactionType = normalizeTransactionType(query.transactionType)
  }

  const startDate = parseOptionalDate(query.startDate)
  const endDate = parseOptionalDate(query.endDate)
  if (startDate || endDate) {
    match.createdAt = {}
    if (startDate) match.createdAt.$gte = startDate
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      match.createdAt.$lte = end
    }
  }

  const [rows, total, summary] = await Promise.all([
    BullionSale.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'name phone area email isArchived')
      .populate('salesmanId', 'name email phone role isActive')
      .lean(),
    BullionSale.countDocuments(match),
    BullionSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          saleCount: { $sum: { $cond: [{ $eq: ['$transactionType', 'sale'] }, 1, 0] } },
          returnCount: { $sum: { $cond: [{ $eq: ['$transactionType', 'return'] }, 1, 0] } },
          grossSoldGrams: {
            $sum: {
              $cond: [
                { $eq: ['$transactionType', 'return'] },
                { $multiply: ['$weightGrams', -1] },
                '$weightGrams',
              ],
            },
          },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$transactionType', 'return'] },
                { $multiply: ['$totalAmount', -1] },
                '$totalAmount',
              ],
            },
          },
        },
      },
    ]),
  ])

  const summaryRow = summary[0] || {}
  return {
    customer: toSafeCustomer(customer),
    sales: rows.map((row) => toSafeSale(row)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      totalEntries: summaryRow.totalEntries || 0,
      saleCount: summaryRow.saleCount || 0,
      returnCount: summaryRow.returnCount || 0,
      grossSoldGrams: roundTo(summaryRow.grossSoldGrams || 0, 3),
      netSoldGrams: roundTo(summaryRow.grossSoldGrams || 0, 3),
      totalRevenue: roundMoney(summaryRow.revenue || 0),
    },
  }
}

export const getBullionInventory = async () => {
  const inventory = await BullionInventory.findOne({})
    .populate('lastUpdatedBy', 'name email role')
    .lean()
  return toSafeInventory(inventory)
}

export const updateBullionInventory = async ({ body, actor }) => {
  const currentStockGrams = parsePositiveNumber(body?.currentStockGrams, 'currentStockGrams', { allowZero: true })
  const currentMarketRatePerGram = parsePositiveNumber(body?.currentMarketRatePerGram, 'currentMarketRatePerGram', { allowZero: true })
  const notes = normalizeNullableText(body?.notes)

  const updated = await BullionInventory.findOneAndUpdate(
    { singletonKey: 'bullion_inventory' },
    {
      $set: {
        currentStockGrams: roundTo(currentStockGrams, 3),
        currentMarketRatePerGram: roundMoney(currentMarketRatePerGram),
        lastUpdatedAt: new Date(),
        lastUpdatedBy: actor.id,
        notes,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).lean()

  return toSafeInventory(updated)
}

export const createBullionPurchaseOrder = async ({ body, actor }) => {
  const summary = await loadBullionSalesAnalyticsSummary({ actor })
  const suggestedGrams = parseNumber(body?.suggestedGrams)
  const requestedGramsInput = parseNumber(body?.requestedGrams)
  const notes = normalizeNullableText(body?.notes)

  const resolvedSuggestedGrams = roundTo(
    suggestedGrams === null ? summary.suggestedPurchaseGrams : suggestedGrams,
    3
  )
  const requestedGrams = roundTo(
    requestedGramsInput === null ? resolvedSuggestedGrams : requestedGramsInput,
    3
  )

  if (requestedGrams < 0) {
    throw new BullionServiceError('requestedGrams must be at least 0', 400, 'INVALID_VALUE', { requestedGrams: 'Must be at least 0' })
  }

  const created = await BullionPurchaseOrder.create({
    suggestedGrams: resolvedSuggestedGrams,
    requestedGrams,
    status: 'pending',
    notes,
    createdBy: actor.id,
  })

  const populated = await BullionPurchaseOrder.findById(created._id)
    .populate('createdBy', 'name email phone role isActive')
    .lean()

  return toSafePurchaseOrder(populated)
}

export const listBullionPurchaseOrders = async ({ query = {} }) => {
  const { page, limit, skip } = paginate(query)
  const match = {}
  const status = normalizeText(query.status)
  const q = normalizeText(query.q)

  if (status && status !== 'all') {
    match.status = status === 'done' ? 'done' : 'pending'
  }

  if (q) {
    match.$or = [
      { notes: { $regex: new RegExp(escapeRegex(q), 'i') } },
      { status: { $regex: new RegExp(escapeRegex(q), 'i') } },
    ]
  }

  const [rows, total] = await Promise.all([
    BullionPurchaseOrder.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email phone role isActive')
      .lean(),
    BullionPurchaseOrder.countDocuments(match),
  ])

  return {
    purchaseOrders: rows.map((row) => toSafePurchaseOrder(row)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  }
}

export const markBullionPurchaseOrderDone = async ({ id, body }) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new BullionServiceError('Invalid purchase order id', 400, 'INVALID_ID', { id: 'Invalid purchase order id' })
  }

  const purchaseOrder = await BullionPurchaseOrder.findById(id)
  if (!purchaseOrder) {
    throw new BullionServiceError('Purchase order not found', 404, 'NOT_FOUND')
  }

  if (purchaseOrder.status === 'done') {
    throw new BullionServiceError('Purchase order is already marked done', 409, 'ALREADY_DONE')
  }

  const purchasedGrams = parsePositiveNumber(body?.purchasedGrams, 'purchasedGrams', { allowZero: false })
  const purchasePricePerGram = parsePositiveNumber(body?.purchasePricePerGram, 'purchasePricePerGram', { allowZero: false })
  const notes = normalizeNullableText(body?.notes)

  purchaseOrder.status = 'done'
  purchaseOrder.purchasedGrams = roundTo(purchasedGrams, 3)
  purchaseOrder.purchasePricePerGram = roundMoney(purchasePricePerGram)
  purchaseOrder.totalPurchaseCost = roundMoney(purchaseOrder.purchasedGrams * purchaseOrder.purchasePricePerGram)
  purchaseOrder.notes = notes
  purchaseOrder.markedDoneAt = new Date()

  await purchaseOrder.save()

  const populated = await BullionPurchaseOrder.findById(purchaseOrder._id)
    .populate('createdBy', 'name email phone role isActive')
    .lean()

  return toSafePurchaseOrder(populated)
}

export const loadBullionSalesAnalyticsSummary = async ({ actor, query = {} } = {}) => {
  return loadSalesSummaryData({ actor, query })
}

export const getBullionSalesAnalyticsSummary = async ({ actor, query = {} }) => {
  return loadSalesSummaryData({ actor, query })
}




