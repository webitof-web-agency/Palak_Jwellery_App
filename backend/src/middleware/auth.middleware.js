import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { User } from '../models/User.js'

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided', code: 'NO_TOKEN' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, config.jwtSecret)

    const user = await User.findById(decoded.userId).lean()
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' })
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account deactivated', code: 'ACCOUNT_INACTIVE' })
    }

    // Remove passwordHash before attaching to request
    delete user.passwordHash
    // Expose both _id (ObjectId) and id (string) for consistent access across controllers
    req.user = { ...user, id: user._id.toString() }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' })
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions', code: 'FORBIDDEN' })
  }
  next()
}
