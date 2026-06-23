import mongoose from 'mongoose'

const { Schema } = mongoose

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const customerSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Customer phone is required'],
      trim: true,
      index: true,
      validate: {
        validator: (value) => /^\d{10}$/.test(String(value || '')),
        message: 'Phone must be exactly 10 digits',
      },
    },
    area: {
      type: String,
      required: [true, 'Customer area is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      validate: {
        validator: (value) => value === null || value === undefined || value === '' || emailRegex.test(String(value)),
        message: 'Invalid email address',
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    archiveReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

customerSchema.index({ name: 'text', phone: 'text', area: 'text', email: 'text' })
customerSchema.index({ isArchived: 1, createdAt: -1 })
customerSchema.index({ phone: 1, isArchived: 1 })

customerSchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.__v
  return obj
}

export const Customer = mongoose.model('Customer', customerSchema)
