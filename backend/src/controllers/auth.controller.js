import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { config } from '../config/env.js'

const signToken = (userId) =>
  jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiry })

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required', code: 'MISSING_FIELDS' })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' })
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account deactivated. Contact admin.', code: 'ACCOUNT_INACTIVE' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' })
    }

    const token = signToken(user._id)

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: user.toSafeObject(),
      },
    })
  } catch (err) {
    next(err)
  }
}

export const getMe = async (req, res) => {
  return res.status(200).json({ success: true, data: req.user })
}

export const resetPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body

    if (!userId || !newPassword) {
      return res.status(400).json({ success: false, error: 'userId and newPassword are required', code: 'MISSING_FIELDS' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' })
    }

    user.passwordHash = newPassword
    await user.save()

    return res.status(200).json({ success: true, message: 'Password updated' })
  } catch (err) {
    next(err)
  }
}
