import { connectDB } from '../config/db.js'
import { Supplier } from '../models/Supplier.js'
import { detectSupplier, normalizeParsedQR, parseQR } from '../services/qrParser.service.js'

const tests = [
  {
    name: 'Yug - valid',
    qr: `SWMS - 691HG
GW : 3.750
SS : 0.000
MS : 0.197
OW : 0.000
NW : 3.553
KT - 18K`,
    expected: {
      supplier: 'Yug',
      itemCode: 'SWMS - 691HG',
      grossWeight: 3.75,
      stoneWeight: 0.197,
      netWeight: 3.553,
      category: null,
    },
  },
  {
    name: 'Yug - delimiter sample',
    qr: '2075778/86711/18K/3.75/0/3.553/322/SWMS - 691HG/WC/Y+W/2J0Y0/0/0/WHITE/0.197/0/0/0/0/0/0',
    expected: {
      supplier: 'Yug',
      itemCode: 'SWMS - 691HG',
      grossWeight: 3.75,
      stoneWeight: 0.197,
      netWeight: 3.553,
      category: null,
    },
  },
  {
    name: 'Adinath - valid',
    qr: `4.01/0.36/////3.65/TM-155`,
    expected: {
      supplier: 'Adinath',
      itemCode: 'TM-155',
      grossWeight: 4.01,
      stoneWeight: 0.36,
      netWeight: 3.65,
      category: null,
    },
  },
  {
    name: 'Utsav - valid',
    qr: `TM-868/GWT-6.600/NWT-5.120/SWT-0.840//USV`,
    expected: {
      supplier: 'Utsav',
      itemCode: 'TM-868',
      grossWeight: 6.6,
      stoneWeight: 0.84,
      netWeight: 5.12,
      category: null,
    },
  },
  {
    name: 'Garbage input',
    qr: `HELLO RANDOM TEXT`,
    expected: {
      shouldFail: true,
    },
  },
  {
    name: 'Venzora - valid 1',
    qr: `307285/18KT/G16.970/L0.316/N16.654/Rs.379/CH-435A`,
    expected: {
      supplier: 'Venzora',
      itemCode: '307285',
      purity: '18KT',
      grossWeight: 16.97,
      diamondWeight: 0.316,
      netWeight: 16.654,
      designCode: 'CH-435A',
      category: null,
    },
  },
  {
    name: 'Venzora - valid 2',
    qr: `5046cb/18KT/G19.630/L0.0/N19.630/Rs0.0/CH-465A`,
    expected: {
      supplier: 'Venzora',
      itemCode: '5046CB',
      purity: '18KT',
      grossWeight: 19.63,
      diamondWeight: 0,
      netWeight: 19.63,
      designCode: 'CH-465A',
      category: null,
    },
  },
  {
    name: 'Venzora - invalid G token',
    qr: `307285/18KT/G16..970/L0.316/N16.654/Rs.379/CH-435A`,
    expected: {
      supplier: 'Venzora',
      itemCode: '307285',
      grossWeight: null,
      stoneWeight: 0.316,
      netWeight: 16.654,
      category: null,
      errorsInclude: ['Invalid G token'],
    },
  },
  {
    name: 'Venzora - invalid L token',
    qr: `307285/18KT/G16.970/LXYZ/N16.654/Rs.379/CH-435A`,
    expected: {
      supplier: 'Venzora',
      itemCode: '307285',
      grossWeight: 16.97,
      stoneWeight: null,
      netWeight: 16.654,
      category: null,
      errorsInclude: ['Invalid L token'],
    },
  },
  {
    name: 'Venzora - missing CH',
    qr: `307285/18KT/G16.970/L0.316/N16.654/Rs.379`,
    expected: {
      supplier: 'Venzora',
      itemCode: '307285',
      grossWeight: 16.97,
      stoneWeight: 0.316,
      netWeight: 16.654,
      category: null,
      errorsInclude: ['CH is missing'],
    },
  },
  {
    name: 'Venzora - extra tokens',
    qr: `307285/18KT/G16.970/EXTRA/L0.316/N16.654/RANDOM/Rs.379/CH-435A`,
    expected: {
      supplier: 'Venzora',
      itemCode: '307285',
      grossWeight: 16.97,
      stoneWeight: 0.316,
      netWeight: 16.654,
      category: null,
    },
  },
]

const collectErrorTexts = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => {
    if (typeof item === 'string') {
      return item
    }

    if (!item || typeof item !== 'object') {
      return String(item)
    }

    return `${item.field || 'unknown'}: ${item.reason || 'Unknown error'}`
  })
}

const hasNaNValue = (value, seen = new Set()) => {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'number') {
    return Number.isNaN(value)
  }

  if (typeof value !== 'object') {
    return false
  }

  if (seen.has(value)) {
    return false
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value.some((item) => hasNaNValue(item, seen))
  }

  return Object.values(value).some((item) => hasNaNValue(item, seen))
}

const validateNormalized = (result, expected) => {
  const errors = []

  if (!result?.meta) {
    errors.push('meta is missing')
  }

  if (!result?.meta?.originalFields) {
    errors.push('meta.originalFields is missing')
  }

  if (!result?.raw) {
    errors.push('raw is empty')
  }

  if (hasNaNValue(result)) {
    errors.push('normalized result contains NaN')
  }

  const combinedErrors = [
    ...collectErrorTexts(result?.errors),
    ...collectErrorTexts(result?.meta?.parseErrors),
  ].join(' | ')

  if (expected.shouldFail) {
    if (!combinedErrors) {
      errors.push('Expected failure but got success')
    }

    if (Array.isArray(expected.errorsInclude)) {
      expected.errorsInclude.forEach((fragment) => {
        if (!combinedErrors.includes(fragment)) {
          errors.push(`expected error fragment not found: ${fragment}`)
        }
      })
    }

    return errors
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'supplier') && result?.supplier !== expected.supplier) {
    errors.push(`supplier mismatch: expected ${expected.supplier}, got ${result?.supplier}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'itemCode') && result?.itemCode !== expected.itemCode) {
    errors.push(`itemCode mismatch: expected ${expected.itemCode}, got ${result?.itemCode}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'purity') && result?.purity !== expected.purity) {
    errors.push(`purity mismatch: expected ${expected.purity}, got ${result?.purity}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'grossWeight') && result?.grossWeight !== expected.grossWeight) {
    errors.push(`grossWeight mismatch: expected ${expected.grossWeight}, got ${result?.grossWeight}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'stoneWeight') && result?.stoneWeight !== expected.stoneWeight) {
    errors.push(`stoneWeight mismatch: expected ${expected.stoneWeight}, got ${result?.stoneWeight}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'netWeight') && result?.netWeight !== expected.netWeight) {
    errors.push(`netWeight mismatch: expected ${expected.netWeight}, got ${result?.netWeight}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'diamondWeight') && result?.diamondWeight !== expected.diamondWeight) {
    errors.push(`diamondWeight mismatch: expected ${expected.diamondWeight}, got ${result?.diamondWeight}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'designCode') && result?.designCode !== expected.designCode) {
    errors.push(`designCode mismatch: expected ${expected.designCode}, got ${result?.designCode}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, 'category') && result?.category !== expected.category) {
    errors.push(`category mismatch: expected ${expected.category}, got ${result?.category}`)
  }

  if (Array.isArray(expected.errorsInclude)) {
    expected.errorsInclude.forEach((fragment) => {
      if (!combinedErrors.includes(fragment)) {
        errors.push(`expected error fragment not found: ${fragment}`)
      }
    })
  } else if (combinedErrors) {
    errors.push(`unexpected validation errors: ${combinedErrors}`)
  }

  return errors
}

const main = async () => {
  await connectDB()

  const suppliers = await Supplier.find().lean()
  const hasVenzora = suppliers.some((supplier) => supplier?.name?.toLowerCase() === 'venzora')
  const hasYug = suppliers.some((supplier) => supplier?.name?.toLowerCase() === 'yug')
  const hasAdinath = suppliers.some((supplier) => supplier?.name?.toLowerCase() === 'adinath')
  const hasUtsav = suppliers.some((supplier) => supplier?.name?.toLowerCase() === 'utsav')
  const testSuppliers = [
    ...(!hasVenzora
      ? [{
          _id: 'virtual-venzora',
          name: 'Venzora',
          code: 'VENZORA',
          qrMapping: {
            strategy: 'venzora',
          },
        }]
      : []),
    ...(!hasYug
      ? [{
          _id: 'virtual-yug',
          name: 'Yug',
          code: 'YUG',
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
          detectionPattern: {
            type: 'regex',
            pattern: 'SWMS|SWNK',
          },
        }]
      : []),
    ...(!hasAdinath
      ? [{
          _id: 'virtual-adinath',
          name: 'Adinath',
          code: 'Adinath',
          qrMapping: {
            strategy: 'delimiter',
            delimiter: '/',
            fieldMap: {
              grossWeight: 0,
              stoneWeight: 1,
              netWeight: 6,
              category: 7,
            },
          },
        }]
      : []),
    ...(!hasUtsav
      ? [{
          _id: 'virtual-utsav',
          name: 'Utsav',
          code: 'USV',
          qrMapping: {
            strategy: 'delimiter',
            delimiter: '/',
            fieldMap: {
              grossWeight: { index: 1, stripPrefix: 'GWT-' },
              stoneWeight: { index: 3, stripPrefix: 'SWT-' },
              netWeight: { index: 2, stripPrefix: 'NWT-' },
              category: 0,
              supplierCode: { index: 8, stripPrefix: '' },
            },
          },
          detectionPattern: {
            type: 'contains',
            pattern: 'USV',
          },
        }]
      : []),
    ...suppliers,
  ]

  tests.forEach((test, index) => {
    const detection = detectSupplier(test.qr, testSuppliers)
    const parseResult = parseQR(test.qr, detection?.supplier?.qrMapping)
    const normalizedResult = normalizeParsedQR(parseResult, detection?.supplier || null)
    const validationErrors = validateNormalized(normalizedResult, test.expected)
    const pass = validationErrors.length === 0

    console.log(`\n--- TEST ${index} ---`)
    console.log(`${pass ? 'PASS' : 'FAIL'}: ${test.name}`)
    console.log('DETECTED SUPPLIER:', detection?.supplier?.name || null)
    console.log('MATCH TYPE:', detection?.matchType || null)
    console.log('PARSED FIELDS:', JSON.stringify(parseResult.fields, null, 2))
    console.log('ERRORS:', JSON.stringify(parseResult.errors, null, 2))
    console.log('NORMALIZED:', JSON.stringify(normalizedResult, null, 2))
    if (validationErrors.length > 0) {
      console.log('VALIDATION ERRORS:')
      validationErrors.forEach((error) => {
        console.log(`- ${error}`)
      })
    }
  })

  process.exit(0)
}

main().catch((error) => {
  console.error('QR parser test harness failed:', error)
  process.exit(1)
})
