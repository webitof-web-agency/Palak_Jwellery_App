import dotenv from 'dotenv'
dotenv.config()

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/jwellery',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: process.env.JWT_EXPIRY || '8h',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  qrWarningsRequireReview: String(process.env.QR_WARNINGS_REQUIRE_REVIEW || 'false').toLowerCase() === 'true',
}

if (!config.jwtSecret) {
  console.error('FATAL: JWT_SECRET is not set in environment')
  process.exit(1)
}
