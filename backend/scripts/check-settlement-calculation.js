import assert from 'node:assert/strict'
import {
  calculateSettlementSnapshot,
  calculateYugWeightBreakdown,
} from '../src/services/settlementCalculation.service.js'

const approxEqual = (actual, expected, tolerance = 0.0001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`)
}

const basicSnapshot = calculateSettlementSnapshot({
  grossWeight: 10,
  stoneWeight: 1,
  otherWeight: 0,
  purityPercent: 76,
  wastagePercent: 10,
  qrNetWeight: 9,
  tolerance: 0.005,
})

assert.equal(basicSnapshot.computedNetWeight, 9)
assert.equal(basicSnapshot.settlementPercent, 86)
approxEqual(basicSnapshot.fineWeight, 7.74)
assert.equal(basicSnapshot.requiresReview, false)

const yugBreakdown = calculateYugWeightBreakdown({
  grossWeight: 3.17,
  ssWeight: 0,
  msWeight: 0,
  spWeight: 0,
  otWeight: 0.069,
  qrNetWeight: 3.101,
  tolerance: 0.005,
})

assert.equal(yugBreakdown.stoneWeight, 0)
assert.equal(yugBreakdown.otherWeight, 0.069)
approxEqual(yugBreakdown.computedNetWeight, 3.101)
assert.equal(yugBreakdown.requiresReview, false)

const mismatchSnapshot = calculateSettlementSnapshot({
  grossWeight: 10,
  stoneWeight: 1,
  otherWeight: 0,
  qrNetWeight: 8.5,
  purityPercent: 76,
  wastagePercent: 10,
  tolerance: 0.005,
})

assert.equal(mismatchSnapshot.computedNetWeight, 9)
assert.equal(mismatchSnapshot.requiresReview, true)
assert.ok(
  mismatchSnapshot.warnings.some((warning) =>
    warning.includes('QR net weight differs from computed net weight beyond tolerance')
  )
)

console.log('Settlement calculation checks passed.')
