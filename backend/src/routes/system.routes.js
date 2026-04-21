import { Router } from 'express'
import { getHealth, getStatusPage } from '../controllers/system.controller.js'

const router = Router()

router.get('/', getStatusPage)
router.get('/api/v1/health', getHealth)

export default router
