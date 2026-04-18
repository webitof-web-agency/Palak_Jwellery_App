import { User } from '../models/User.js'

/**
 * List all users with basic filtering
 */
export const listUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-passwordHash')
            .sort({ createdAt: -1 })
            .lean()

        res.status(200).json({
            success: true,
            data: users
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
        const { name, email, password, role, permissions } = req.body

        // Check if user exists
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Email already registered' })
        }

        const user = new User({
            name,
            email,
            passwordHash: password, // Schema pre-save handles hashing
            role: role || 'salesman',
            permissions,
            createdBy: req.user._id
        })

        await user.save()

        res.status(201).json({
            success: true,
            data: user.toSafeObject()
        })
    } catch (err) {
        res.status(400).json({ 
            success: false, 
            error: err.message || 'Failed to create user' 
        })
    }
}

/**
 * Update user details
 */
export const updateUser = async (req, res) => {
    try {
        const { name, role, permissions } = req.body
        
        const user = await User.findById(req.params.id)
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' })
        }

        if (name) user.name = name
        if (role) user.role = role
        if (permissions) user.permissions = { ...user.permissions, ...permissions }

        await user.save()

        res.status(200).json({
            success: true,
            data: user.toSafeObject()
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
            data: user.toSafeObject()
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
            message: 'User deactivated successfully'
        })
    } catch (err) {
        res.status(400).json({ success: false, error: 'Deletion failed' })
    }
}
