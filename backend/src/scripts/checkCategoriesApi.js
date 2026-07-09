import mongoose from 'mongoose'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { CaptureSession } from '../models/CaptureSession.js'
import { buildSessionDetail } from '../services/captureSession.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.join(__dirname, '../../.env') })

async function checkCustomer() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const sessions = await CaptureSession.find({ customerName: { $regex: /new1/i } }).sort({ createdAt: -1 })
  
  if (sessions.length === 0) {
    console.log('No sessions found for customer new1')
    process.exit(0)
  }
  
  const latest = sessions[0]
  
  // This simulates exactly what GET /api/v1/capture-sessions/:id/summary returns
  const summary = buildSessionDetail(latest.toObject(), [])
  
  console.log(`Summary Backend ID: ${summary.id}`)
  
  for (const item of summary.items || []) {
    if (item.supplierName && (item.supplierName.toLowerCase().includes('aayra') || item.supplierName.toLowerCase().includes('utsav'))) {
      console.log(`- Item from API: supplier=${item.supplierName}, category='${item.category}', itemCode='${item.itemCode}'`)
    }
  }
  
  process.exit(0)
}

checkCustomer().catch(console.error)
