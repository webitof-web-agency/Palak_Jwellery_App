import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'
import {
  addBatchItems,
  createBatch,
  finalizeBatch,
  getBatchDetail,
  getBatchRevisions,
  listBatches,
  reopenBatch,
  submitBatch,
  updateBatchAssignment,
} from '../controllers/batches.controller.js'

const router = Router()

router.use(authenticate)

router.get('/', listBatches)
router.post('/', createBatch)
router.get('/:id/revisions', getBatchRevisions)
router.get('/:id', getBatchDetail)
router.post('/:id/items', addBatchItems)
router.post('/:id/submit', submitBatch)
router.post('/:id/finalize', requireRole('admin'), finalizeBatch)
router.post('/:id/reopen', requireRole('admin'), reopenBatch)
router.patch('/:id/assignment', requireRole('admin'), updateBatchAssignment)

export default router
