import {
  SalesSessionReportsError,
  getSalesSessionReportsSummary as getSalesSessionReportsSummaryService,
  listSalesSessionReports,
} from '../services/salesSessionReports.service.js'
import {
  buildSalesSessionReportCsvExport,
  buildSalesSessionReportPdfExport,
} from '../services/salesSessionReportExports.service.js'

const sendSuccess = (res, data, status = 200) => res.status(status).json({ success: true, data })

const sendError = (res, status, error, code, extra = {}) => (
  res.status(status).json({ success: false, error, code, ...extra })
)

const handleReportsError = (res, operation, error) => {
  console.error(`${operation} error:`, {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    statusCode: error?.statusCode,
  })

  if (error instanceof SalesSessionReportsError || error?.statusCode) {
    const status = error.statusCode || 400
    const extra = error.details ? { details: error.details } : {}
    return sendError(res, status, error.message || 'Failed to load sales session reports', error.code || 'SALES_SESSION_REPORTS_ERROR', extra)
  }

  return sendError(res, 500, 'Failed to load sales session reports', 'SERVER_ERROR')
}

export const getSalesSessionReports = async (req, res) => {
  try {
    const data = await listSalesSessionReports(req.query)
    return sendSuccess(res, data)
  } catch (error) {
    return handleReportsError(res, 'getSalesSessionReports', error)
  }
}

export const getSalesSessionReportsSummary = async (req, res) => {
  try {
    const data = await getSalesSessionReportsSummaryService(req.query)
    return sendSuccess(res, data)
  } catch (error) {
    return handleReportsError(res, 'getSalesSessionReportsSummary', error)
  }
}

export const exportSalesSessionReportsCsv = async (req, res) => {
  try {
    const data = await buildSalesSessionReportCsvExport(req.query)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${data.fileName}"`)
    return res.status(200).send(data.csv)
  } catch (error) {
    return handleReportsError(res, 'exportSalesSessionReportsCsv', error)
  }
}

export const exportSalesSessionReportsPdf = async (req, res) => {
  try {
    const data = await buildSalesSessionReportPdfExport(req.query)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${data.fileName}"`)
    return res.status(200).send(data.buffer)
  } catch (error) {
    return handleReportsError(res, 'exportSalesSessionReportsPdf', error)
  }
}
