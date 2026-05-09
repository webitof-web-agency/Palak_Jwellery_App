import mongoose from 'mongoose'
import { QrIngestion } from '../models/QrIngestion.js'
import {
  buildCsvExport,
  buildDashboardSummary,
  buildPdfBuffer,
  buildReportDetail,
  buildReportQuery,
  filterReportRows,
  mapReportRow,
} from '../services/qrReporting.service.js'

const sendSuccess = (res, data, message, status = 200) => {
  const payload = { success: true, data }
  if (message) payload.message = message
  return res.status(status).json(payload)
}

const sendError = (res, status, error, code) => res.status(status).json({ success: false, error, code })

const getFilteredIngestions = async (req) => {
  const query = buildReportQuery(req.query || {})
  return QrIngestion.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .lean()
}

export const getQrDashboardSummary = async (req, res) => {
  try {
    const records = await getFilteredIngestions(req)
    return sendSuccess(res, buildDashboardSummary(records))
  } catch (error) {
    return sendError(res, 500, 'Failed to load QR dashboard summary', 'SERVER_ERROR')
  }
}

export const listQrReports = async (req, res) => {
  try {
    const records = await getFilteredIngestions(req)
    return sendSuccess(res, records.map((record) => buildReportDetail(record)))
  } catch (error) {
    return sendError(res, 500, 'Failed to load QR reports', 'SERVER_ERROR')
  }
}

export const getQrReportDetail = async (req, res) => {
  try {
    const reportId = req.params.id
    if (!mongoose.isValidObjectId(reportId)) {
      return sendError(res, 400, 'Invalid QR ingestion id', 'INVALID_ID')
    }

    const record = await QrIngestion.findById(reportId).lean()
    if (!record) {
      return sendError(res, 404, 'QR ingestion not found', 'NOT_FOUND')
    }

    return sendSuccess(res, buildReportDetail(record))
  } catch (error) {
    return sendError(res, 500, 'Failed to load QR report detail', 'SERVER_ERROR')
  }
}

export const exportQrCsv = async (req, res) => {
  try {
    const records = await getFilteredIngestions(req)
    const csv = buildCsvExport(records.map((record) => mapReportRow(record)))
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="qr-report-${timestamp}.csv"`)
    return res.status(200).send(csv)
  } catch (error) {
    return sendError(res, 500, 'Failed to export QR CSV', 'SERVER_ERROR')
  }
}

export const exportQrPdf = async (req, res) => {
  try {
    const records = await getFilteredIngestions(req)
    const rows = records.map((record) => mapReportRow(record))
    const summary = buildDashboardSummary(records)
    const buffer = buildPdfBuffer(rows, summary, {
      supplier: req.query?.supplier || 'All',
      reportDate: req.query?.reportDate || new Date().toISOString().slice(0, 10),
    })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="qr-report-${timestamp}.pdf"`)
    return res.status(200).send(buffer)
  } catch (error) {
    return sendError(res, 500, 'Failed to export QR PDF', 'SERVER_ERROR')
  }
}
