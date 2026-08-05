import mongoose from 'mongoose'

const bullionInventorySchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: 'bullion_inventory',
      unique: true,
      immutable: true,
      index: true,
      select: false,
    },
    currentStockGrams: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentMarketRatePerGram: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdatedAt: {
      type: Date,
      default: null,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)



bullionInventorySchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.__v
  delete obj.singletonKey
  return obj
}

export const BullionInventory = mongoose.model('BullionInventory', bullionInventorySchema)

