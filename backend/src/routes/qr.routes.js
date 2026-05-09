import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'
import {
  approveQrIngestion,
  finalizeQrIngestion,
  getQrIngestion,
  ingestQr,
  markReviewedQrIngestion,
  saveQrCorrections,
} from '../controllers/qr.controller.js'

const router = Router()

router.use(authenticate)

router.post('/ingest', ingestQr)
router.get('/:id', getQrIngestion)
router.patch('/:id/finalize', finalizeQrIngestion)
router.patch('/:id/corrections', requireRole('admin'), saveQrCorrections)
router.patch('/:id/approve', requireRole('admin'), approveQrIngestion)
router.patch('/:id/reviewed', requireRole('admin'), markReviewedQrIngestion)

export default router
