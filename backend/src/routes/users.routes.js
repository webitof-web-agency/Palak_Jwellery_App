import express from 'express'
import * as usersController from '../controllers/users.controllers.js'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'

const router = express.Router()

// All user routes are protected and restricted to admin
router.use(authenticate)
router.use(requireRole('admin'))

router.route('/')
  .get(usersController.listUsers)
  .post(usersController.createUser)

router.route('/:id')
  .patch(usersController.updateUser)
  .delete(usersController.deleteUser)

router.patch('/:id/toggle-status', usersController.toggleStatus)

export default router
