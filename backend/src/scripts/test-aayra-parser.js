/**
 * Aayra QR parser test script.
 *
 * Live-path checks:
 * - loads suppliers from the DB
 * - runs detectSupplier(raw, suppliers)
 * - runs parseQR(raw, detectedSupplier)
 * - verifies the slash-format samples only
 *
 * Run: node src/scripts/test-aayra-parser.js
 */

import { connectDB } from '../config/db.js'
import { Supplier } from '../models/Supplier.js'
import { detectSupplier } from '../services/qrParser.detection.js'
import { parseQR } from '../services/qrParser.service.js'

const PASS = '?'
const FAIL = '?'
let passed = 0
let failed = 0

const assert = (condition, label) => {
  if (condition) {
    console.log(`  ${PASS} ${label}`)
    passed += 1
    return true
  }

  console.error(`  ${FAIL} ${label}`)
  failed += 1
  return false
}

const approxEqual = (a, b, tolerance = 0.002) =>
  a !== null && b !== null && a !== undefined && b !== undefined && Math.abs(a - b) <= tolerance

const getFieldValue = (result, fieldPath) => {
  let current = result
  for (const key of fieldPath) {
    current = current?.[key]
  }
  return current?.value ?? current ?? null
}

const samples = [
  { raw: 'N66162/G 4.168/L 0.52/N 3.648/LR-M271', itemCode: 'N66162', gross: 4.168, stone: 0.52, net: 3.648 },
  { raw: 'N66207/G 2.27/L 0.078/N 2.192/LR-2127', itemCode: 'N66207', gross: 2.27, stone: 0.078, net: 2.192 },
  { raw: 'N66271/G 3.335/L 0.36/N 2.975/LR-1806', itemCode: 'N66271', gross: 3.335, stone: 0.36, net: 2.975 },
  { raw: 'N66182/G 1.944/L 0.261/N 1.683/LR-1793', itemCode: 'N66182', gross: 1.944, stone: 0.261, net: 1.683 },
  { raw: 'N66227/G 1.32/L 0.04/N 1.28/LR-2500', itemCode: 'N66227', gross: 1.32, stone: 0.04, net: 1.28 },
]

const main = async () => {
  await connectDB()

  const suppliers = await Supplier.find().lean()
  const aayraSupplier = suppliers.find((supplier) => {
    const name = String(supplier?.name || '').toLowerCase()
    const code = String(supplier?.code || '').toLowerCase()
    return name.includes('aayra') || code.includes('aayra')
  })

  if (!aayraSupplier) {
    console.error('Aayra supplier not found in DB.')
    console.error('Required setup: supplier name/code should include Aayra/aayra and slash strategy support must be available.')
    process.exit(1)
  }

  console.log('Aayra supplier found:', {
    name: aayraSupplier.name,
    code: aayraSupplier.code,
    strategy: aayraSupplier?.qrMapping?.strategy || null,
  })

  for (const [index, sample] of samples.entries()) {
    console.log(`\nSample ${index + 1}: ${sample.raw}`)

    const detection = detectSupplier(sample.raw, suppliers)
    assert(Boolean(detection?.supplier), 'supplier detected')
    assert(String(detection?.supplier?.name || '').toLowerCase().includes('aayra'), 'detected supplier is Aayra')
    assert(detection?.matchType === 'structural', `matchType = structural (got ${detection?.matchType || 'null'})`)

    const parsed = parseQR(sample.raw, detection?.supplier || null)
    const strategy = parsed?.pattern?.strategy || null

    assert(strategy === 'aayra', `strategy = aayra (got ${strategy || 'null'})`)
    assert(String(getFieldValue(parsed, ['fields', 'meta', 'itemCode']) || '') === sample.itemCode, `itemCode = ${sample.itemCode}`)
    assert(approxEqual(getFieldValue(parsed, ['fields', 'grossWeight']), sample.gross), `grossWeight ˜ ${sample.gross}`)
    assert(approxEqual(getFieldValue(parsed, ['fields', 'stoneWeight']), sample.stone), `stoneWeight ˜ ${sample.stone}`)
    assert(approxEqual(getFieldValue(parsed, ['fields', 'netWeight']), sample.net), `netWeight ˜ ${sample.net}`)
    assert(approxEqual(getFieldValue(parsed, ['calculationBreakdown', 'computedNetWeight']), Math.round((sample.gross - sample.stone) * 1000) / 1000), 'computed net matches gross - stone')
    assert(getFieldValue(parsed, ['calculationBreakdown', 'otherWeight']) === 0, 'otherWeight = 0')

    if (index === 0) {
      console.log('\nSample parse output:')
      console.log(JSON.stringify({
        supplier: detection?.supplier?.name || null,
        matchType: detection?.matchType || null,
        strategy,
        itemCode: getFieldValue(parsed, ['fields', 'meta', 'itemCode']),
        grossWeight: getFieldValue(parsed, ['fields', 'grossWeight']),
        stoneWeight: getFieldValue(parsed, ['fields', 'stoneWeight']),
        netWeight: getFieldValue(parsed, ['fields', 'netWeight']),
        otherWeight: getFieldValue(parsed, ['calculationBreakdown', 'otherWeight']),
        referenceText: getFieldValue(parsed, ['fields', 'meta', 'referenceText']),
        errors: parsed?.errors || [],
      }, null, 2))
    }
  }

  const regressionSamples = [
    { label: 'Yug', raw: 'SWMS - 691HG\nGW : 3.750\nSS : 0.000\nMS : 0.197\nOW : 0.000\nNW : 3.553\nKT - 18K' },
    { label: 'Utsav', raw: 'TM-868/GWT-6.600/NWT-5.120/SWT-0.840//USV' },
    { label: 'Adinath', raw: '4.01/0.36/////3.65/TM-155' },
    { label: 'Venzora', raw: '307285/18KT/G16.970/L0.316/N16.654/Rs.379/CH-435A' },
  ]

  console.log('\nRegression guard samples:')
  for (const sample of regressionSamples) {
    const detection = detectSupplier(sample.raw, suppliers)
    console.log(`  ${sample.label}:`, detection?.supplier?.name || null, detection?.matchType || null)
    assert(String(detection?.supplier?.name || '').toLowerCase() !== 'aayra', `${sample.label} is not misdetected as Aayra`)
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    process.exit(1)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('Aayra parser test harness failed:', error)
  process.exit(1)
})
