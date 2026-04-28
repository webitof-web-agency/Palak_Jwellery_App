import mongoose from 'mongoose'
import { Sale, hashQR } from '../models/Sale.js'
import { Supplier } from '../models/Supplier.js'
import { User } from '../models/User.js'

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
    'Metal Type',
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
    sale.metalType || '',
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
    } = req.body

    const idempotencyKey = req.headers['x-idempotency-key']

    // --- Idempotency Check ---
    if (idempotencyKey) {
      const existingRequest = await Sale.findOne({ idempotencyKey }).lean()
      if (existingRequest) {
        // Return exactly what was returned previously for the same attempt.
        return sendSuccess(
          res,
          {
            _id: existingRequest._id,
            ref: '#' + existingRequest._id.toString().slice(-6).toUpperCase(),
            saleDate: existingRequest.saleDate,
            isDuplicate: existingRequest.isDuplicate,
            category: existingRequest.category ?? null,
            itemCode: existingRequest.itemCode ?? null,
            metalType: existingRequest.metalType ?? null,
            purity: existingRequest.purity ?? null,
            notes: existingRequest.notes ?? null,
            netWeight: existingRequest.netWeight ?? null,
          },
          'Sale recorded successfully (Indempotent cached response)',
          201
        )
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
      category: category && typeof category === 'string' && category.trim() ? category.trim() : null,
      itemCode: itemCode && typeof itemCode === 'string' && itemCode.trim() ? itemCode.trim() : null,
      metalType: metalType && typeof metalType === 'string' && metalType.trim() ? metalType.trim() : null,
      purity: purity && typeof purity === 'string' && purity.trim() ? purity.trim() : null,
      notes: notes && typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      grossWeight: gw,
      stoneWeight: sw,
      netWeight: nw,
      // Amounts are intentionally not used in the current product slice.
      // Kept as zero for backward-compatible schema requirements.
      ratePerGram: 0,
      totalValue: 0,
      isDuplicate,
      wasManuallyEdited: !qrRaw,
      saleDate: new Date(),
    })

    return sendSuccess(
      res,
      {
        _id: sale._id,
        ref: '#' + sale._id.toString().slice(-6).toUpperCase(),
        saleDate: sale.saleDate,
        isDuplicate: sale.isDuplicate,
        category: sale.category,
        itemCode: sale.itemCode,
        metalType: sale.metalType,
        purity: sale.purity,
        notes: sale.notes,
        netWeight: sale.netWeight,
      },
      'Sale recorded successfully',
      201
    )
  } catch (error) {
    console.error('createSale error:', error)
    // Handle mongoose unique constraint error safely
    if (error.code === 11000 && error.keyPattern && error.keyPattern.idempotencyKey) {
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
        .populate('supplier', 'name code')
        .populate('salesman', 'name')
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
