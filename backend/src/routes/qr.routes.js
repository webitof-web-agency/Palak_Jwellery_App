import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware.js'
import { finalizeQrIngestion, getQrIngestion, ingestQr } from '../controllers/qr.controller.js'

const router = Router()

router.use(authenticate)

router.post('/ingest', ingestQr)
router.get('/:id', getQrIngestion)
router.patch('/:id/finalize', finalizeQrIngestion)

export default router
