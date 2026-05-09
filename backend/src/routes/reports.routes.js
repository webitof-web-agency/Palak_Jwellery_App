import express from 'express'
import { getAdminSummary, getMySummary } from '../controllers/reports.controller.js'
import {
  exportQrCsv,
  exportQrPdf,
  getQrDashboardSummary,
  getQrReportDetail,
  listQrReports,
} from '../controllers/qrReports.controller.js'
import {
  exportSettlementCsv,
  exportSettlementPdf,
  getSettlementSummary,
  listSettlementReports,
} from '../controllers/settlementReports.controller.js'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'

const router = express.Router()

// Admin dashboard summary (default last 30 days)
router.get('/summary', authenticate, requireRole('admin'), getAdminSummary)

// Salesman personal summary (today IST)
router.get('/summary/me', authenticate, getMySummary)

// QR valuation dashboard and exports
router.get('/qr/summary', authenticate, requireRole('admin'), getQrDashboardSummary)
router.get('/qr/export.csv', authenticate, requireRole('admin'), exportQrCsv)
router.get('/qr/export.pdf', authenticate, requireRole('admin'), exportQrPdf)
router.get('/qr/:id', authenticate, requireRole('admin'), getQrReportDetail)
router.get('/qr', authenticate, requireRole('admin'), listQrReports)

router.get('/settlement/summary', authenticate, requireRole('admin'), getSettlementSummary)
router.get('/settlement/export.csv', authenticate, requireRole('admin'), exportSettlementCsv)
router.get('/settlement/export.pdf', authenticate, requireRole('admin'), exportSettlementPdf)
router.get('/settlement', authenticate, requireRole('admin'), listSettlementReports)

export default router
