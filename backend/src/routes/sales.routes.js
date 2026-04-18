import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware.js'
import { createSale, listSales, getTodaySummary } from '../controllers/sales.controller.js'

const router = Router()

router.use(authenticate)

router.get('/summary/today', getTodaySummary)
router.get('/', listSales)
router.post('/', createSale)

export default router
