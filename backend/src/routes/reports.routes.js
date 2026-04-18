import express from 'express'
import { getAdminSummary, getMySummary } from '../controllers/reports.controller.js'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'

const router = express.Router()

// Admin dashboard summary (default last 30 days)
router.get('/summary', authenticate, requireRole('admin'), getAdminSummary)

// Salesman personal summary (today IST)
router.get('/summary/me', authenticate, getMySummary)

export default router
