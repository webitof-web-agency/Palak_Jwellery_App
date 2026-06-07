import {
  buildScopedSummary,
  buildSettlementCsv,
  buildSettlementDetail,
  buildSettlementPdfBuffer,
  buildSettlementPdfHtml,
  buildSettlementSummary,
  getScopeRows,
  listSettlementRows,
  normalizeReportScope,
} from '../services/settlementReports.service.js'
import {
  SettlementScopedExportError,
  buildSessionExportData,
  buildSessionExportFileName,
  buildSupplierSectionExportData,
  buildSupplierSectionExportFileName,
  renderSessionCsv,
  renderSessionPdf,
  renderSupplierSectionCsv,
  renderSupplierSectionPdf,
  buildSupplierSectionPdfHtml,
  buildSessionPdfHtml,
} from '../services/settlementScopedExports.service.js'

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

const setAttachmentHeaders = (res, fileName, contentType) => {
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
}

export const getSettlementSummary = async (req, res) => {
  try {
    const scope = normalizeReportScope(req.query.scope)
    if (scope === 'item-ledger') {
      const { rows, summary } = await listSettlementRows(req.query)
      return sendSuccess(res, {
        ...summary,
        total_items: rows.length,
      })
    }

    const { rows } = await getScopeRows(scope, req.query)
    const summary = buildScopedSummary(scope, rows)
    return sendSuccess(res, {
      ...summary,
      scope,
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to load settlement summary', 'SERVER_ERROR')
  }
}

export const listSettlementReports = async (req, res) => {
  try {
    const scope = normalizeReportScope(req.query.scope)
    if (scope === 'item-ledger') {
      const { rows } = await listSettlementRows(req.query)
      return sendSuccess(res, rows.map((row) => buildSettlementDetail(row)))
    }

    const result = await getScopeRows(scope, req.query)
    return sendSuccess(res, {
      scope,
      rows: result.rows,
      total: result.total,
      page: result.page,
      pages: result.pages,
      limit: result.limit,
    })
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

export const exportSupplierSectionCsv = async (req, res) => {
  try {
    const revision = req.query?.revision ?? null
    const data = await buildSupplierSectionExportData(req.params.batchId, revision)
    const fileName = buildSupplierSectionExportFileName(data.batch, data.revision, 'csv')
    const csv = renderSupplierSectionCsv(data)
    setAttachmentHeaders(res, fileName, 'text/csv; charset=utf-8')
    return res.status(200).send(csv)
  } catch (error) {
    if (error instanceof SettlementScopedExportError) {
      return sendError(res, error.statusCode || 400, error.message, error.code || 'EXPORT_FAILED')
    }
    return sendError(res, 500, 'Failed to export supplier section CSV', 'EXPORT_FAILED')
  }
}

export const exportSupplierSectionPdf = async (req, res) => {
  try {
    const revision = req.query?.revision ?? null
    const data = await buildSupplierSectionExportData(req.params.batchId, revision)
    const fileName = buildSupplierSectionExportFileName(data.batch, data.revision, 'pdf')
    const buffer = await renderSupplierSectionPdf(data)
    setAttachmentHeaders(res, fileName, 'application/pdf')
    return res.status(200).send(buffer)
  } catch (error) {
    if (error instanceof SettlementScopedExportError) {
      return sendError(res, error.statusCode || 400, error.message, error.code || 'EXPORT_FAILED')
    }
    return sendError(res, 500, 'Failed to export supplier section PDF', 'EXPORT_FAILED')
  }
}

export const exportSessionCsv = async (req, res) => {
  try {
    const data = await buildSessionExportData(req.params.sessionId)
    const fileName = buildSessionExportFileName(data.session, 'csv')
    const csv = renderSessionCsv(data)
    setAttachmentHeaders(res, fileName, 'text/csv; charset=utf-8')
    return res.status(200).send(csv)
  } catch (error) {
    if (error instanceof SettlementScopedExportError) {
      return sendError(res, error.statusCode || 400, error.message, error.code || 'EXPORT_FAILED')
    }
    return sendError(res, 500, 'Failed to export session CSV', 'EXPORT_FAILED')
  }
}

export const exportSessionPdf = async (req, res) => {
  try {
    const data = await buildSessionExportData(req.params.sessionId)
    const fileName = buildSessionExportFileName(data.session, 'pdf')
    const buffer = await renderSessionPdf(data)
    setAttachmentHeaders(res, fileName, 'application/pdf')
    return res.status(200).send(buffer)
  } catch (error) {
    if (error instanceof SettlementScopedExportError) {
      return sendError(res, error.statusCode || 400, error.message, error.code || 'EXPORT_FAILED')
    }
    return sendError(res, 500, 'Failed to export session PDF', 'EXPORT_FAILED')
  }
}

export const exportSettlementHtml = async (req, res) => {
  try {
    const { rows, summary } = await listSettlementRows(req.query)
    const html = await buildSettlementPdfHtml(rows, summary, {
      supplier: req.query?.supplier || 'All',
      reportDate: new Date().toISOString().slice(0, 10),
    })
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' data:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline' https://fonts.googleapis.com; font-src * data: https://fonts.gstatic.com; img-src * data:;")
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch (error) {
    return sendError(res, 500, 'Failed to export settlement HTML', 'SERVER_ERROR')
  }
}

export const exportSupplierSectionHtml = async (req, res) => {
  try {
    const revision = req.query?.revision ?? null
    const data = await buildSupplierSectionExportData(req.params.batchId, revision)
    const html = await buildSupplierSectionPdfHtml(data)
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' data:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline' https://fonts.googleapis.com; font-src * data: https://fonts.gstatic.com; img-src * data:;")
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch (error) {
    if (error instanceof SettlementScopedExportError) {
      return sendError(res, error.statusCode || 400, error.message, error.code || 'EXPORT_FAILED')
    }
    return sendError(res, 500, 'Failed to export supplier section HTML', 'EXPORT_FAILED')
  }
}

export const exportSessionHtml = async (req, res) => {
  try {
    const data = await buildSessionExportData(req.params.sessionId)
    const html = await buildSessionPdfHtml(data)
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' data:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline' https://fonts.googleapis.com; font-src * data: https://fonts.gstatic.com; img-src * data:;")
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch (error) {
    if (error instanceof SettlementScopedExportError) {
      return sendError(res, error.statusCode || 400, error.message, error.code || 'EXPORT_FAILED')
    }
    return sendError(res, 500, 'Failed to export session HTML', 'EXPORT_FAILED')
  }
}
