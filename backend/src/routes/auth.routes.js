import { Router } from 'express'
import { login, getMe, resetPassword } from '../controllers/auth.controller.js'
import { authenticate, requireRole } from '../middleware/auth.middleware.js'

const router = Router()

router.post('/login', login)
router.get('/me', authenticate, getMe)
router.post('/reset-password', authenticate, requireRole('admin'), resetPassword)

export default router
