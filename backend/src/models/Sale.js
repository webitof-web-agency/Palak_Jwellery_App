import mongoose from 'mongoose'
import crypto from 'crypto'
import { ALLOWED_SALE_ENTRY_MODES } from '../services/batchLifecycle.service.js'

const { Schema } = mongoose

const settlementInputsSchema = new Schema(
  {
    karat: {
      type: String,
      trim: true,
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: null,
    },
    purityPercent: {
      type: Number,
      default: null,
    },
    originalPurityPercent: {
      type: Number,
      default: null,
    },
    puritySource: {
      type: String,
      trim: true,
      default: null,
    },
    purityOverridden: {
      type: Boolean,
      default: false,
    },
    wastagePercent: {
      type: Number,
      default: null,
    },
    originalWastagePercent: {
      type: Number,
      default: null,
    },
    wastageSource: {
      type: String,
      trim: true,
      default: null,
    },
    wastageOverridden: {
      type: Boolean,
      default: false,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    supplierCode: {
      type: String,
      trim: true,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
)

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
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'ScanBatch',
      default: null,
      index: true,
    },
    revisionAdded: {
      type: Number,
      default: null,
      min: 1,
    },
    entryMode: {
      type: String,
      default: null,
      validate: {
        validator: (value) => value === null || value === undefined || ALLOWED_SALE_ENTRY_MODES.includes(value),
        message: 'Invalid sale entry mode',
      },
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    addedAt: {
      type: Date,
      default: null,
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
    calculationSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    parsedSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    settlementInputs: {
      type: settlementInputsSchema,
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
saleSchema.index({ batchId: 1, saleDate: -1 })


// Hash a QR string using SHA-256
export const hashQR = (raw) => {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null
  return crypto.createHash('sha256').update(raw.trim()).digest('hex')
}

export const Sale = mongoose.model('Sale', saleSchema)
