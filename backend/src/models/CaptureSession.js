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
    referenceNote: {
      type: String,
      trim: true,
      default: '',
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
      }),
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

export const CaptureSession = mongoose.model('CaptureSession', captureSessionSchema)
