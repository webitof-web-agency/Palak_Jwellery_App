import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { config } from '../config/env.js'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'salesman'],
    default: 'salesman',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  permissions: {
    canEditSale: { type: Boolean, default: false },
    canCorrectQRFields: { type: Boolean, default: true },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true })

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return

  this.passwordHash = await bcrypt.hash(this.passwordHash, config.bcryptRounds)
})

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash)
}

// Never return passwordHash in responses
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.passwordHash
  return obj
}

export const User = mongoose.model('User', userSchema)
