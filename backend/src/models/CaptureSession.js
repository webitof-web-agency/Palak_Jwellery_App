import mongoose from 'mongoose'
import { ALLOWED_CAPTURE_SESSION_STATUSES } from '../services/captureSessionLifecycle.service.js'

const { Schema } = mongoose

const sessionTotalsSchema = new Schema(
  {
    supplierCount: { type: Number, default: 0, min: 0 },
    itemCount: { type: Number, default: 0, min: 0 },
    grossWeight: { type: Number, default: 0, min: 0 },
    stoneWeight: { type: Number, default: 0, min: 0 },
    otherWeight: { type: Number, default: 0, min: 0 },
    netWeight: { type: Number, default: 0, min: 0 },
    fineWeight: { type: Number, default: 0, min: 0 },
    stoneAmount: { type: Number, default: 0, min: 0 },
    otherAmount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
)

const sessionLockedSettingsSchema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    supplierName: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    karat: {
      type: String,
      trim: true,
      default: '',
    },
    purity: {
      type: Number,
      default: null,
    },
    wastage: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
)

const sessionWarningCountsSchema = new Schema(
  {
    total: { type: Number, default: 0, min: 0 },
    karatMismatch: { type: Number, default: 0, min: 0 },
    supplierMismatch: { type: Number, default: 0, min: 0 },
    netMismatch: { type: Number, default: 0, min: 0 },
    unknownQr: { type: Number, default: 0, min: 0 },
    duplicate: { type: Number, default: 0, min: 0 },
    customPurityOverride: { type: Number, default: 0, min: 0 },
    customWastageOverride: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
)

const sessionMobileItemSchema = new Schema(
  {
    clientItemId: {
      type: String,
      trim: true,
      required: true,
    },
    srNo: {
      type: Number,
      default: 0,
      min: 0,
    },
    itemCode: {
      type: String,
      trim: true,
      default: '',
    },
    supplierName: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    jewelType: {
      type: String,
      trim: true,
      default: '',
    },
    appliedKarat: {
      type: String,
      trim: true,
      default: '',
    },
    qrKarat: {
      type: String,
      trim: true,
      default: '',
    },
    purity: {
      type: Number,
      default: 0,
      min: 0,
    },
    wastage: {
      type: Number,
      default: 0,
      min: 0,
    },
    grossWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    stoneWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    netWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    fineWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    stoneAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rawQr: {
      type: String,
      trim: true,
      default: '',
    },
    parsedSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    warnings: {
      type: [String],
      default: [],
    },
    hasKaratMismatch: {
      type: Boolean,
      default: false,
    },
    hasSupplierMismatch: {
      type: Boolean,
      default: false,
    },
    hasWeightMismatch: {
      type: Boolean,
      default: false,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    hasPurityOverride: {
      type: Boolean,
      default: false,
    },
    hasWastageOverride: {
      type: Boolean,
      default: false,
    },
    requiresReview: {
      type: Boolean,
      default: false,
    },
    addedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
)

const captureSessionSchema = new Schema(
  {
    sessionRef: {
      type: String,
      required: [true, 'Session reference is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    customerArea: {
      type: String,
      trim: true,
      default: '',
    },
    customerEmail: {
      type: String,
      trim: true,
      default: '',
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    referenceNote: {
      type: String,
      trim: true,
      default: '',
    },
    clientSessionId: {
      type: String,
      trim: true,
      default: null,
    },
    assignedSalesmanId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned salesman is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ALLOWED_CAPTURE_SESSION_STATUSES,
      default: 'draft',
      index: true,
    },
    batchIds: {
      type: [{
        type: Schema.Types.ObjectId,
        ref: 'ScanBatch',
      }],
      default: [],
    },
    totals: {
      type: sessionTotalsSchema,
      default: () => ({
        supplierCount: 0,
        itemCount: 0,
        grossWeight: 0,
        stoneWeight: 0,
        otherWeight: 0,
        netWeight: 0,
        fineWeight: 0,
        stoneAmount: 0,
        otherAmount: 0,
      }),
    },
    lockedSettingsSnapshot: {
      type: sessionLockedSettingsSchema,
      default: null,
    },
    mobileWarningCounts: {
      type: sessionWarningCountsSchema,
      default: null,
    },
    mobileItems: {
      type: [sessionMobileItemSchema],
      default: [],
    },
    syncSource: {
      type: String,
      trim: true,
      default: null,
    },
    syncMeta: {
      type: Schema.Types.Mixed,
      default: null,
    },
    syncedAt: {
      type: Date,
      default: null,
    },
    warningsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    duplicateCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    manualOverrideCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
    finalizedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

captureSessionSchema.index({ assignedSalesmanId: 1, status: 1 })
captureSessionSchema.index({ status: 1, updatedAt: -1 })
captureSessionSchema.index({ createdAt: -1 })
captureSessionSchema.index(
  { clientSessionId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { clientSessionId: { $type: 'string' } },
  }
)

export const CaptureSession = mongoose.model('CaptureSession', captureSessionSchema)
