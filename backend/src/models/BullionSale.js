import mongoose from 'mongoose'

const { Schema } = mongoose

const bullionSaleSchema = new Schema(
  {
    clientEntryId: {
      type: String,
      trim: true,
      default: null,
      index: true,
      unique: true,
      sparse: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      default: null,
      trim: true,
      index: true,
      validate: {
        validator: (value) => value === null || value === undefined || value === '' || /^\d{10}$/.test(String(value || '')),
        message: 'Customer phone must be exactly 10 digits',
      },
    },
    customerArea: {
      type: String,
      default: null,
      trim: true,
    },
    customerEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    salesmanId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Salesman is required'],
      index: true,
    },
    salesmanName: {
      type: String,
      trim: true,
      default: null,
    },
    weightGrams: {
      type: Number,
      required: [true, 'Weight is required'],
      min: 0,
    },
    inputUnit: {
      type: String,
      enum: ['per_gram', 'per_kg'],
      default: 'per_gram',
    },
    ratePerGram: {
      type: Number,
      required: [true, 'Rate per gram is required'],
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: 0,
    },
    goldPurity: {
      type: String,
      trim: true,
      default: null,
    },
    transactionType: {
      type: String,
      enum: ['sale', 'return'],
      default: 'sale',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    syncStatus: {
      type: String,
      enum: ['pending', 'synced', 'failed'],
      default: 'synced',
      index: true,
    },
    syncedAt: {
      type: Date,
      default: null,
    },
    syncError: {
      type: String,
      trim: true,
      default: null,
    },
    syncMeta: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

bullionSaleSchema.index({ createdAt: -1 })
bullionSaleSchema.index({ salesmanId: 1, createdAt: -1 })
bullionSaleSchema.index({ customerId: 1, createdAt: -1 })
bullionSaleSchema.index({ transactionType: 1, createdAt: -1 })
bullionSaleSchema.index({ syncStatus: 1, createdAt: -1 })

bullionSaleSchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.__v
  return obj
}

export const BullionSale = mongoose.model('BullionSale', bullionSaleSchema)

