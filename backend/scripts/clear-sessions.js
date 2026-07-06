import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { CaptureSession } from '../src/models/CaptureSession.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

const run = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected.')

    const sessionRes = await CaptureSession.deleteMany({})
    console.log(`Deleted ${sessionRes.deletedCount} sessions.`)

    console.log('Done.')
  } catch (err) {
    console.error(err)
  } finally {
    await mongoose.disconnect()
  }
}

run()
