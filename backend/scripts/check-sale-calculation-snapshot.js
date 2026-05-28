import assert from 'node:assert/strict'
import {
  buildSaleCalculationSnapshot,
  buildSaleParsedSnapshot,
} from '../src/services/saleCalculationSnapshot.service.js'

const almostEqual = (actual, expected, tolerance = 0.0005) => {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  )
}

const run = () => {
  const baseSnapshot = buildSaleCalculationSnapshot({
    source: {
      grossWeight: 10,
      stoneWeight: 1,
      otherWeight: 0,
      qrNetWeight: 9,
      purityPercent: 76,
      wastagePercent: 10,
      tolerance: 0.005,
    },
  })

  almostEqual(baseSnapshot.computedNetWeight, 9)
  almostEqual(baseSnapshot.settlementPercent, 86)
  almostEqual(baseSnapshot.fineWeight, 7.74)
  assert.equal(baseSnapshot.requiresReview, false)
  assert.ok(baseSnapshot.settlementInputs)
  assert.equal(baseSnapshot.settlementInputs.purityPercent, 76)
  assert.equal(baseSnapshot.settlementInputs.wastagePercent, 10)
  assert.equal(baseSnapshot.settlementInputs.puritySource, 'request')
  assert.equal(baseSnapshot.settlementInputs.wastageSource, 'request')

  const mismatchSnapshot = buildSaleCalculationSnapshot({
    source: {
      grossWeight: 10,
      stoneWeight: 1,
      otherWeight: 0,
      qrNetWeight: 8.5,
      purityPercent: 76,
      wastagePercent: 10,
      tolerance: 0.005,
    },
  })

  assert.equal(mismatchSnapshot.requiresReview, true)
  assert.ok(
    mismatchSnapshot.warnings.some((warning) =>
      String(warning).includes('QR net weight differs from computed net weight')
    )
  )

  const manualSnapshot = buildSaleCalculationSnapshot({
    source: {
      grossWeight: 10,
      stoneWeight: 1,
      otherWeight: 0,
      purityPercent: 76,
      wastagePercent: 10,
    },
  })

  assert.equal(manualSnapshot.requiresReview, false)
  almostEqual(manualSnapshot.computedNetWeight, 9)
  almostEqual(manualSnapshot.fineWeight, 7.74)
  assert.ok(manualSnapshot.settlementInputs)
  assert.equal(manualSnapshot.settlementInputs.karat, null)

  const parsedPayload = {
    display: {
      item: {
        karat: '18K',
        itemCode: 'TM-292',
      },
      weights: {
        grossWeight: 10,
      },
    },
  }
  const parsedSnapshot = buildSaleParsedSnapshot(JSON.stringify(parsedPayload))
  assert.deepEqual(parsedSnapshot, parsedPayload)
  assert.equal(buildSaleParsedSnapshot(null), null)

  console.log('Sale calculation snapshot checks passed (4/4)')
}

run()
