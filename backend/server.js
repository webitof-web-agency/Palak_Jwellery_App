import { connectDB } from './src/config/db.js'
import { config } from './src/config/env.js'
import app from './src/app.js'

const start = async () => {
  await connectDB()
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running on port ${config.port}`)
  })
}

start()
