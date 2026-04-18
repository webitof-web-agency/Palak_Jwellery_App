import mongoose from 'mongoose'

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  code: {
    type: String,
    required: [true, 'Code is required'],
    unique: true,
    trim: true,
  },
  gst: {
    type: String,
    trim: true,
    default: '',
  },
  address: {
    type: String,
    trim: true,
    default: '',
  },
  paymentMode: {
    type: String,
    enum: ['cash', 'cheque', 'bank_transfer', 'other'],
    default: 'other',
  },
  qrMapping: {
    strategy: {
      type: String,
      enum: ['delimiter', 'key_value', 'venzora'],
      default: 'delimiter',
    },
    delimiter: {
      type: String,
      trim: true,
      default: '|',
    },
    // Each field can be:
    //   integer            → simple index e.g. 3
    //   { index: N }       → same as integer
    //   { index: N, stripPrefix: 'GWT-' } → strip label before parsing (Utsav)
    //   { sumIndices: [N, M] }             → sum two positions (Aadinath S+B, YUG SS+MS)
    fieldMap: {
      supplierCode: { type: mongoose.Schema.Types.Mixed, default: 0 },
      category: { type: mongoose.Schema.Types.Mixed, default: 1 },
      grossWeight: { type: mongoose.Schema.Types.Mixed, default: 2 },
      stoneWeight: { type: mongoose.Schema.Types.Mixed, default: 3 },
      netWeight: { type: mongoose.Schema.Types.Mixed, default: 4 },
    },
  },
  learnedPatterns: {
    type: [{
      source: {
        type: String,
        default: 'qr_ingestion',
        trim: true,
      },
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
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    default: [],
  },
  detectionPattern: {
    type: {
      type: String,
      enum: ['regex', 'contains', 'prefix'],
      default: null,
    },
    pattern: {
      type: String,
      trim: true,
      default: '',
    },
  },
  categories: {
    type: [String],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true })

supplierSchema.index({ name: 1 })

export const Supplier = mongoose.model('Supplier', supplierSchema)
