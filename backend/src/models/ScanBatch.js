import mongoose from 'mongoose'
import { ALLOWED_BATCH_ENTRY_MODES, ALLOWED_BATCH_STATUSES } from '../services/batchLifecycle.service.js'

const { Schema } = mongoose

const batchTotalsSchema = new Schema(
  {
    grossWeight: { type: Number, default: 0, min: 0 },
    stoneWeight: { type: Number, default: 0, min: 0 },
    otherWeight: { type: Number, default: 0, min: 0 },
    netWeight: { type: Number, default: 0, min: 0 },
    fineWeight: { type: Number, default: 0, min: 0 },
    stoneAmount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
)

const batchExportSchema = new Schema(
  {
    type: {
      type: String,
      trim: true,
      default: '',
    },
    generatedAt: {
      type: Date,
      default: null,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
)

const batchRevisionSchema = new Schema(
  {
    revision: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: ALLOWED_BATCH_STATUSES,
    },
    saleIds: {
      type: [{
        type: Schema.Types.ObjectId,
        ref: 'Sale',
      }],
      default: [],
    },
    totals: {
      type: batchTotalsSchema,
      default: () => ({
        grossWeight: 0,
        stoneWeight: 0,
        otherWeight: 0,
        netWeight: 0,
        fineWeight: 0,
        stoneAmount: 0,
      }),
    },
    itemCount: {
      type: Number,
      default: 0,
      min: 0,
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
    finalizedAt: {
      type: Date,
      default: null,
    },
    finalizedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenReason: {
      type: String,
      trim: true,
      default: null,
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    reopenedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    exports: {
      type: [batchExportSchema],
      default: [],
    },
  },
  { _id: false }
)

const scanBatchSchema = new Schema(
  {
    batchRef: {
      type: String,
      required: [true, 'Batch reference is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required'],
      index: true,
    },
    supplierCode: {
      type: String,
      trim: true,
      default: null,
    },
    salesmanId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedSalesmanId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned salesman is required'],
      index: true,
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
    status: {
      type: String,
      enum: ALLOWED_BATCH_STATUSES,
      // Draft is the safest default: the batch exists before it is activated for work.
      default: 'draft',
      index: true,
    },
    revision: {
      type: Number,
      default: 1,
      min: 1,
    },
    entryMode: {
      type: String,
      default: null,
      validate: {
        validator: (value) => value === null || value === undefined || ALLOWED_BATCH_ENTRY_MODES.includes(value),
        message: 'Invalid batch entry mode',
      },
    },
    itemCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totals: {
      type: batchTotalsSchema,
      default: () => ({
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
    reopenedAt: {
      type: Date,
      default: null,
    },
    reopenedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenReason: {
      type: String,
      trim: true,
      default: null,
    },
    revisions: {
      type: [batchRevisionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

scanBatchSchema.index({ supplierId: 1, status: 1 })
scanBatchSchema.index({ assignedSalesmanId: 1, status: 1 })
scanBatchSchema.index({ createdAt: -1 })
scanBatchSchema.index({ status: 1, updatedAt: -1 })

export const ScanBatch = mongoose.model('ScanBatch', scanBatchSchema)
