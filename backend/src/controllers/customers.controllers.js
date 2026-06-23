import { Customer } from '../models/Customer.js'
import { CaptureSession } from '../models/CaptureSession.js'
import { ScanBatch } from '../models/ScanBatch.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_HISTORY_LIMIT = 10
const DEFAULT_LIST_LIMIT = 10

const normalizeText = (value) => String(value ?? '').trim()
const normalizePhone = (value) => normalizeText(value).replace(/\D/g, '')

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildLoosePhoneRegex = (digits) => {
  if (!digits) {
    return null
  }

  return new RegExp(digits.split('').map((digit) => `${digit}[^0-9]*`).join(''))
}

const buildCustomerFilterQuery = ({ q, archived }) => {
  const query = {}
  const normalizedArchived = String(archived || 'active').trim().toLowerCase()

  if (normalizedArchived === 'active') {
    query.isArchived = false
  } else if (normalizedArchived === 'archived') {
    query.isArchived = true
  }

  const searchText = normalizeText(q)
  if (searchText) {
    const phoneDigits = normalizePhone(searchText)
    const escaped = escapeRegex(searchText)
    const textRegex = new RegExp(escaped, 'i')
    const searchOr = [
      { name: textRegex },
      { email: textRegex },
      { area: textRegex },
    ]

    if (phoneDigits) {
      searchOr.push({ phone: { $regex: phoneDigits } })
      const loosePhoneRegex = buildLoosePhoneRegex(phoneDigits)
      if (loosePhoneRegex) {
        searchOr.push({ phone: loosePhoneRegex })
      }
    } else {
      searchOr.push({ phone: textRegex })
    }

    query.$or = searchOr
  }

  return query
}

const normalizeEmail = (value) => {
  const email = normalizeText(value).toLowerCase()
  return email || null
}

const validateCustomerPayload = ({ name, phone, area, email }) => {
  const errors = []
  const normalizedName = normalizeText(name)
  const normalizedPhone = normalizePhone(phone)
  const normalizedArea = normalizeText(area)
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedName) {
    errors.push('Customer name is required')
  }

  if (!normalizedPhone) {
    errors.push('Customer phone is required')
  } else if (normalizedPhone.length !== 10) {
    errors.push('Phone must be exactly 10 digits')
  }

  if (!normalizedArea) {
    errors.push('Customer area is required')
  }

  if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
    errors.push('Invalid email address')
  }

  return {
    errors,
    value: {
      name: normalizedName,
      phone: normalizedPhone,
      area: normalizedArea,
      email: normalizedEmail,
    },
  }
}

const buildPhoneMatchConditions = (phoneDigits) => {
  if (!phoneDigits) {
    return []
  }

  const conditions = [{ customerPhone: phoneDigits }]
  const loosePhoneRegex = buildLoosePhoneRegex(phoneDigits)
  if (loosePhoneRegex) {
    conditions.push({ customerPhone: loosePhoneRegex })
  }

  return conditions
}

const formatHistoryRow = (row, sourceType) => {
  const totals = row?.totals || {}
  const salesman = row?.assignedSalesmanId || row?.salesmanId || null
  const resolvedDate = row?.finalizedAt || row?.submittedAt || row?.updatedAt || row?.createdAt || null

  return {
    id: row?._id,
    sourceType,
    reference: row?.sessionRef || row?.batchRef || row?._id?.toString?.() || null,
    status: row?.status || 'unknown',
    itemCount: Number(row?.itemCount ?? totals.itemCount ?? 0) || 0,
    grossWeight: Number(totals.grossWeight ?? 0) || 0,
    stoneWeight: Number(totals.stoneWeight ?? 0) || 0,
    otherWeight: Number(totals.otherWeight ?? 0) || 0,
    netWeight: Number(totals.netWeight ?? 0) || 0,
    fineWeight: Number(totals.fineWeight ?? 0) || 0,
    stoneAmount: Number(totals.stoneAmount ?? 0) || 0,
    salesmanId: salesman?._id || salesman || null,
    salesmanName: salesman?.name || null,
    date: resolvedDate,
  }
}

const sumHistoryRows = (rows = []) => rows.reduce(
  (acc, row) => {
    const totals = row?.totals || {}
    acc.totalSessions += 1
    acc.totalItems += Number(row?.itemCount ?? totals.itemCount ?? 0) || 0
    acc.totalGross += Number(totals.grossWeight ?? 0) || 0
    acc.totalStone += Number(totals.stoneWeight ?? 0) || 0
    acc.totalOther += Number(totals.otherWeight ?? 0) || 0
    acc.totalNet += Number(totals.netWeight ?? 0) || 0
    acc.totalFine += Number(totals.fineWeight ?? 0) || 0
    acc.totalStoneAmount += Number(totals.stoneAmount ?? 0) || 0
    return acc
  },
  {
    totalSessions: 0,
    totalItems: 0,
    totalGross: 0,
    totalStone: 0,
    totalOther: 0,
    totalNet: 0,
    totalFine: 0,
    totalStoneAmount: 0,
  }
)

const summarizeBySalesman = (rows = []) => {
  const map = new Map()

  for (const row of rows) {
    const salesman = row?.assignedSalesmanId || row?.salesmanId || null
    const salesmanId = salesman?._id || salesman || null
    if (!salesmanId) continue

    const salesmanName = salesman?.name || 'Unknown'
    const date = row?.finalizedAt || row?.submittedAt || row?.updatedAt || row?.createdAt || null
    const key = String(salesmanId)
    const current = map.get(key) || {
      salesmanId,
      salesmanName,
      sessionCount: 0,
      totalItems: 0,
      totalFine: 0,
      lastSessionAt: null,
    }

    current.sessionCount += 1
    current.totalItems += Number(row?.itemCount ?? row?.totals?.itemCount ?? 0) || 0
    current.totalFine += Number(row?.totals?.fineWeight ?? 0) || 0
    if (date && (!current.lastSessionAt || new Date(date) > new Date(current.lastSessionAt))) {
      current.lastSessionAt = date
    }

    map.set(key, current)
  }

  return Array.from(map.values()).sort((a, b) => (b.sessionCount - a.sessionCount) || new Date(b.lastSessionAt || 0) - new Date(a.lastSessionAt || 0))
}

const loadCustomerRelations = async (customer, { includeHistory = false } = {}) => {
  const phoneDigits = normalizePhone(customer?.phone)
  const phoneConditions = buildPhoneMatchConditions(phoneDigits)

  if (phoneConditions.length === 0) {
    return {
      relationSource: 'none',
      totalSessions: 0,
      totalItems: 0,
      totalGross: 0,
      totalStone: 0,
      totalOther: 0,
      totalNet: 0,
      totalFine: 0,
      totalStoneAmount: 0,
      recentSessions: [],
      salesmanHistory: [],
      hasSessions: false,
    }
  }

  const baseSessionQuery = {
    $or: [
      { customerPhone: phoneDigits },
      ...phoneConditions,
    ],
  }

  const baseBatchQuery = {
    $or: [
      { customerPhone: phoneDigits },
      ...phoneConditions,
    ],
  }

  const [captureSessions, scanBatches] = await Promise.all([
    CaptureSession.find(baseSessionQuery)
      .select('sessionRef customerName customerPhone status itemCount totals assignedSalesmanId createdAt updatedAt finalizedAt submittedAt')
      .populate({ path: 'assignedSalesmanId', select: 'name role' })
      .sort({ finalizedAt: -1, submittedAt: -1, updatedAt: -1, createdAt: -1 })
      .lean(),
    ScanBatch.find(baseBatchQuery)
      .select('batchRef customerName customerPhone status itemCount totals assignedSalesmanId salesmanId createdAt updatedAt finalizedAt submittedAt')
      .populate({ path: 'assignedSalesmanId', select: 'name role' })
      .populate({ path: 'salesmanId', select: 'name role' })
      .sort({ finalizedAt: -1, submittedAt: -1, updatedAt: -1, createdAt: -1 })
      .lean(),
  ])

  const primaryRows = captureSessions.length > 0 ? captureSessions : scanBatches
  const relationSource = captureSessions.length > 0 ? 'captureSession' : (scanBatches.length > 0 ? 'scanBatch' : 'none')
  const summary = sumHistoryRows(primaryRows)
  const recentSessions = includeHistory
    ? primaryRows.slice(0, DEFAULT_HISTORY_LIMIT).map((row) => formatHistoryRow(row, relationSource))
    : []

  return {
    relationSource,
    hasSessions: primaryRows.length > 0,
    ...summary,
    recentSessions,
    salesmanHistory: includeHistory ? summarizeBySalesman(primaryRows) : [],
  }
}

/**
 * List customers with search, archive filters, session filters, and optional pagination.
 */
export const listCustomers = async (req, res) => {
  try {
    const query = buildCustomerFilterQuery(req.query)
    const hasSessions = String(req.query.hasSessions || 'all').trim().toLowerCase()
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIST_LIMIT)
    const usePagination = req.query.page !== undefined || req.query.limit !== undefined

    const customers = await Customer.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean()

    const enrichedCustomers = (await Promise.all(
      customers.map(async (customer) => {
        const relation = await loadCustomerRelations(customer, { includeHistory: false })
        if (hasSessions === 'yes' && !relation.hasSessions) {
          return null
        }
        if (hasSessions === 'no' && relation.hasSessions) {
          return null
        }

        return {
          ...customer,
          sessionCount: relation.totalSessions,
          totalItems: relation.totalItems,
          totalGross: relation.totalGross,
          totalNet: relation.totalNet,
          totalFine: relation.totalFine,
          lastSessionAt: relation.recentSessions[0]?.date || null,
        }
      }),
    )).filter(Boolean)

    if (!usePagination) {
      return res.status(200).json({
        success: true,
        data: enrichedCustomers,
      })
    }

    const total = enrichedCustomers.length
    const pages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, pages)
    const start = (safePage - 1) * limit
    const pagedCustomers = enrichedCustomers.slice(start, start + limit)

    return res.status(200).json({
      success: true,
      data: pagedCustomers,
      pagination: {
        page: safePage,
        limit,
        total,
        pages,
      },
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch customers' })
  }
}

/**
 * Get a customer profile with lightweight aggregates and history.
 */
export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).select('-__v').lean()
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'NOT_FOUND' })
    }

    const relation = await loadCustomerRelations(customer, { includeHistory: true })

    return res.status(200).json({
      success: true,
      data: {
        customer,
        aggregates: {
          totalSessions: relation.totalSessions,
          totalItems: relation.totalItems,
          totalGross: relation.totalGross,
          totalNet: relation.totalNet,
          totalFine: relation.totalFine,
        },
        history: relation.recentSessions,
        salesmanHistory: relation.salesmanHistory,
        relationSource: relation.relationSource,
        hasSessions: relation.hasSessions,
        note: relation.hasSessions
          ? 'Aggregates are derived from legacy phone-matched records until direct customer relations are wired.'
          : 'No linked sessions were found yet.',
      },
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load customer profile', code: 'SERVER_ERROR' })
  }
}

/**
 * Create a new customer.
 */
export const createCustomer = async (req, res) => {
  try {
    const { errors, value } = validateCustomerPayload(req.body)
    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      })
    }

    const existingCustomer = await Customer.findOne({ phone: value.phone }).lean()
    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        error: 'Customer phone already exists',
        code: 'CUSTOMER_PHONE_EXISTS',
      })
    }

    const customer = new Customer(value)
    await customer.save()

    return res.status(201).json({
      success: true,
      data: customer.toSafeObject(),
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create customer', code: 'SERVER_ERROR' })
  }
}

/**
 * Update customer details.
 */
export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'NOT_FOUND' })
    }

    const nextPayload = {
      name: req.body.name !== undefined ? req.body.name : customer.name,
      phone: req.body.phone !== undefined ? req.body.phone : customer.phone,
      area: req.body.area !== undefined ? req.body.area : customer.area,
      email: req.body.email !== undefined ? req.body.email : customer.email,
    }

    const { errors, value } = validateCustomerPayload(nextPayload)
    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      })
    }

    const duplicateCustomer = await Customer.findOne({
      _id: { $ne: customer._id },
      phone: value.phone,
    }).lean()
    if (duplicateCustomer) {
      return res.status(409).json({
        success: false,
        error: 'Customer phone already exists',
        code: 'CUSTOMER_PHONE_EXISTS',
      })
    }

    customer.name = value.name
    customer.phone = value.phone
    customer.area = value.area
    customer.email = value.email

    await customer.save()

    return res.status(200).json({
      success: true,
      data: customer.toSafeObject(),
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update customer', code: 'SERVER_ERROR' })
  }
}

/**
 * Soft archive customer.
 */
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'NOT_FOUND' })
    }

    const relation = await loadCustomerRelations(customer, { includeHistory: false })
    const hasLinkedSessions = relation.hasSessions
    const confirmFlag = req.body?.confirm === true || String(req.body?.confirm || '').toLowerCase() === 'true'
    const archiveReason = normalizeText(req.body?.reason || req.body?.archiveReason)

    if (hasLinkedSessions && !confirmFlag) {
      return res.status(409).json({
        success: false,
        error: 'Customer has linked sessions. Explicit confirmation is required to archive.',
        code: 'CUSTOMER_ARCHIVE_CONFIRMATION_REQUIRED',
      })
    }

    if (hasLinkedSessions && !archiveReason) {
      return res.status(422).json({
        success: false,
        error: 'Archive reason is required for customers with sessions.',
        code: 'VALIDATION_ERROR',
        details: ['Archive reason is required for customers with sessions'],
      })
    }

    customer.isArchived = true
    customer.archivedAt = new Date()
    customer.archivedBy = req.user?._id || req.user?.id || null
    customer.archiveReason = archiveReason || null
    await customer.save()

    // TODO: persist an audit-log record once the audit model is available.
    return res.status(200).json({
      success: true,
      message: 'Customer archived successfully',
      data: customer.toSafeObject(),
      archivedWithSessions: hasLinkedSessions,
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to archive customer', code: 'SERVER_ERROR' })
  }
}


