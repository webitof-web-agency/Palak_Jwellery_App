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
router.get('/', listCustomers)
router.get('/:id', getCustomerById)
router.post('/', createCustomer)

router.use(requireRole('admin'))
router.patch('/:id', updateCustomer)
router.patch('/:id/archive', archiveCustomer)
router.delete('/:id', deleteCustomer)

export default router
