import mongoose from 'mongoose'
import { CaptureSession } from '../models/CaptureSession.js'

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
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' }
    }

    // 1. Overall Totals
    const totals = await CaptureSession.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 }, // Counting sessions
          totalNetWeight: { $sum: '$totals.netWeight' },
          totalGrossWeight: { $sum: '$totals.grossWeight' },
        }
      }
    ])

    const overall = totals[0] || {
      totalSales: 0,
      totalNetWeight: 0,
      totalGrossWeight: 0,
    }

    // 2. By Supplier
    const bySupplierRaw = await CaptureSession.aggregate([
      { $match: matchQuery },
      { $unwind: { path: '$mobileItems', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$mobileItems.supplierName',
          salesCount: { $sum: 1 }, // Counting items per supplier
          netWeight: { $sum: '$mobileItems.netWeight' },
          grossWeight: { $sum: '$mobileItems.grossWeight' },
        }
      },
      {
        $project: {
          name: { $ifNull: ['$_id', 'Unknown'] },
          salesCount: 1,
          netWeight: 1,
          grossWeight: 1,
        }
      },
      { $sort: { netWeight: -1 } }
    ])

    // 3. By Salesman
    const bySalesmanRaw = await CaptureSession.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$assignedSalesmanId',
          salesCount: { $sum: 1 },
          netWeight: { $sum: '$totals.netWeight' },
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
    const byCategoryRaw = await CaptureSession.aggregate([
      { $match: matchQuery },
      { $unwind: { path: '$mobileItems', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$mobileItems.category',
          salesCount: { $sum: 1 },
          netWeight: { $sum: '$mobileItems.netWeight' },
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

    const summary = await CaptureSession.aggregate([
      {
        $match: {
          assignedSalesmanId: new mongoose.Types.ObjectId(req.user._id || req.user.id),
          createdAt: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          todaySales: { $sum: 1 },
          todayNetWeight: { $sum: '$totals.netWeight' },
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
