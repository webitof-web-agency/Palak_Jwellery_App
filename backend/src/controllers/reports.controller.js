import mongoose from 'mongoose'
import { Sale } from '../models/Sale.js'

const sendSuccess = (res, data, status = 200) => res.status(status).json({ success: true, data })
const sendError = (res, status, error, code) => res.status(status).json({ success: false, error, code })

const getISTRange = (fromStr, toStr) => {
  const todayIST = new Date(Date.now() + 330 * 60000)
  const from = fromStr || todayIST.toISOString().split('T')[0]
  const to = toStr || from

  const startDate = new Date(`${from}T00:00:00.000Z`)
  const endDate = new Date(`${to}T23:59:59.999Z`)

  startDate.setTime(startDate.getTime() - 330 * 60000)
  endDate.setTime(endDate.getTime() - 330 * 60000)

  return { start: startDate, end: endDate }
}

export const getAdminSummary = async (req, res) => {
  try {
    const { from, to } = req.query
    const { start, end } = getISTRange(from, to)

    const matchQuery = {
      saleDate: { $gte: start, $lte: end }
    }

    // 1. Overall Totals
    const totals = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalNetWeight: { $sum: '$netWeight' },
          totalGrossWeight: { $sum: '$grossWeight' },
        }
      }
    ])

    const overall = totals[0] || {
      totalSales: 0,
      totalNetWeight: 0,
      totalGrossWeight: 0,
    }

    // 2. By Supplier
    const bySupplierRaw = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$supplier',
          salesCount: { $sum: 1 },
          netWeight: { $sum: '$netWeight' },
          grossWeight: { $sum: '$grossWeight' },
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplierInfo'
        }
      },
      { $unwind: { path: '$supplierInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$supplierInfo.name', 'Unknown'] },
          salesCount: 1,
          netWeight: 1,
          grossWeight: 1,
        }
      },
      { $sort: { netWeight: -1 } }
    ])

    // 3. By Salesman
    const bySalesmanRaw = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$salesman',
          salesCount: { $sum: 1 },
          netWeight: { $sum: '$netWeight' },
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'salesmanInfo'
        }
      },
      { $unwind: { path: '$salesmanInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$salesmanInfo.name', 'Unknown'] },
          salesCount: 1,
          netWeight: 1,
        }
      },
      { $sort: { netWeight: -1 } }
    ])

    // 4. By Category
    const byCategoryRaw = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          salesCount: { $sum: 1 },
          netWeight: { $sum: '$netWeight' },
        }
      },
      {
        $project: {
          name: { $ifNull: ['$_id', 'Unknown'] },
          salesCount: 1,
          netWeight: 1,
        }
      },
      { $sort: { netWeight: -1 } }
    ])

    const formatBreakdown = (list) => list.map(item => ({
      name: item.name || 'Unknown',
      salesCount: item.salesCount,
      netWeight: item.netWeight,
      grossWeight: item.grossWeight,
    }))

    return sendSuccess(res, {
      totalSales: overall.totalSales,
      totalNetWeight: overall.totalNetWeight,
      totalGrossWeight: overall.totalGrossWeight,
      bySupplier: formatBreakdown(bySupplierRaw) || [],
      bySalesman: formatBreakdown(bySalesmanRaw) || [],
      byCategory: formatBreakdown(byCategoryRaw) || [],
    })
  } catch (error) {
    console.error('getAdminSummary error:', error)
    return sendError(res, 500, 'Failed to generate report', 'SERVER_ERROR')
  }
}

export const getMySummary = async (req, res) => {
  try {
    const { start, end } = getISTRange()

    const summary = await Sale.aggregate([
      {
        $match: {
          salesman: new mongoose.Types.ObjectId(req.user._id || req.user.id),
          saleDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          todaySales: { $sum: 1 },
          todayNetWeight: { $sum: '$netWeight' },
        }
      }
    ])

    const data = summary[0] || { todaySales: 0, todayNetWeight: 0 }
    
    return sendSuccess(res, {
      todaySales: data.todaySales,
      todayNetWeight: data.todayNetWeight,
    })
  } catch (error) {
    console.error('getMySummary error:', error)
    return sendError(res, 500, 'Failed to load personal summary', 'SERVER_ERROR')
  }
}
