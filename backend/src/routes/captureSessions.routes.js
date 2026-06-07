import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware.js'
import {
  attachExistingBatchToSession,
  cancelSession,
  createSession,
  createSupplierBatchInSession,
  finalizeSession,
  getSessionDetail,
  listSessions,
  refreshSessionAggregates,
  submitSession,
} from '../controllers/captureSessions.controller.js'

const router = Router()

router.use(authenticate)

router.get('/', listSessions)
router.post('/', createSession)
router.post('/:id/refresh', refreshSessionAggregates)
router.get('/:id', getSessionDetail)
router.post('/:id/batches', createSupplierBatchInSession)
router.post('/:id/batches/attach', attachExistingBatchToSession)
router.post('/:id/submit', submitSession)
router.post('/:id/finalize', finalizeSession)
router.post('/:id/cancel', cancelSession)

export default router
