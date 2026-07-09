import mongoose from 'mongoose'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { CaptureSession } from '../models/CaptureSession.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.join(__dirname, '../../.env') })

async function checkCustomer() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  // Find sessions for customer containing "new1"
  const sessions = await CaptureSession.find({ customerName: { $regex: /new1/i } }).sort({ createdAt: -1 })
  
  if (sessions.length === 0) {
    console.log('No sessions found for customer new1')
    process.exit(0)
  }
  
  const latest = sessions[0]
  console.log(`Found latest session for new1: ${latest.sessionRef}`)
  console.log(`Customer: ${latest.customerName}`)
  console.log(`Locked category: ${latest.lockedSettingsSnapshot?.category}`)
  
  for (const item of latest.mobileItems) {
    if (item.supplierName && (item.supplierName.toLowerCase().includes('aayra') || item.supplierName.toLowerCase().includes('utsav'))) {
      console.log(`- Item: supplier=${item.supplierName}, category=${item.category}, itemCode=${item.itemCode}, designCode=${item.parsedSnapshot?.designCode || item.parsedSnapshot?.meta?.designCode?.value}`)
    }
  }
  
  process.exit(0)
}

checkCustomer().catch(console.error)
