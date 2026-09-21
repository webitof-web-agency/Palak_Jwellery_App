import { Router } from 'express'
import { getLatestVersion, downloadLatestApk } from '../controllers/appVersion.controller.js'

const router = Router()

router.get('/latest', getLatestVersion)
router.get('/download', downloadLatestApk)

export default router
