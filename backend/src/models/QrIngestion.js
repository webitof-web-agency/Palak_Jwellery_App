import mongoose from 'mongoose'

const { Schema } = mongoose

const customFieldSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
)

const parsedSchema = new Schema(
  {
    supplier: {
      type: String,
      default: '',
      trim: true,
    },
    itemCode: {
      type: String,
      default: null,
      trim: true,
    },
    purity: {
      type: String,
      default: null,
      trim: true,
    },
    grossWeight: {
      type: Number,
      default: null,
    },
    netWeight: {
      type: Number,
      default: null,
    },
    diamondWeight: {
      type: Number,
      default: null,
    },
    designCode: {
      type: String,
      default: null,
      trim: true,
    },
    parseErrors: {
      type: [String],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
    },
    confidence: {
      type: String,
      enum: ['high', 'low'],
      default: 'high',
    },
  },
  { _id: false }
)

const fallbackSchema = new Schema(
  {
    delimiter: {
      type: String,
      default: null,
      trim: true,
    },
    prefixPatterns: {
      type: [String],
      default: [],
    },
    sampleTokens: {
      type: [String],
      default: [],
    },
    confidence: {
      type: String,
      enum: ['high', 'low'],
      default: 'low',
    },
  },
  { _id: false }
)

const finalSchema = new Schema(
  {
    itemCode: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: null,
      trim: true,
    },
    productId: {
      type: String,
      default: null,
      trim: true,
    },
    purity: {
      type: String,
      default: null,
      trim: true,
    },
    grossWeight: {
      type: Number,
      default: null,
    },
    netWeight: {
      type: Number,
      default: null,
    },
    diamondWeight: {
      type: Number,
      default: null,
    },
    designCode: {
      type: String,
      default: null,
      trim: true,
    },
    customFields: {
      type: [customFieldSchema],
      default: [],
    },
  },
  { _id: false }
)

const qrIngestionSchema = new Schema(
  {
    raw: {
      type: String,
      required: true,
      immutable: true,
    },
    parsed: {
      type: parsedSchema,
      required: true,
      default: () => ({}),
    },
    fallback: {
      type: fallbackSchema,
      default: () => ({}),
    },
    warnings: {
      type: [String],
      default: [],
    },
    final: {
      type: finalSchema,
      required: true,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['parsed', 'needs_review', 'approved'],
      default: 'parsed',
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    learning: {
      delimiter: {
        type: String,
        default: null,
        trim: true,
      },
      prefixPatterns: {
        type: [String],
        default: [],
      },
      sampleTokens: {
        type: [String],
        default: [],
      },
      confidence: {
        type: String,
        enum: ['high', 'low'],
        default: 'low',
      },
    },
  },
  { timestamps: true }
)

qrIngestionSchema.index({ status: 1, updatedAt: -1 })

export const QrIngestion = mongoose.model('QrIngestion', qrIngestionSchema)
