import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'
import { getBullionInventory, updateBullionInventory } from '../controllers/bullionSales.controllers.js'

const router = Router()

router.use(authenticate)

router.get('/', getBullionInventory)
router.put('/', requireRole('admin'), updateBullionInventory)

export default router

