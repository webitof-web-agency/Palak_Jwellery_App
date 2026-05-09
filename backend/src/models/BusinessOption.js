import mongoose from 'mongoose'

const businessOptionSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['category', 'metal_type'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 100,
    },
  },
  { timestamps: true }
)

businessOptionSchema.index({ kind: 1, name: 1 }, { unique: true })
businessOptionSchema.index({ kind: 1, code: 1 }, { unique: true, sparse: true })

export const BusinessOption = mongoose.model('BusinessOption', businessOptionSchema)
