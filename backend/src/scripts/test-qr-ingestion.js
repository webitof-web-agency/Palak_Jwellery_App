import { detectSupplier, normalizeParsedQR, parseQR } from '../services/qrParser.service.js'
import {
  buildDefaultFinalFromParsed,
  buildParsedIngestionData,
  buildParsedWarnings,
  buildUnknownParsedIngestionData,
  evaluateParsedStatus,
  mergeFinalData,
  validateFinalData,
} from '../services/qrIngestion.service.js'

const tests = [
  {
    name: 'Valid QR - Venzora',
    qr: '307285/18KT/G16.970/L0.316/N16.654/Rs.379/CH-435A',
  },
  {
    name: 'Missing weights - garbage-like',
    qr: 'HELLO RANDOM TEXT',
  },
  {
    name: 'Invalid tokens - Venzora',
    qr: '307285/18KT/G16..970/LXYZ/N16.654/Rs.379/CH-435A',
  },
  {
    name: 'Missing CH - Venzora',
    qr: '307285/18KT/G16.970/L0.316/N16.654/Rs.379',
  },
  {
    name: 'Unknown supplier - random text',
    qr: 'HELLO RANDOM TEXT',
  },
  {
    name: 'Unknown supplier - partially structured',
    qr: 'ABC123/12.500/0.250/11.900',
  },
  {
    name: 'Unknown supplier - mixed tokens',
    qr: 'Q-991 9.450 0.250 9.200 REF-77',
  },
  {
    name: 'Warnings - netWeight zero',
    qr: '307285/18KT/G16.970/L0.316/N0/Rs.379/CH-435A',
  },
  {
    name: 'Warnings - diamondWeight too high',
    qr: '307285/18KT/G1.000/L2.000/N0/Rs.379/CH-435A',
  },
]

const suppliers = [
  {
    name: 'Venzora',
    code: 'VENZORA',
    qrMapping: { strategy: 'venzora' },
  },
]

for (const test of tests) {
  const detection = detectSupplier(test.qr, suppliers)
  const parseResult = parseQR(test.qr, detection?.supplier?.qrMapping)
  const normalizedResult = normalizeParsedQR(parseResult, detection?.supplier || null)
  const isUnknown = !detection?.supplier
  const parsed = isUnknown
    ? {}
    : buildParsedIngestionData(normalizedResult, detection?.supplier || null)
  if (!isUnknown) {
    parsed.warnings = buildParsedWarnings(parsed)
  }
  const parsedStatus = isUnknown
    ? { status: 'needs_review', issues: ['Unknown supplier format'] }
    : evaluateParsedStatus(parsed, { warningsRequireReview: false })
  const final = isUnknown
    ? (() => {
        const fallback = buildUnknownParsedIngestionData(test.qr)
        return {
        itemCode: fallback?.itemCode || '',
        category: null,
        productId: null,
        purity: fallback?.purity || null,
        grossWeight: fallback?.grossWeight ?? null,
        netWeight: fallback?.netWeight ?? null,
        diamondWeight: fallback?.diamondWeight ?? null,
        designCode: null,
        customFields: [],
        }
      })()
    : buildDefaultFinalFromParsed(parsed)
  const finalValidationErrors = validateFinalData(final)
  const mergedFinal = mergeFinalData(isUnknown ? normalizedResult : parsed, final, {})

  console.log(`\n--- ${test.name} ---`)
  console.log('detected supplier:', detection?.supplier?.name || null)
  console.log('parsed:', JSON.stringify(parsed, null, 2))
  console.log('parsed status:', parsedStatus.status)
  console.log('parsed issues:', JSON.stringify(parsedStatus.issues, null, 2))
  console.log('parsed warnings:', JSON.stringify(parsed?.warnings || ['Unknown supplier format'], null, 2))
  console.log('fallback:', JSON.stringify(isUnknown ? buildUnknownParsedIngestionData(test.qr).fallback : null, null, 2))
  console.log('final draft:', JSON.stringify(final, null, 2))
  console.log('final validation errors:', JSON.stringify(finalValidationErrors, null, 2))
  console.log('merged final:', JSON.stringify(mergedFinal, null, 2))
}
