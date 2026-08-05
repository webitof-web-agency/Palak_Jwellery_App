import mongoose from 'mongoose'

const bullionPurchaseOrderSchema = new mongoose.Schema(
  {
    suggestedGrams: {
      type: Number,
      default: 0,
      min: 0,
    },
    requestedGrams: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'done'],
      default: 'pending',
      index: true,
    },
    purchasedGrams: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchasePricePerGram: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPurchaseCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    markedDoneAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

bullionPurchaseOrderSchema.index({ status: 1, createdAt: -1 })
bullionPurchaseOrderSchema.index({ createdAt: -1 })

bullionPurchaseOrderSchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.__v
  return obj
}

export const BullionPurchaseOrder = mongoose.model('BullionPurchaseOrder', bullionPurchaseOrderSchema)

