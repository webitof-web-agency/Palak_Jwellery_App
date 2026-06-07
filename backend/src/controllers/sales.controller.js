import mongoose from 'mongoose'
import { Sale, hashQR } from '../models/Sale.js'
import { ScanBatch } from '../models/ScanBatch.js'
import { Supplier } from '../models/Supplier.js'
import { User } from '../models/User.js'
import { loadSettlementSettings } from '../services/settlementSettings.service.js'
import { loadKaratOptions } from '../services/karatOptions.service.js'
import {
  buildSaleCalculationSnapshot,
  buildSaleParsedSnapshot,
  buildSaleSettlementInputs,
} from '../services/saleCalculationSnapshot.service.js'
import {
  BatchServiceError,
  buildBatchSummary,
  ensureBatchMutationAllowed,
  refreshBatchAggregates,
} from '../services/batch.service.js'

const sendSuccess = (res, data, message, status = 200) => {
  const payload = { success: true, data }
  if (message) payload.message = message
  return res.status(status).json(payload)
}

const sendError = (res, status, error, code, extra = {}) => {
  return res.status(status).json({ success: false, error, code, ...extra })
}

const normalizeSort = (sortBy, sortOrder) => {
  const field = typeof sortBy === 'string' ? sortBy.trim() : 'saleDate'
  const order = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1

  switch (field) {
    case 'saleDate':
      return { saleDate: order }
    case 'netWeight':
      return { netWeight: order, saleDate: -1 }
    default:
      return { saleDate: -1 }
  }
}

const buildSalesQuery = async ({
  user,
  supplier,
  salesman,
  startDate,
  endDate,
  q,
  searchScope,
  duplicatesOnly,
}) => {
  const query = {}

  if (user.role !== 'admin') {
    query.salesman = user.id
  } else if (salesman) {
    if (mongoose.isValidObjectId(salesman)) {
      query.salesman = salesman
    } else {
      const matches = await User.find(
        { name: { $regex: salesman, $options: 'i' } },
        { _id: 1 }
      ).lean()
      query.salesman = { $in: matches.map((u) => u._id) }
    }
  }

  if (supplier) {
    if (mongoose.isValidObjectId(supplier)) {
      query.supplier = supplier
    } else {
      const matches = await Supplier.find(
        { name: { $regex: supplier, $options: 'i' } },
        { _id: 1 }
      ).lean()
      query.supplier = { $in: matches.map((s) => s._id) }
    }
  }

  if (startDate || endDate) {
    query.saleDate = {}
    if (startDate) query.saleDate.$gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.saleDate.$lte = end
    }
  }

  if (duplicatesOnly) {
    query.isDuplicate = true
  }

  const searchText = String(q || '').trim()
  if (searchText) {
    const scope = String(searchScope || 'all').toLowerCase()
    const orConditions = []

    if (scope === 'all' || scope === 'details') {
      orConditions.push(
        { category: { $regex: searchText, $options: 'i' } },
        { itemCode: { $regex: searchText, $options: 'i' } },
        { notes: { $regex: searchText, $options: 'i' } },
      )
    }

    if (scope === 'all' || scope === 'salesman') {
      const matches = await User.find(
        {
          $or: [
            { name: { $regex: searchText, $options: 'i' } },
            { email: { $regex: searchText, $options: 'i' } },
            { phone: { $regex: searchText, $options: 'i' } },
          ],
        },
        { _id: 1 },
      ).lean()

      if (matches.length > 0) {
        orConditions.push({ salesman: { $in: matches.map((u) => u._id) } })
      }
    }

    if (scope === 'all' || scope === 'supplier') {
      const matches = await Supplier.find(
        {
          $or: [
            { name: { $regex: searchText, $options: 'i' } },
            { code: { $regex: searchText, $options: 'i' } },
          ],
        },
        { _id: 1 },
      ).lean()

      if (matches.length > 0) {
        orConditions.push({ supplier: { $in: matches.map((s) => s._id) } })
      }
    }

    if (orConditions.length > 0) {
      query.$or = orConditions
    }
  }

  return query
}

const toSaleRef = (id) => '#' + id.toString().slice(-6).toUpperCase()

const pickParsedSnapshotInput = (body = {}) => {
  const candidates = [
    body.displaySnapshot,
    body.parsedSnapshot,
    body.parsedResult,
    body.parserResult,
    body.normalizedSnapshot,
    body.qrParsed,
  ]

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) {
      continue
    }

    if (typeof candidate === 'object') {
      return candidate
    }

    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
        continue
      }

      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === 'object') {
          return parsed
        }
      } catch {
        // Ignore malformed JSON-like payloads and continue searching.
      }
    }
  }

  return null
}

const buildSaleDetail = (sale) => {
  if (!sale) return null

  const supplier = sale.supplier && typeof sale.supplier === 'object'
    ? {
        _id: sale.supplier._id || sale.supplier.id || null,
        name: sale.supplier.name || null,
        code: sale.supplier.code || null,
      }
    : sale.supplier || null

  const salesman = sale.salesman && typeof sale.salesman === 'object'
    ? {
        _id: sale.salesman._id || sale.salesman.id || null,
        name: sale.salesman.name || null,
        email: sale.salesman.email || null,
        phone: sale.salesman.phone || null,
        role: sale.salesman.role || null,
        isActive: sale.salesman.isActive ?? null,
      }
    : sale.salesman || null

  return {
    _id: sale._id,
    ref: sale.ref || toSaleRef(sale._id),
    batchId: sale.batchId ?? null,
    saleDate: sale.saleDate,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    salesman,
    supplier,
    category: sale.category ?? null,
    itemCode: sale.itemCode ?? null,
    metalType: sale.metalType ?? null,
    purity: sale.purity ?? null,
    notes: sale.notes ?? null,
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
  }
}

const normalizeOptionalId = (value) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

const buildSaleCreateResponse = (sale, { batch = null, batchSyncWarning = false, sessionSyncWarning = false, message } = {}) => {
  const data = {
    _id: sale._id,
    ref: '#' + sale._id.toString().slice(-6).toUpperCase(),
    saleDate: sale.saleDate,
    isDuplicate: Boolean(sale.isDuplicate),
    category: sale.category ?? null,
    itemCode: sale.itemCode ?? null,
    metalType: sale.metalType ?? null,
    purity: sale.purity ?? null,
    notes: sale.notes ?? null,
    netWeight: sale.netWeight ?? null,
  }

  if (batch) {
    data.batch = batch
    data.batchSyncWarning = Boolean(batchSyncWarning)
  } else if (batchSyncWarning) {
    data.batchSyncWarning = true
  }

  if (sessionSyncWarning) {
    data.sessionSyncWarning = true
  }

  return {
    data,
    message:
      message ||
      (batchSyncWarning || sessionSyncWarning
        ? 'Sale recorded successfully. Batch or session totals may need refresh.'
        : 'Sale recorded successfully'),
  }
}

const resolveSaleEntryMode = ({ qrRaw, wasManuallyEdited, settlementInputs, body = {} } = {}) => {
  const rawQr = typeof qrRaw === 'string' ? qrRaw.trim() : ''
  const manualOverrideDetected =
    body?.wasManuallyEdited === true ||
    wasManuallyEdited === true ||
    settlementInputs?.purityOverridden === true ||
    settlementInputs?.wastageOverridden === true

  if (!rawQr) {
    return 'manual'
  }

  return manualOverrideDetected ? 'qr_scan_with_manual_override' : 'qr_scan'
}

const buildBatchSummaryFromStoredDoc = async (batchId) => {
  if (!batchId) return null

  const batchDoc = await ScanBatch.findById(batchId).lean()
  if (!batchDoc) return null

  return buildBatchSummary(batchDoc)
}

const escapeCsv = (value) => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const buildSalesCsv = (sales) => {
  const header = [
    'Reference',
    'Sale Date',
    'Salesman',
    'Supplier',
    'Category',
    'Item Code',
    'Karat',
    'Purity',
    'Gross Weight',
    'Stone Weight',
    'Net Weight',
    'Notes',
    'Duplicate',
  ]

  const rows = sales.map((sale) => [
    toSaleRef(sale._id),
    sale.saleDate instanceof Date ? sale.saleDate.toISOString() : sale.saleDate,
    sale.salesman?.name || '',
    sale.supplier?.name || '',
    sale.category || '',
    sale.itemCode || '',
    sale.karat || sale.metalType || '',
    sale.purity || '',
    sale.grossWeight ?? '',
    sale.stoneWeight ?? '',
    sale.netWeight ?? '',
    sale.notes || '',
    sale.isDuplicate ? 'Yes' : 'No',
  ])

  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')
}

// POST /api/v1/sales
export const createSale = async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key']

  try {
    const {
      supplierId,
      category,
      itemCode,
      metalType,
      purity,
      notes,
      grossWeight,
      stoneWeight,
      netWeight,
      qrRaw,
      overrideDuplicate,
      batchId: rawBatchId,
    } = req.body

    // --- Idempotency Check ---
    if (idempotencyKey) {
      const existingRequest = await Sale.findOne({ idempotencyKey }).lean()
      if (existingRequest) {
        let batchSummary = null
        let batchSyncWarning = false
        let sessionSyncWarning = false

        if (existingRequest.batchId) {
          try {
            const refreshed = await refreshBatchAggregates(existingRequest.batchId)
            batchSummary = refreshed.summary
            sessionSyncWarning = Boolean(refreshed.sessionSyncWarning)
          } catch (refreshError) {
            console.error('refreshBatchAggregates error on cached sale response:', refreshError)
            batchSummary = await buildBatchSummaryFromStoredDoc(existingRequest.batchId)
            batchSyncWarning = true
          }
        }

        const response = buildSaleCreateResponse(existingRequest, {
          batch: batchSummary,
          batchSyncWarning,
          sessionSyncWarning,
          message: (batchSyncWarning || sessionSyncWarning)
            ? 'Sale recorded successfully. Batch or session totals may need refresh.'
            : 'Sale recorded successfully (Idempotent cached response)',
        })

        return sendSuccess(res, response.data, response.message, 201)
      }
    }

    // --- Validation ---
    if (!supplierId || !mongoose.isValidObjectId(supplierId)) {
      return sendError(res, 400, 'Valid supplierId is required', 'MISSING_FIELDS')
    }
    if (grossWeight === undefined || grossWeight === null || isNaN(Number(grossWeight))) {
      return sendError(res, 400, 'grossWeight is required and must be a number', 'MISSING_FIELDS')
    }
    if (netWeight === undefined || netWeight === null || isNaN(Number(netWeight))) {
      return sendError(res, 400, 'netWeight is required and must be a number', 'MISSING_FIELDS')
    }
    const gw = Number(grossWeight)
    const sw = Number(stoneWeight ?? 0)
    const nw = Number(netWeight)

    // Strict weight validations derived from Gemini Review
    if (gw <= 0) {
      return sendError(res, 400, 'grossWeight must be > 0', 'INVALID_WEIGHT')
    }
    if (nw <= 0) {
      return sendError(res, 400, 'netWeight must be > 0', 'INVALID_WEIGHT')
    }
    if (sw < 0) {
      return sendError(res, 400, 'stoneWeight must be >= 0', 'INVALID_WEIGHT')
    }
    if (nw > gw) {
      return sendError(res, 400, 'netWeight cannot be strictly greater than grossWeight', 'INVALID_WEIGHT')
    }
    if (sw >= gw) {
      return sendError(res, 400, 'stoneWeight must be less than grossWeight', 'INVALID_WEIGHT')
    }

    // --- Supplier check ---
    const supplier = await Supplier.findById(supplierId).lean()
    if (!supplier) {
      return sendError(res, 404, 'Supplier not found', 'SUPPLIER_NOT_FOUND')
    }
    if (!supplier.isActive) {
      return sendError(res, 400, 'Supplier is not active', 'SUPPLIER_INACTIVE')
    }

    const batchId = normalizeOptionalId(rawBatchId)
    let batchContext = null
    if (batchId) {
      if (!mongoose.isValidObjectId(batchId)) {
        return sendError(res, 400, 'Invalid batch id', 'INVALID_ID')
      }

      batchContext = await ScanBatch.findById(batchId).lean()
      if (!batchContext) {
        return sendError(res, 404, 'Batch not found', 'NOT_FOUND')
      }

      try {
        ensureBatchMutationAllowed(batchContext, req.user)
      } catch (error) {
        if (error instanceof BatchServiceError) {
          return sendError(res, error.statusCode || 400, error.message, error.code || 'BATCH_ERROR')
        }
        throw error
      }

      const saleSupplierId = normalizeOptionalId(supplier._id)
      const batchSupplierId = normalizeOptionalId(batchContext.supplierId)
      if (batchSupplierId && batchSupplierId !== saleSupplierId) {
        return sendError(res, 400, 'Sale supplier must match batch supplier', 'SUPPLIER_MISMATCH')
      }
    }

    const settlementSettings = await loadSettlementSettings()
    const karatDefaults = await loadKaratOptions()
    const parsedSnapshotInput = pickParsedSnapshotInput(req.body)
    const parsedSnapshot = buildSaleParsedSnapshot(parsedSnapshotInput)
    const settlementInputs = buildSaleSettlementInputs({
      source: req.body,
      supplier,
      parsedSnapshot,
      settlementSettings,
      karatDefaults,
    })
    const calculationSnapshot = buildSaleCalculationSnapshot({
      source: req.body,
      supplier,
      parsedSnapshot,
      settlementSettings,
      settlementInputs,
      karatDefaults,
    })
    const saleEntryMode = batchContext
      ? resolveSaleEntryMode({
          qrRaw,
          wasManuallyEdited: req.body.wasManuallyEdited === true,
          settlementInputs,
          body: req.body,
        })
      : null

    // --- Duplicate QR detection ---
    const qrHash = hashQR(qrRaw)
    let isDuplicate = false

    if (qrHash && !overrideDuplicate) {
      // Check if same QR hash was EVER used. (Reverting from 'same day' limit per Gemini delivery)
      const existingSale = await Sale.findOne({ qrHash })
        .populate('salesman', 'name')
        .sort({ saleDate: -1 })
        .lean()

      if (existingSale) {
        return sendError(res, 409, 'This QR was already recorded. Save anyway?', 'DUPLICATE_QR', {
          previousSale: {
            _id: existingSale._id,
            saleDate: existingSale.saleDate,
            salesman: existingSale.salesman?.name || 'Unknown',
          },
        })
      }
    }

    if (qrHash && overrideDuplicate) {
      isDuplicate = true
    }

    // --- Save ---
    const sale = await Sale.create({
      qrRaw: qrRaw || null,
      qrHash,
      idempotencyKey: idempotencyKey || null,
      salesman: req.user.id,
      supplier: supplierId,
      batchId: batchContext?._id || null,
      revisionAdded: batchContext ? (Number(batchContext.revision) || 1) : null,
      entryMode: saleEntryMode,
      addedBy: batchContext ? req.user.id : null,
      addedAt: batchContext ? new Date() : null,
      category: category && typeof category === 'string' && category.trim() ? category.trim() : null,
      itemCode: itemCode && typeof itemCode === 'string' && itemCode.trim() ? itemCode.trim() : null,
      metalType: metalType && typeof metalType === 'string' && metalType.trim() ? metalType.trim() : null,
      purity: settlementInputs?.purityPercent !== null && settlementInputs?.purityPercent !== undefined
        ? String(settlementInputs.purityPercent)
        : (purity && typeof purity === 'string' && purity.trim() ? purity.trim() : null),
      notes: notes && typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      settlementInputs,
      calculationSnapshot,
      parsedSnapshot,
      grossWeight: gw,
      stoneWeight: sw,
      netWeight: nw,
      // Amounts are intentionally not used in the current product slice.
      // Kept as zero for backward-compatible schema requirements.
      ratePerGram: 0,
      totalValue: 0,
      isDuplicate,
      wasManuallyEdited: batchContext
        ? saleEntryMode === 'manual' ||
          saleEntryMode === 'qr_scan_with_manual_override' ||
          !qrRaw
        : !qrRaw,
      saleDate: new Date(),
    })

    let batchSummary = null
    let batchSyncWarning = false
    let sessionSyncWarning = false
    if (batchContext) {
      try {
        const refreshed = await refreshBatchAggregates(batchContext._id)
        batchSummary = refreshed.summary
        sessionSyncWarning = Boolean(refreshed.sessionSyncWarning)
      } catch (refreshError) {
        console.error('refreshBatchAggregates error after sale create:', refreshError)
        batchSummary = await buildBatchSummaryFromStoredDoc(batchContext._id)
        batchSyncWarning = true
      }
    }

    const response = buildSaleCreateResponse(sale, {
      batch: batchSummary,
      batchSyncWarning,
      sessionSyncWarning,
      message: (batchSyncWarning || sessionSyncWarning)
        ? 'Sale recorded successfully. Batch or session totals may need refresh.'
        : 'Sale recorded successfully',
    })

    return sendSuccess(res, response.data, response.message, 201)
  } catch (error) {
    console.error('createSale error:', error)
    // Handle mongoose unique constraint error safely
    if (error.code === 11000 && error.keyPattern && error.keyPattern.idempotencyKey) {
      if (idempotencyKey) {
        const existingRequest = await Sale.findOne({ idempotencyKey }).lean()
        if (existingRequest) {
          let batchSummary = null
          let batchSyncWarning = false
          let sessionSyncWarning = false

          if (existingRequest.batchId) {
            try {
              const refreshed = await refreshBatchAggregates(existingRequest.batchId)
              batchSummary = refreshed.summary
              sessionSyncWarning = Boolean(refreshed.sessionSyncWarning)
            } catch (refreshError) {
              console.error('refreshBatchAggregates error after idempotency collision:', refreshError)
              batchSummary = await buildBatchSummaryFromStoredDoc(existingRequest.batchId)
              batchSyncWarning = true
            }
          }

          const response = buildSaleCreateResponse(existingRequest, {
            batch: batchSummary,
            batchSyncWarning,
            sessionSyncWarning,
            message: (batchSyncWarning || sessionSyncWarning)
              ? 'Sale recorded successfully. Batch or session totals may need refresh.'
              : 'Sale recorded successfully (Idempotent cached response)',
          })

          return sendSuccess(res, response.data, response.message, 201)
        }
      }

      return sendError(res, 409, 'Indempotent request collision. Please retry.', 'IDEMPOTENCY_COLLISION')
    }
    return sendError(res, 500, 'Failed to save sale', 'SERVER_ERROR')
  }
}

// GET /api/v1/sales/summary/today
export const getTodaySummary = async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const query = {
      saleDate: { $gte: today, $lt: tomorrow },
    }
    
    // Scoped metrics: salesmen only see their own metrics, admins see global
    if (req.user.role !== 'admin') {
      query.salesman = new mongoose.Types.ObjectId(req.user.id)
    }

    const summary = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalGrossWeight: { $sum: '$grossWeight' },
          totalNetWeight: { $sum: '$netWeight' },
        },
      },
    ])

    const data = summary.length > 0 ? summary[0] : { count: 0, totalGrossWeight: 0, totalNetWeight: 0 }
    delete data._id

    return sendSuccess(res, data)
  } catch (error) {
    console.error('getTodaySummary error:', error)
    return sendError(res, 500, 'Failed to load summary', 'SERVER_ERROR')
  }
}

// GET /api/v1/sales (Slice 4 with queries)
export const listSales = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      supplier, 
      salesman, 
      startDate, 
      endDate,
      q,
      searchScope,
      duplicatesOnly,
      sortBy = 'saleDate',
      sortOrder = 'desc',
    } = req.query

    const p = Math.max(1, parseInt(page))
    const l = Math.max(1, Math.min(100, parseInt(limit)))
    const skip = (p - 1) * l
    const query = await buildSalesQuery({
      user: req.user,
      supplier,
      salesman,
      startDate,
      endDate,
      q,
      searchScope,
      duplicatesOnly: String(duplicatesOnly).toLowerCase() === 'true',
    })
    const sort = normalizeSort(sortBy, sortOrder)

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .sort(sort)
        .skip(skip)
        .limit(l)
        .select('-calculationSnapshot -parsedSnapshot -settlementInputs')
        .populate('supplier', 'name code')
        .populate('salesman', 'name')
        .populate('batchId', 'batchRef status revision supplierId assignedSalesmanId')
        .lean(),
      Sale.countDocuments(query)
    ])

    const salesWithRef = sales.map(({ ratePerGram, totalValue, ...sale }) => ({
      ...sale,
      ref: toSaleRef(sale._id)
    }))

    return sendSuccess(res, {
      sales: salesWithRef,
      total,
      page: p,
      pages: Math.ceil(total / l),
      sortBy,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    })
  } catch (error) {
    console.error('listSales error:', error)
    return sendError(res, 500, 'Failed to load sales', 'SERVER_ERROR')
  }
}

// GET /api/v1/sales/:id
export const getSaleDetail = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid sale id', 'INVALID_ID')
    }

    const sale = await Sale.findById(id)
      .populate('supplier', 'name code')
      .populate('salesman', 'name email phone role isActive')
      .populate('batchId', 'batchRef status revision supplierId assignedSalesmanId')
      .lean()

    if (!sale) {
      return sendError(res, 404, 'Sale not found', 'NOT_FOUND')
    }

    if (req.user.role !== 'admin' && String(sale.salesman?._id || sale.salesman) !== req.user.id) {
      return sendError(res, 403, 'Insufficient permissions', 'FORBIDDEN')
    }

    return sendSuccess(res, buildSaleDetail(sale))
  } catch (error) {
    console.error('getSaleDetail error:', error)
    return sendError(res, 500, 'Failed to load sale', 'SERVER_ERROR')
  }
}

// GET /api/v1/sales/export
export const exportSales = async (req, res) => {
  try {
    const {
      supplier,
      salesman,
      startDate,
      endDate,
      q,
      searchScope,
      duplicatesOnly,
      sortBy = 'saleDate',
      sortOrder = 'desc',
      scope = 'filtered',
    } = req.query

    const query = scope === 'all'
      ? await buildSalesQuery({
          user: req.user,
          supplier: undefined,
          salesman: undefined,
          startDate: undefined,
          endDate: undefined,
          q: undefined,
          searchScope: undefined,
          duplicatesOnly: false,
        })
      : await buildSalesQuery({
          user: req.user,
          supplier,
          salesman,
          startDate,
          endDate,
          q,
          searchScope,
          duplicatesOnly: String(duplicatesOnly).toLowerCase() === 'true',
        })

    const sort = normalizeSort(sortBy, sortOrder)

    const sales = await Sale.find(query)
      .sort(sort)
      .select('-calculationSnapshot -parsedSnapshot -settlementInputs')
      .populate('supplier', 'name code')
      .populate('salesman', 'name')
      .lean()

    const csv = buildSalesCsv(sales)
    const timestamp = new Date().toISOString().slice(0, 10)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-${scope}-${timestamp}.csv"`
    )

    return res.status(200).send(csv)
  } catch (error) {
    console.error('exportSales error:', error)
    return sendError(res, 500, 'Failed to export sales', 'SERVER_ERROR')
  }
}
