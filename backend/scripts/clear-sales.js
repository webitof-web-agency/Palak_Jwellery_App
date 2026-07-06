import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { Sale } from '../src/models/Sale.js'
import { ScanBatch } from '../src/models/ScanBatch.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

const run = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected.')

    const saleRes = await Sale.deleteMany({})
    console.log(`Deleted ${saleRes.deletedCount} Sale records.`)

    const batchRes = await ScanBatch.deleteMany({})
    console.log(`Deleted ${batchRes.deletedCount} ScanBatch records.`)

    console.log('Done. Dashboard should now show zeros.')
  } catch (err) {
    console.error(err)
  } finally {
    await mongoose.disconnect()
  }
}

run()
