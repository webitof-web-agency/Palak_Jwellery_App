import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'
import {
  createBusinessOption,
  deleteBusinessOption,
  getBusinessOverview,
  listBusinessOptions,
  listSettlementSettings,
  upsertSettlementSettings,
  updateBusinessOption,
} from '../controllers/business.controller.js'

const router = Router()

router.use(authenticate)
router.use(requireRole('admin'))

router.get('/overview', getBusinessOverview)
router.get('/options', listBusinessOptions)
router.post('/options', createBusinessOption)
router.put('/options/:id', updateBusinessOption)
router.delete('/options/:id', deleteBusinessOption)
router.get('/settings', listSettlementSettings)
router.put('/settings', upsertSettlementSettings)

export default router
