import { connectDB } from '../config/db.js'
import { Supplier } from '../models/Supplier.js'

const defaultSuppliers = [
  {
    name: 'Yug',
    code: 'YUG',
    gst: '',
    address: '',
    paymentMode: 'credit',
    categories: [],
    isActive: true,
    detectionPattern: {
      type: 'regex',
      pattern: 'SWMS|SWNK',
    },
    qrMapping: {
      strategy: 'delimiter',
      delimiter: '/',
      fieldMap: {
        grossWeight: 3,
        stoneWeight: { sumIndices: [4, 14] },
        netWeight: 5,
        category: 7,
      },
    },
  },
  {
    name: 'Aadinath',
    code: 'ADINATH',
    gst: '',
    address: '',
    paymentMode: 'credit',
    categories: [],
    isActive: true,
    detectionPattern: {
      type: 'regex',
      pattern: '(BG|LR)-\\d+',
    },
    qrMapping: {
      strategy: 'delimiter',
      delimiter: '/',
      fieldMap: {
        grossWeight: 0,
        stoneWeight: { sumIndices: [1, 2] },
        netWeight: 6,
        category: 7,
      },
    },
  },
  {
    name: 'Utsav',
    code: 'UTSAV',
    gst: '',
    address: '',
    paymentMode: 'credit',
    categories: [],
    isActive: true,
    detectionPattern: {
      type: 'contains',
      pattern: 'USV',
    },
    qrMapping: {
      strategy: 'delimiter',
      delimiter: '/',
      fieldMap: {
        supplierCode: 8,
        category: 0,
        grossWeight: { index: 1, stripPrefix: 'GWT-' },
        stoneWeight: { index: 3, stripPrefix: 'SWT-' },
        netWeight: { index: 2, stripPrefix: 'NWT-' },
      },
    },
  },
  {
    name: 'Venzora',
    code: 'VENZORA',
    gst: '',
    address: '',
    paymentMode: 'credit',
    categories: [],
    isActive: true,
    detectionPattern: {
      type: 'contains',
      pattern: '18KT',
    },
    qrMapping: {
      strategy: 'venzora',
      delimiter: '/',
      fieldMap: {
        category: 0,
        grossWeight: 2,
        stoneWeight: 3,
        netWeight: 4,
      },
    },
  },
  {
    name: 'ZAR',
    code: 'ZAR',
    gst: '',
    address: '',
    paymentMode: 'credit',
    categories: [],
    isActive: true,
    detectionPattern: {
      type: 'regex',
      pattern: '^JFC\\d+',
    },
    qrMapping: {
      strategy: 'delimiter',
      delimiter: '/',
      fieldMap: {
        supplierCode: 0,
      },
    },
  },
]

const run = async () => {
  await connectDB()

  let created = 0
  let updated = 0

  for (const supplier of defaultSuppliers) {
    const existing = await Supplier.findOne({ code: supplier.code })

    if (!existing) {
      await Supplier.create(supplier)
      created += 1
      console.log(`Created supplier: ${supplier.name} (${supplier.code})`)
      continue
    }

    existing.name = supplier.name
    existing.gst = supplier.gst
    existing.address = supplier.address
    existing.paymentMode = supplier.paymentMode
    existing.categories = supplier.categories
    existing.isActive = supplier.isActive
    existing.detectionPattern = supplier.detectionPattern
    existing.qrMapping = supplier.qrMapping

    await existing.save()
    updated += 1
    console.log(`Updated supplier: ${supplier.name} (${supplier.code})`)
  }

  console.log(`Supplier seed complete. Created: ${created}, Updated: ${updated}`)
  process.exit(0)
}

run().catch((error) => {
  console.error('Supplier seed failed:', error)
  process.exit(1)
})
