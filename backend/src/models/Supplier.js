import mongoose from 'mongoose'

const supplierBusinessCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: '',
  },
  code: {
    type: String,
    trim: true,
    default: '',
  },
  colorLabel: {
    type: String,
    trim: true,
    default: '',
  },
  wastagePercent: {
    type: Number,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 100,
  },
}, { _id: false })

const supplierPurityOverrideSchema = new mongoose.Schema({
  karat: {
    type: String,
    trim: true,
    default: '',
  },
  purityPercent: {
    type: Number,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { _id: false })

const supplierOtherWeightRuleSchema = new mongoose.Schema({
  deductOtherWeight: {
    type: Boolean,
    default: false,
  },
  defaultOtherWeight: {
    type: Number,
    default: 0,
  },
}, { _id: false })

const supplierBusinessSettingsSchema = new mongoose.Schema({
  categories: {
    type: [supplierBusinessCategorySchema],
    default: [],
  },
  purityOverrides: {
    type: [supplierPurityOverrideSchema],
    default: [],
  },
  defaultWastagePercent: {
    type: Number,
    default: null,
  },
  defaultStoneRate: {
    type: Number,
    default: null,
  },
  netWeightRule: {
    type: String,
    enum: ['computed', 'qr_trusted_with_validation', 'manual'],
    default: 'computed',
  },
  stoneWeightRule: {
    type: String,
    enum: ['single', 'component_sum', 'manual'],
    default: 'single',
  },
  otherWeightRule: {
    type: supplierOtherWeightRuleSchema,
    default: () => ({
      deductOtherWeight: false,
      defaultOtherWeight: 0,
    }),
  },
  qrNetTolerance: {
    type: Number,
    default: 0.005,
  },
}, { _id: false })

const supplierQrProfileSchema = new mongoose.Schema({
  profileKey: {
    type: String,
    trim: true,
    default: '',
  },
  version: {
    type: String,
    trim: true,
    default: '',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
}, { _id: false })

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
    enum: ['cash', 'cheque', 'credit', 'bank_transfer', 'other'],
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
    patternVariants: {
      type: [{
        name: {
          type: String,
          trim: true,
          required: true,
        },
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
        priority: {
          type: Number,
          default: 100,
        },
        detectionPattern: {
          type: {
            type: String,
            enum: ['regex', 'contains', 'prefix'],
            default: 'regex',
          },
          pattern: {
            type: String,
            trim: true,
            default: '',
          },
        },
        fieldMap: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        active: {
          type: Boolean,
          default: true,
        },
      }],
      default: [],
    },
    fallback: {
      allowPartial: {
        type: Boolean,
        default: true,
      },
      minFieldsRequired: {
        type: [String],
        default: ['design_code'],
      },
      defaultStatus: {
        type: String,
        enum: ['approved', 'needs_review'],
        default: 'needs_review',
      },
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
  businessSettings: {
    type: supplierBusinessSettingsSchema,
    default: () => ({
      categories: [],
      purityOverrides: [],
      defaultWastagePercent: null,
      defaultStoneRate: null,
      netWeightRule: 'computed',
      stoneWeightRule: 'single',
      otherWeightRule: {
        deductOtherWeight: false,
        defaultOtherWeight: 0,
      },
      qrNetTolerance: 0.005,
    }),
  },
  qrProfile: {
    type: supplierQrProfileSchema,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true })

supplierSchema.index({ name: 1 })

export const Supplier = mongoose.model('Supplier', supplierSchema)
