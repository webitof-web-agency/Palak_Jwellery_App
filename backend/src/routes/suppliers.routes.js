import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  parseSupplierQr,
  updateSupplier,
} from '../controllers/suppliers.controller.js'

const router = Router()

router.use(authenticate)

router.get('/', listSuppliers)
router.post('/parse-qr', parseSupplierQr)
router.post('/', requireRole('admin'), createSupplier)
router.put('/:id', requireRole('admin'), updateSupplier)
router.delete('/:id', requireRole('admin'), deleteSupplier)

export default router
