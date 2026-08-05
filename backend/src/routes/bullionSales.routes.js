import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware.js'
import {
  createBullionSale,
  getBullionSaleDetail,
  getBullionSalesAnalyticsSummary,
  listBullionSales,
  listBullionSalesByCustomer,
} from '../controllers/bullionSales.controllers.js'

const router = Router()

router.use(authenticate)

router.get('/analytics/summary', getBullionSalesAnalyticsSummary)
router.get('/customer/:customerId', listBullionSalesByCustomer)
router.get('/', listBullionSales)
router.get('/:id', getBullionSaleDetail)
router.post('/', createBullionSale)

export default router

