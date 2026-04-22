import mongoose from 'mongoose'
import crypto from 'crypto'

const { Schema } = mongoose

const saleSchema = new Schema(
  {
    qrRaw: {
      type: String,
      default: null,
    },
    qrHash: {
      type: String,
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: true,
      unique: true,
      sparse: true,
    },
    salesman: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    itemCode: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    metalType: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    purity: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    notes: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    grossWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    stoneWeight: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    netWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    ratePerGram: {
      type: Number,
      required: true,
      min: 0,
    },
    totalValue: {
      type: Number,
      required: true,
      min: 0,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    wasManuallyEdited: {
      type: Boolean,
      default: false,
    },
    saleDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

saleSchema.index({ salesman: 1, saleDate: -1 })
saleSchema.index({ supplier: 1, saleDate: -1 })
saleSchema.index({ category: 1 })


// Hash a QR string using SHA-256
export const hashQR = (raw) => {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null
  return crypto.createHash('sha256').update(raw.trim()).digest('hex')
}

export const Sale = mongoose.model('Sale', saleSchema)
