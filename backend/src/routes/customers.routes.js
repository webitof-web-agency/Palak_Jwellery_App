import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'
import {
  archiveCustomer,
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from '../controllers/customers.controllers.js'

const router = Router()

router.use(authenticate)
router.use(requireRole('admin'))

router.get('/', listCustomers)
router.get('/:id', getCustomerById)
router.post('/', createCustomer)
router.patch('/:id', updateCustomer)
router.patch('/:id/archive', archiveCustomer)
router.delete('/:id', deleteCustomer)

export default router
