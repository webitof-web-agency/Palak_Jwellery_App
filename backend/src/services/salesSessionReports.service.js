import mongoose from 'mongoose'
import { CaptureSession } from '../models/CaptureSession.js'
import { User } from '../models/User.js'

const ALLOWED_MODES = ['session', 'supplier', 'category', 'karat', 'wastage']
const ALLOWED_STATUS_FILTERS = ['active', 'cancelled', 'all']
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export class SalesSessionReportsError extends Error {
  constructor(message, code = 'SALES_SESSION_REPORTS_ERROR', statusCode = 400, details = null) {
    super(message)
    this.name = 'SalesSessionReportsError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

const normalizeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const normalizeLower = (value) => normalizeText(value).toLowerCase()

const normalizeObjectId = (value) => {
  if (!value) return null
  if (value instanceof mongoose.Types.ObjectId) return value.toString()
  if (value?._bsontype === 'ObjectId' || value?._bsontype === 'ObjectID') return value.toString()
  if (typeof value === 'object') {
    if (value._id) return normalizeObjectId(value._id)
    if (value.id) return normalizeObjectId(value.id)
  }
  const text = normalizeText(value)
  return text || null
}

const asFiniteNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const roundWeight = (value) => Number(asFiniteNumber(value, 0).toFixed(3))
const roundAmount = (value) => Number(asFiniteNumber(value, 0).toFixed(2))

const normalizePage = (value) => {
  const parsed = Number.parseInt(String(value ?? DEFAULT_PAGE), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE
}

const normalizeLimit = (value) => {
  const parsed = Number.parseInt(String(value ?? DEFAULT_LIMIT), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeDateBoundary = (value, boundary = 'start') => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new SalesSessionReportsError(`Invalid ${boundary === 'start' ? 'startDate' : 'endDate'}`, 'INVALID_FILTER', 400)
  }
  if (boundary === 'start') {
    date.setHours(0, 0, 0, 0)
  } else {
    date.setHours(23, 59, 59, 999)
  }
  return date
}

const normalizeMode = (mode) => {
  const normalized = normalizeLower(mode) || 'session'
  if (!ALLOWED_MODES.includes(normalized)) {
    throw new SalesSessionReportsError('Invalid sales session report mode', 'INVALID_FILTER', 400)
  }
  return normalized
}

const normalizeStatus = (status) => {
  const normalized = normalizeLower(status) || 'active'
  if (!ALLOWED_STATUS_FILTERS.includes(normalized)) {
    throw new SalesSessionReportsError('Invalid sales session report status filter', 'INVALID_FILTER', 400)
  }
  return normalized
}

const normalizeWarningsOnly = (value) => {
  const normalized = normalizeLower(value)
  return ['true', '1', 'yes'].includes(normalized)
}

const normalizeMaybeFilter = (value) => {
  const normalized = normalizeText(value)
  return normalized || null
}

const normalizeWastageFilter = (value) => {
  if (value === null || value === undefined || value === '') return null
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    throw new SalesSessionReportsError('Invalid wastage filter', 'INVALID_FILTER', 400)
  }
  return Number(numericValue.toFixed(2))
}

const normalizeFilters = (query = {}) => ({
  mode: normalizeMode(query.mode),
  startDate: normalizeDateBoundary(query.startDate, 'start'),
  endDate: normalizeDateBoundary(query.endDate, 'end'),
  salesman: normalizeMaybeFilter(query.salesman),
  customer: normalizeMaybeFilter(query.customer),
  supplier: normalizeMaybeFilter(query.supplier),
  category: normalizeMaybeFilter(query.category),
  karat: normalizeMaybeFilter(query.karat),
  wastage: normalizeWastageFilter(query.wastage),
  warningsOnly: normalizeWarningsOnly(query.warningsOnly),
  status: normalizeStatus(query.status),
  page: normalizePage(query.page),
  limit: normalizeLimit(query.limit),
})

const buildRegex = (value) => new RegExp(escapeRegex(value), 'i')

const buildCustomerQuery = (customer) => {
  if (!customer) return null
  const customerId = normalizeObjectId(customer)
  if (customerId && mongoose.isValidObjectId(customerId)) {
    return {
      $or: [
        { customerId: new mongoose.Types.ObjectId(customerId) },
        { customerName: buildRegex(customer) },
        { customerPhone: buildRegex(customer) },
        { customerArea: buildRegex(customer) },
        { customerEmail: buildRegex(customer) },
      ],
    }
  }

  const regex = buildRegex(customer)
  return {
    $or: [
      { customerName: regex },
      { customerPhone: regex },
      { customerArea: regex },
      { customerEmail: regex },
    ],
  }
}

const resolveSalesmanIds = async (salesman) => {
  if (!salesman) return null
  const salesmanId = normalizeObjectId(salesman)
  if (salesmanId && mongoose.isValidObjectId(salesmanId)) {
    return [salesmanId]
  }

  const regex = buildRegex(salesman)
  const matches = await User.find({
    $or: [
      { name: regex },
      { email: regex },
      { phone: regex },
    ],
  })
    .select({ _id: 1 })
    .lean()

  return matches.map((user) => normalizeObjectId(user._id)).filter(Boolean)
}

const buildSessionQuery = async (filters) => {
  const andConditions = [
    { 'mobileItems.0': { $exists: true } },
  ]

  if (filters.status === 'active') {
    andConditions.push({ status: { $ne: 'cancelled' } })
  } else if (filters.status === 'cancelled') {
    andConditions.push({ status: 'cancelled' })
  }

  if (filters.startDate || filters.endDate) {
    const createdAt = {}
    if (filters.startDate) createdAt.$gte = filters.startDate
    if (filters.endDate) createdAt.$lte = filters.endDate
    andConditions.push({ createdAt })
  }

  const customerQuery = buildCustomerQuery(filters.customer)
  if (customerQuery) {
    andConditions.push(customerQuery)
  }

  if (filters.salesman) {
    const salesmanIds = await resolveSalesmanIds(filters.salesman)
    if (!salesmanIds || salesmanIds.length === 0) {
      return { _id: null }
    }
    andConditions.push({
      assignedSalesmanId: {
        $in: salesmanIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
  }

  return andConditions.length === 1 ? andConditions[0] : { $and: andConditions }
}

const normalizeWarningList = (warnings) => (
  Array.isArray(warnings)
    ? warnings.map((entry) => normalizeText(entry)).filter(Boolean)
    : []
)

const hasItemWarnings = (item = {}) => (
  normalizeWarningList(item.warnings).length > 0 ||
  item.requiresReview === true ||
  item.hasKaratMismatch === true ||
  item.hasSupplierMismatch === true ||
  item.hasWeightMismatch === true ||
  item.isDuplicate === true ||
  item.hasPurityOverride === true ||
  item.hasWastageOverride === true
)

const pickItemSupplier = (item = {}, session = {}) => (
  normalizeText(item.supplierName) ||
  normalizeText(session?.lockedSettingsSnapshot?.supplierName) ||
  'Unknown Supplier'
)

const pickItemCategory = (item = {}, session = {}) => (
  normalizeText(item.category) ||
  normalizeText(session?.lockedSettingsSnapshot?.category) ||
  ''
)

const pickItemKarat = (item = {}, session = {}) => (
  normalizeText(item.appliedKarat) ||
  normalizeText(item.karat) ||
  normalizeText(session?.lockedSettingsSnapshot?.karat) ||
  normalizeText(item.qrKarat) ||
  'Unknown Karat'
)

const pickItemWastage = (item = {}, session = {}) => {
  const value = item.wastage ?? session?.lockedSettingsSnapshot?.wastage ?? null
  if (value === null || value === undefined || value === '') return null
  return Number(asFiniteNumber(value, 0).toFixed(2))
}

const formatWastageLabel = (value) => (
  value === null || value === undefined
    ? 'Unknown Wastage'
    : `${Number(asFiniteNumber(value, 0).toFixed(2)).toFixed(2)}%`
)

const matchesCaseInsensitive = (actual, expected) => normalizeLower(actual) === normalizeLower(expected)

const matchesWastage = (actual, expected) => {
  if (expected === null) return true
  if (actual === null || actual === undefined) return false
  return Number(asFiniteNumber(actual, 0).toFixed(2)) === Number(asFiniteNumber(expected, 0).toFixed(2))
}

const itemMatchesFilters = (item = {}, session = {}, filters = {}) => {
  const supplierName = pickItemSupplier(item, session)
  const category = pickItemCategory(item, session)
  const karat = pickItemKarat(item, session)
  const wastage = pickItemWastage(item, session)

  if (filters.supplier && !matchesCaseInsensitive(supplierName, filters.supplier)) {
    return false
  }

  if (filters.category && !matchesCaseInsensitive(category, filters.category)) {
    return false
  }

  if (filters.karat && !matchesCaseInsensitive(karat, filters.karat)) {
    return false
  }

  if (!matchesWastage(wastage, filters.wastage)) {
    return false
  }

  if (filters.warningsOnly && !hasItemWarnings(item)) {
    return false
  }

  return true
}

const buildSalesmanSummary = (salesman) => {
  if (!salesman) {
    return { id: null, name: 'Unknown Salesman', email: '', phone: '' }
  }

  return {
    id: normalizeObjectId(salesman._id || salesman.id),
    name: normalizeText(salesman.name) || 'Unknown Salesman',
    email: normalizeText(salesman.email),
    phone: normalizeText(salesman.phone),
  }
}

const buildBaseRecord = (session, item) => {
  const supplierName = pickItemSupplier(item, session)
  const category = pickItemCategory(item, session)
  const karat = pickItemKarat(item, session)
  const wastage = pickItemWastage(item, session)
  const warningList = normalizeWarningList(item.warnings)
  const date = session.createdAt || session.syncedAt || session.updatedAt || null

  return {
    sessionId: normalizeObjectId(session._id),
    sessionRef: normalizeText(session.sessionRef) || null,
    status: normalizeText(session.status) || 'submitted',
    date,
    lastActivityAt: item.addedAt || session.updatedAt || date,
    customerId: normalizeObjectId(session.customerId),
    customerName: normalizeText(session.customerName) || 'Unknown Customer',
    customerPhone: normalizeText(session.customerPhone),
    customerArea: normalizeText(session.customerArea),
    customerEmail: normalizeText(session.customerEmail),
    salesman: buildSalesmanSummary(session.assignedSalesmanId),
    supplierName,
    category: category || null,
    karat,
    wastage,
    itemCode: normalizeText(item.itemCode) || null,
    grossWeight: roundWeight(item.grossWeight),
    stoneWeight: roundWeight(item.stoneWeight),
    otherWeight: roundWeight(item.otherWeight),
    netWeight: roundWeight(item.netWeight),
    fineWeight: roundWeight(item.fineWeight),
    stoneAmount: roundAmount(item.stoneAmount),
    otherAmount: roundAmount(item.otherAmount),
    warningsCount: hasItemWarnings(item) ? 1 : 0,
    warnings: warningList,
  }
}

const flattenItems = ({ sessions = [], filters = {} } = {}) => {
  const rows = []

  for (const session of sessions) {
    const sessionStatus = normalizeLower(session?.status)
    if (filters.status === 'active' && sessionStatus === 'cancelled') continue
    if (filters.status === 'cancelled' && sessionStatus !== 'cancelled') continue

    const items = Array.isArray(session.mobileItems) ? session.mobileItems : []
    for (const item of items) {
      if (!itemMatchesFilters(item, session, filters)) continue
      rows.push(buildBaseRecord(session, item))
    }
  }

  return rows
}

const createAccumulator = () => ({
  itemCount: 0,
  grossWeight: 0,
  stoneWeight: 0,
  otherWeight: 0,
  netWeight: 0,
  fineWeight: 0,
  stoneAmount: 0,
  otherAmount: 0,
  warningsCount: 0,
})

const addRecordToAccumulator = (accumulator, record) => {
  accumulator.itemCount += 1
  accumulator.grossWeight += asFiniteNumber(record.grossWeight)
  accumulator.stoneWeight += asFiniteNumber(record.stoneWeight)
  accumulator.otherWeight += asFiniteNumber(record.otherWeight)
  accumulator.netWeight += asFiniteNumber(record.netWeight)
  accumulator.fineWeight += asFiniteNumber(record.fineWeight)
  accumulator.stoneAmount += asFiniteNumber(record.stoneAmount)
  accumulator.otherAmount += asFiniteNumber(record.otherAmount)
  accumulator.warningsCount += asFiniteNumber(record.warningsCount)
}

const finalizeAccumulator = (accumulator) => ({
  itemCount: accumulator.itemCount,
  grossWeight: roundWeight(accumulator.grossWeight),
  stoneWeight: roundWeight(accumulator.stoneWeight),
  otherWeight: roundWeight(accumulator.otherWeight),
  netWeight: roundWeight(accumulator.netWeight),
  fineWeight: roundWeight(accumulator.fineWeight),
  stoneAmount: roundAmount(accumulator.stoneAmount),
  otherAmount: roundAmount(accumulator.otherAmount),
  warningsCount: accumulator.warningsCount,
})

const buildSupplierBreakdown = (records = []) => {
  const counts = new Map()
  for (const record of records) {
    const key = record.supplierName || 'Unknown Supplier'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([supplierName, itemCount]) => ({ supplierName, itemCount }))
}

const buildSessionRows = (records = []) => {
  const grouped = new Map()

  for (const record of records) {
    const key = record.sessionId
    if (!grouped.has(key)) {
      grouped.set(key, {
        sessionId: record.sessionId,
        sessionRef: record.sessionRef,
        date: record.date,
        customerName: record.customerName,
        customerPhone: record.customerPhone,
        customerArea: record.customerArea,
        customerEmail: record.customerEmail,
        salesman: record.salesman,
        status: record.status,
        lastActivityAt: record.lastActivityAt,
        suppliers: [],
        accumulator: createAccumulator(),
        records: [],
      })
    }

    const entry = grouped.get(key)
    entry.records.push(record)
    addRecordToAccumulator(entry.accumulator, record)
    if (!entry.lastActivityAt || (record.lastActivityAt && new Date(record.lastActivityAt) > new Date(entry.lastActivityAt))) {
      entry.lastActivityAt = record.lastActivityAt
    }
  }

  return Array.from(grouped.values())
    .map((entry) => {
      const suppliers = buildSupplierBreakdown(entry.records)
      return {
        sessionId: entry.sessionId,
        sessionRef: entry.sessionRef,
        date: entry.date,
        customerName: entry.customerName,
        customerPhone: entry.customerPhone,
        customerArea: entry.customerArea,
        customerEmail: entry.customerEmail,
        salesman: entry.salesman,
        suppliersSummary: suppliers,
        status: entry.status,
        lastActivityAt: entry.lastActivityAt,
        ...finalizeAccumulator(entry.accumulator),
      }
    })
    .sort((left, right) => new Date(right.date || right.lastActivityAt || 0) - new Date(left.date || left.lastActivityAt || 0))
}

const resolveGroupIdentity = (mode, record) => {
  if (mode === 'supplier') {
    return {
      groupKey: normalizeLower(record.supplierName) || 'unknown-supplier',
      groupLabel: record.supplierName || 'Unknown Supplier',
    }
  }

  if (mode === 'category') {
    if (record.category) {
      return {
        groupKey: `${normalizeLower(record.supplierName)}::${normalizeLower(record.category)}`,
        groupLabel: `${record.supplierName} - ${record.category}`,
      }
    }
    return {
      groupKey: normalizeLower(record.supplierName) || 'uncategorized',
      groupLabel: record.supplierName || 'Uncategorized',
    }
  }

  if (mode === 'karat') {
    return {
      groupKey: normalizeLower(record.karat) || 'unknown-karat',
      groupLabel: record.karat || 'Unknown Karat',
    }
  }

  if (mode === 'wastage') {
    return {
      groupKey: record.wastage === null || record.wastage === undefined ? 'unknown-wastage' : String(Number(record.wastage.toFixed(2))),
      groupLabel: formatWastageLabel(record.wastage),
    }
  }

  return {
    groupKey: record.sessionId,
    groupLabel: record.sessionRef || record.sessionId,
  }
}

const buildGroupedRows = (records = [], mode) => {
  const grouped = new Map()

  for (const record of records) {
    const identity = resolveGroupIdentity(mode, record)
    if (!grouped.has(identity.groupKey)) {
      grouped.set(identity.groupKey, {
        groupKey: identity.groupKey,
        groupLabel: identity.groupLabel,
        lastActivityAt: record.lastActivityAt,
        sessions: new Set(),
        records: [],
        accumulator: createAccumulator(),
      })
    }

    const entry = grouped.get(identity.groupKey)
    entry.records.push(record)
    entry.sessions.add(record.sessionId)
    addRecordToAccumulator(entry.accumulator, record)
    if (!entry.lastActivityAt || (record.lastActivityAt && new Date(record.lastActivityAt) > new Date(entry.lastActivityAt))) {
      entry.lastActivityAt = record.lastActivityAt
    }
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      groupKey: entry.groupKey,
      groupLabel: entry.groupLabel,
      sessionCount: entry.sessions.size,
      supplierBreakdown: buildSupplierBreakdown(entry.records),
      lastActivityAt: entry.lastActivityAt,
      ...finalizeAccumulator(entry.accumulator),
    }))
    .sort((left, right) => new Date(right.lastActivityAt || 0) - new Date(left.lastActivityAt || 0))
}

const paginateRows = (rows, page, limit) => {
  const total = rows.length
  const pages = total === 0 ? 1 : Math.ceil(total / limit)
  const currentPage = Math.min(page, pages)
  const startIndex = (currentPage - 1) * limit
  const pagedRows = rows.slice(startIndex, startIndex + limit)

  return {
    rows: pagedRows,
    total,
    page: currentPage,
    pages,
    limit,
  }
}

const buildSummaryTotals = (records = []) => {
  const accumulator = createAccumulator()
  const sessionIds = new Set()

  for (const record of records) {
    sessionIds.add(record.sessionId)
    addRecordToAccumulator(accumulator, record)
  }

  return {
    totalSessions: sessionIds.size,
    totalItems: accumulator.itemCount,
    grossWeight: roundWeight(accumulator.grossWeight),
    stoneWeight: roundWeight(accumulator.stoneWeight),
    otherWeight: roundWeight(accumulator.otherWeight),
    netWeight: roundWeight(accumulator.netWeight),
    fineWeight: roundWeight(accumulator.fineWeight),
    stoneAmount: roundAmount(accumulator.stoneAmount),
    otherAmount: roundAmount(accumulator.otherAmount),
    warningsCount: accumulator.warningsCount,
  }
}

export const buildSalesSessionReportRowsFromSessions = ({ sessions = [], filters = {} } = {}) => {
  const normalizedFilters = {
    ...filters,
    mode: normalizeMode(filters.mode),
    status: normalizeStatus(filters.status),
    warningsOnly: Boolean(filters.warningsOnly),
    supplier: normalizeMaybeFilter(filters.supplier),
    category: normalizeMaybeFilter(filters.category),
    karat: normalizeMaybeFilter(filters.karat),
    wastage: filters.wastage ?? null,
  }

  const baseRecords = flattenItems({ sessions, filters: normalizedFilters })
  if (normalizedFilters.mode === 'session') {
    return buildSessionRows(baseRecords)
  }

  return buildGroupedRows(baseRecords, normalizedFilters.mode)
}

export const buildSalesSessionReportSummaryFromSessions = ({ sessions = [], filters = {} } = {}) => {
  const normalizedFilters = {
    ...filters,
    mode: normalizeMode(filters.mode),
    status: normalizeStatus(filters.status),
    warningsOnly: Boolean(filters.warningsOnly),
    supplier: normalizeMaybeFilter(filters.supplier),
    category: normalizeMaybeFilter(filters.category),
    karat: normalizeMaybeFilter(filters.karat),
    wastage: filters.wastage ?? null,
  }

  const baseRecords = flattenItems({ sessions, filters: normalizedFilters })
  const totals = buildSummaryTotals(baseRecords)

  return {
    mode: normalizedFilters.mode,
    status: normalizedFilters.status,
    ...totals,
  }
}

const fetchReportSessions = async (filters) => {
  const query = await buildSessionQuery(filters)
  const sessions = await CaptureSession.find(query)
    .select({
      sessionRef: 1,
      customerId: 1,
      customerName: 1,
      customerPhone: 1,
      customerArea: 1,
      customerEmail: 1,
      assignedSalesmanId: 1,
      status: 1,
      createdAt: 1,
      updatedAt: 1,
      syncedAt: 1,
      lockedSettingsSnapshot: 1,
      mobileItems: 1,
      mobileWarningCounts: 1,
      totals: 1,
    })
    .populate('assignedSalesmanId', 'name email phone role')
    .lean()

  return sessions
}

export const listSalesSessionReports = async (query = {}) => {
  const filters = normalizeFilters(query)
  const sessions = await fetchReportSessions(filters)
  const rows = buildSalesSessionReportRowsFromSessions({ sessions, filters })
  const pagination = paginateRows(rows, filters.page, filters.limit)

  return {
    mode: filters.mode,
    status: filters.status,
    rows: pagination.rows,
    total: pagination.total,
    page: pagination.page,
    pages: pagination.pages,
    limit: pagination.limit,
  }
}

export const getSalesSessionReportsSummary = async (query = {}) => {
  const filters = normalizeFilters(query)
  const sessions = await fetchReportSessions(filters)
  return buildSalesSessionReportSummaryFromSessions({ sessions, filters })
}

export const listSalesSessionReportExportData = async (query = {}) => {
  const filters = normalizeFilters(query)
  const sessions = await fetchReportSessions(filters)
  const rows = buildSalesSessionReportRowsFromSessions({ sessions, filters })
  const summary = buildSalesSessionReportSummaryFromSessions({ sessions, filters })

  return {
    mode: filters.mode,
    status: filters.status,
    filters,
    rows,
    total: rows.length,
    summary,
  }
}

export {
  normalizeFilters as normalizeSalesSessionReportFilters,
}

