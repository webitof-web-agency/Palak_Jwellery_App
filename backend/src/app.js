import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import suppliersRoutes from './routes/suppliers.routes.js'
import salesRoutes from './routes/sales.routes.js'
import reportsRoutes from './routes/reports.routes.js'
import userRoutes from './routes/users.routes.js'
import qrRoutes from './routes/qr.routes.js'

const app = express()

// Render and similar hosts sit behind a reverse proxy.
// Trust one hop so rate limiting can read the real client IP.
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}))

// Body parsing
app.use(express.json({ limit: '10kb' }))

// Global rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests', code: 'RATE_LIMITED' },
})
)

// Stricter rate limit on auth
app.use('/api/v1/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts', code: 'RATE_LIMITED' },
}))

// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/suppliers', suppliersRoutes)
app.use('/api/v1/sales', salesRoutes)
app.use('/api/v1/reports', reportsRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/qr', qrRoutes)

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ success: false, error: 'Internal server error', code: 'SERVER_ERROR' })
})

export default app
