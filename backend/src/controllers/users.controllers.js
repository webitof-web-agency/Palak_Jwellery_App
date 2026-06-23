import { User } from '../models/User.js'

const ROLE_MAP = {
  admin: 'admin',
  admins: 'admin',
  salesman: 'salesman',
  salesmen: 'salesman',
}

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

const buildUserSearchQuery = (req) => {
  const q = String(req.query.q || '').trim()
  const roleKey = String(req.query.role || '').trim().toLowerCase()
  const normalizedRole = ROLE_MAP[roleKey] || ''

  const query = {}

  if (q) {
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ]
  }

  if (normalizedRole) {
    query.role = normalizedRole
  }

  return query
}

/**
 * List all users with search, role filtering, and optional pagination.
 */
export const listUsers = async (req, res) => {
  try {
    const query = buildUserSearchQuery(req)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const usePagination = req.query.page !== undefined || req.query.limit !== undefined

    const baseQuery = User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean()

    if (!usePagination) {
      const users = await baseQuery
      return res.status(200).json({
        success: true,
        data: users,
      })
    }

    const skip = (page - 1) * limit
    const [users, total] = await Promise.all([
      baseQuery.skip(skip).limit(limit),
      User.countDocuments(query),
    ])

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' })
  }
}

/**
 * Create a new user (admin or salesman)
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, permissions } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedPhone = String(phone || '').trim()

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [
        normalizedEmail ? { email: normalizedEmail } : null,
        normalizedPhone ? { phone: normalizedPhone } : null,
      ].filter(Boolean),
    })
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email or phone already registered' })
    }

    const user = new User({
      name,
      email: normalizedEmail,
      phone: normalizedPhone || null,
      passwordHash: password, // Schema pre-save handles hashing
      role: role || 'salesman',
      permissions,
      createdBy: req.user._id,
    })

    await user.save()

    res.status(201).json({
      success: true,
      data: user.toSafeObject(),
    })
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to create user',
    })
  }
}

/**
 * Update user details
 */
export const updateUser = async (req, res) => {
  try {
    const { name, email, phone, role, permissions } = req.body
    const normalizedEmail = email ? String(email).trim().toLowerCase() : null
    const normalizedPhone = phone !== undefined ? String(phone).trim() : undefined

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    if (name) user.name = name
    if (normalizedEmail) user.email = normalizedEmail
    if (normalizedPhone !== undefined) user.phone = normalizedPhone || null
    if (role) user.role = role
    if (permissions) user.permissions = { ...user.permissions, ...permissions }

    await user.save()

    res.status(200).json({
      success: true,
      data: user.toSafeObject(),
    })
  } catch (err) {
    res.status(400).json({ success: false, error: 'Update failed' })
  }
}

/**
 * Toggle active status
 */
export const toggleStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Prevent self-deactivation
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' })
    }

    user.isActive = !user.isActive
    await user.save()

    res.status(200).json({
      success: true,
      data: user.toSafeObject(),
    })
  } catch (err) {
    res.status(400).json({ success: false, error: 'Status toggle failed' })
  }
}

/**
 * Delete user
 */
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' })
    }

    // Soft delete — never hard-delete users (historical sales reference them)
    user.isActive = false
    await user.save()

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
    })
  } catch (err) {
    res.status(400).json({ success: false, error: 'Deletion failed' })
  }
}
