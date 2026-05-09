import { listSettlementRows, buildSettlementCsv, buildSettlementPdfBuffer, buildSettlementDetail, buildSettlementSummary } from '../services/settlementReports.service.js'

const sendSuccess = (res, data, status = 200) => res.status(status).json({ success: true, data })

const sendError = (res, status, error, code) => res.status(status).json({ success: false, error, code })

const buildSettlementFileName = (supplier = 'All', reportDate = new Date()) => {
  const safeSupplier = String(supplier || 'All')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'All'
  const datePart = new Date(reportDate).toISOString().slice(0, 10)
  return `settlement-report-${safeSupplier}-${datePart}.pdf`
}

export const getSettlementSummary = async (req, res) => {
  try {
    const { rows, summary } = await listSettlementRows(req.query)
    return sendSuccess(res, {
      ...summary,
      total_items: rows.length,
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to load settlement summary', 'SERVER_ERROR')
  }
}

export const listSettlementReports = async (req, res) => {
  try {
    const { rows } = await listSettlementRows(req.query)
    return sendSuccess(res, rows.map((row) => buildSettlementDetail(row)))
  } catch (error) {
    return sendError(res, 500, 'Failed to load settlement reports', 'SERVER_ERROR')
  }
}

export const exportSettlementCsv = async (req, res) => {
  try {
    const { rows, summary } = await listSettlementRows(req.query)
    const csv = buildSettlementCsv(rows)
    const date = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="settlement-reports-${date}.csv"`)
    return res.status(200).send(csv)
  } catch (error) {
    return sendError(res, 500, 'Failed to export settlement CSV', 'SERVER_ERROR')
  }
}

export const exportSettlementPdf = async (req, res) => {
  try {
    const { rows, summary } = await listSettlementRows(req.query)
    const fileName = buildSettlementFileName(req.query?.supplier || 'All', req.query?.reportDate || new Date())
    const buffer = await buildSettlementPdfBuffer(rows, summary, {
      supplier: req.query?.supplier || 'All',
      reportDate: new Date().toISOString().slice(0, 10),
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`)
    return res.status(200).send(buffer)
  } catch (error) {
    return sendError(res, 500, 'Failed to export settlement PDF', 'SERVER_ERROR')
  }
}
