import mongoose from 'mongoose'
import { config } from './env.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const connectDB = async () => {
  const isProduction = config.nodeEnv === 'production'
  const maxAttempts = isProduction ? 5 : 1
  const delays = [2000, 4000, 8000, 16000, 30000]

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(config.mongoUri)
      console.log('MongoDB connected')
      return
    } catch (err) {
      const message = err?.message || 'Unknown connection error'
      if (attempt >= maxAttempts) {
        console.error('MongoDB connection failed after retries:', message)
        process.exit(1)
      }

      const delay = delays[Math.min(attempt - 1, delays.length - 1)]
      console.warn(
        `MongoDB connection failed (attempt ${attempt}/${maxAttempts}): ${message}. Retrying in ${delay}ms...`,
      )
      await sleep(delay)
    }
  }
}
