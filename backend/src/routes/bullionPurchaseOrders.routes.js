import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'
import {
  createBullionPurchaseOrder,
  listBullionPurchaseOrders,
  markBullionPurchaseOrderDone,
} from '../controllers/bullionSales.controllers.js'

const router = Router()

router.use(authenticate)
router.use(requireRole('admin'))

router.post('/', createBullionPurchaseOrder)
router.get('/', listBullionPurchaseOrders)
router.patch('/:id/done', markBullionPurchaseOrderDone)

export default router

