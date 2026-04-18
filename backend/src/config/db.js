import mongoose from 'mongoose'
import { config } from './env.js'

export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri)
    console.log('MongoDB connected')
  } catch (err) {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  }
}
