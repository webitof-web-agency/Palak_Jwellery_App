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
    supplier: {
      type: String,
      default: '',
      trim: true,
    },
    design_code: {
      type: String,
      default: null,
      trim: true,
    },
    gross_weight: {
      type: Number,
      default: null,
    },
    stone_weight: {
      type: Number,
      default: null,
    },
    other_weight: {
      type: Number,
      default: null,
    },
    net_weight: {
      type: Number,
      default: null,
    },
    purity_percent: {
      type: Number,
      default: null,
    },
    wastage_percent: {
      type: Number,
      default: null,
    },
    fine_weight: {
      type: Number,
      default: null,
    },
    stone_amount: {
      type: Number,
      default: null,
    },
    other_amount: {
      type: Number,
      default: null,
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['pending', 'needs_review', 'approved'],
      default: 'pending',
    },
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

const validationSchema = new Schema(
  {
    input: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['pending', 'needs_review', 'approved'],
      default: 'pending',
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    warnings: {
      type: [String],
      default: [],
    },
    evaluatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
)

const correctionsSchema = new Schema(
  {
    gross_weight: {
      type: Number,
    },
    stone_weight: {
      type: Number,
    },
    other_weight: {
      type: Number,
    },
    net_weight: {
      type: Number,
    },
    purity_percent: {
      type: Number,
    },
    wastage_percent: {
      type: Number,
    },
    fine_weight: {
      type: Number,
    },
    stone_amount: {
      type: Number,
    },
    other_amount: {
      type: Number,
    },
    correctedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    correctedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
)

const valuationTotalsSchema = new Schema(
  {
    gross_weight: {
      type: Number,
      default: 0,
    },
    stone_weight: {
      type: Number,
      default: 0,
    },
    other_weight: {
      type: Number,
      default: 0,
    },
    net_weight: {
      type: Number,
      default: 0,
    },
    fine_weight: {
      type: Number,
      default: 0,
    },
    stone_amount: {
      type: Number,
      default: 0,
    },
    other_amount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
)

const valuationSchema = new Schema(
  {
    fine_weight: {
      type: Number,
      default: null,
    },
    fine_weight_source: {
      type: String,
      enum: ['supplier', 'derived', 'missing'],
      default: 'missing',
    },
    stone_amount: {
      type: Number,
      default: 0,
    },
    stone_amount_source: {
      type: String,
      enum: ['supplier', 'fallback_rate', 'missing'],
      default: 'missing',
    },
    valuation_status: {
      type: String,
      enum: ['complete', 'partial', 'supplier_only'],
      default: 'partial',
    },
    warnings: {
      type: [String],
      default: [],
    },
    totals: {
      type: valuationTotalsSchema,
      default: () => ({}),
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
    raw_qr: {
      type: String,
      default: null,
      trim: true,
    },
    parsed: {
      type: parsedSchema,
      required: true,
      default: () => ({}),
    },
    validation: {
      type: validationSchema,
      default: () => ({}),
    },
    fallback: {
      type: fallbackSchema,
      default: () => ({}),
    },
    corrections: {
      type: correctionsSchema,
      default: () => ({}),
    },
    correction_note: {
      type: String,
      default: null,
      trim: true,
    },
    warnings: {
      type: [String],
      default: [],
    },
    validationWarnings: {
      type: [String],
      default: [],
    },
    final: {
      type: finalSchema,
      required: true,
      default: () => ({}),
    },
    valuation: {
      type: valuationSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['parsed', 'needs_review', 'approved'],
      default: 'parsed',
      index: true,
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
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
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    correctedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    correctedAt: {
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
