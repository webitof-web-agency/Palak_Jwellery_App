import mongoose from 'mongoose'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { CaptureSession } from '../models/CaptureSession.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.join(__dirname, '../../.env') })

async function fixCategories() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }
  
  console.log('Connecting to database...')
  await mongoose.connect(process.env.MONGODB_URI)
  
  console.log('Fetching sessions...')
  const sessions = await CaptureSession.find({})
  let modifiedCount = 0
  let itemCount = 0

  for (const session of sessions) {
    let changed = false
    
    for (const item of session.mobileItems) {
      if (!item.supplierName) continue
      const supplier = item.supplierName.toLowerCase()
      
      // If the supplier is Aayra or Utsav and the category is populated
      // we clear it so it correctly falls back to the supplier name in reports.
      if (supplier === 'aayra' || supplier === 'utsav') {
        if (item.category && item.category !== '') {
          item.category = ''
          changed = true
          itemCount++
        }
      }
    }
    
    if (changed) {
      await session.save()
      modifiedCount++
    }
  }
  
  console.log(`Updated ${modifiedCount} sessions, fixing ${itemCount} items.`)
  process.exit(0)
}

fixCategories().catch(console.error)
