import { validate } from '../services/qrValidation.service.js'
import { valuate } from '../services/qrValuation.service.js'
import { getStoneRate } from '../services/qrValuation.stone.js'

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const isClose = (actual, expected, tolerance = 0.0001) => {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance
}

const cases = [
  {
    name: 'Supplier fine mismatch warning',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 12.62,
      stone_weight: 1.222,
      other_weight: 0,
      net_weight: 11.398,
      purity_percent: 75,
      wastage_percent: 10,
      fine_weight: 8.5,
      stone_amount: 125,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      fine_weight_source: 'supplier',
      stone_amount_source: 'supplier',
      valuation_status: 'complete',
      warningsInclude: ['FINE: Supplier fine differs from derived fine'],
    },
  },
  {
    name: 'Derived valuation complete',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 12.62,
      stone_weight: 1.222,
      other_weight: 0,
      net_weight: 11.398,
      purity_percent: 75,
      wastage_percent: 10,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    options: {
      defaultStoneRate: 2.5,
    },
    expected: {
      fine_weight_source: 'derived',
      stone_amount_source: 'fallback_rate',
      valuation_status: 'complete',
      stone_amount: 3.055,
    },
  },
  {
    name: 'Partial valuation',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 12.62,
      stone_weight: 1.222,
      other_weight: 0,
      net_weight: 11.398,
      purity_percent: null,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      fine_weight_source: 'missing',
      stone_amount_source: 'fallback_rate',
      valuation_status: 'partial',
      fine_weight: null,
    },
  },
  {
    name: 'Supplier stone amount complete',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 12.62,
      stone_weight: 1.222,
      other_weight: 0,
      net_weight: 11.398,
      purity_percent: 75,
      wastage_percent: 10,
      fine_weight: null,
      stone_amount: 321.5,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      stone_amount_source: 'supplier',
      valuation_status: 'complete',
      stone_amount: 321.5,
    },
  },
  {
    name: 'Fallback stone amount complete',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 12.62,
      stone_weight: 2,
      other_weight: 0,
      net_weight: 10.62,
      purity_percent: 75,
      wastage_percent: 10,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    options: {
      defaultStoneRate: 2.5,
    },
    expected: {
      stone_amount_source: 'fallback_rate',
      valuation_status: 'complete',
      stone_amount: 5,
    },
  },
  {
    name: 'Supplier only valuation',
    input: {
      supplier: 'ZAR',
      design_code: null,
      gross_weight: null,
      stone_weight: null,
      other_weight: null,
      net_weight: null,
      purity_percent: null,
      wastage_percent: null,
      fine_weight: 8.25,
      stone_amount: 120,
      confidence: 40,
      status: 'needs_review',
    },
    expected: {
      fine_weight_source: 'supplier',
      stone_amount_source: 'supplier',
      valuation_status: 'supplier_only',
    },
  },
]

let passed = 0

for (const testCase of cases) {
  const validated = validate(testCase.input)
  const result = valuate(validated, testCase.options || {})

  assert(result && typeof result === 'object', `${testCase.name}: result must be an object`)
  assert(result.totals && typeof result.totals === 'object', `${testCase.name}: totals must be present`)
  assert(Array.isArray(result.warnings), `${testCase.name}: warnings must be an array`)

  assert(
    ['supplier', 'derived', 'missing'].includes(result.fine_weight_source),
    `${testCase.name}: fine_weight_source is invalid`
  )
  assert(
    ['supplier', 'fallback_rate', 'missing'].includes(result.stone_amount_source),
    `${testCase.name}: stone_amount_source is invalid`
  )
  assert(
    ['complete', 'partial', 'supplier_only'].includes(result.valuation_status),
    `${testCase.name}: valuation_status is invalid`
  )

  if (testCase.expected.fine_weight_source) {
    assert(
      result.fine_weight_source === testCase.expected.fine_weight_source,
      `${testCase.name}: fine_weight_source mismatch`
    )
  }

  if (testCase.expected.stone_amount_source) {
    assert(
      result.stone_amount_source === testCase.expected.stone_amount_source,
      `${testCase.name}: stone_amount_source mismatch`
    )
  }

  if (testCase.expected.valuation_status) {
    assert(
      result.valuation_status === testCase.expected.valuation_status,
      `${testCase.name}: valuation_status mismatch`
    )
  }

  if (testCase.expected.warningsInclude) {
    for (const warning of testCase.expected.warningsInclude) {
      assert(result.warnings.includes(warning), `${testCase.name}: missing warning ${warning}`)
    }
  }

  if (testCase.expected.fine_weight === null) {
    assert(result.fine_weight === null, `${testCase.name}: fine_weight should be null`)
  } else if (testCase.expected.fine_weight !== undefined) {
    assert(isClose(result.fine_weight, testCase.expected.fine_weight), `${testCase.name}: fine_weight mismatch`)
  }

  if (testCase.expected.stone_amount === null) {
    assert(result.stone_amount === 0 || result.stone_amount === null, `${testCase.name}: stone_amount should be 0 or null`)
  } else if (testCase.expected.stone_amount !== undefined) {
    assert(isClose(result.stone_amount, testCase.expected.stone_amount), `${testCase.name}: stone_amount mismatch`)
  }

  assert(typeof result.totals.gross_weight === 'number', `${testCase.name}: gross_weight total must be numeric`)
  assert(typeof result.totals.stone_weight === 'number', `${testCase.name}: stone_weight total must be numeric`)
  assert(typeof result.totals.other_weight === 'number', `${testCase.name}: other_weight total must be numeric`)
  assert(typeof result.totals.net_weight === 'number', `${testCase.name}: net_weight total must be numeric`)
  assert(typeof result.totals.fine_weight === 'number', `${testCase.name}: fine_weight total must be numeric`)
  assert(typeof result.totals.stone_amount === 'number', `${testCase.name}: stone_amount total must be numeric`)
  assert(typeof result.totals.other_amount === 'number', `${testCase.name}: other_amount total must be numeric`)

  passed += 1
}

assert(getStoneRate('diamond', { defaultStoneRate: 2.5 }) === 2.5, 'getStoneRate should return configured rate')
assert(getStoneRate('ruby', { defaultStoneRate: 1.75 }) === 1.75, 'getStoneRate should ignore stone type for now')
assert(getStoneRate(undefined, {}) === 0, 'getStoneRate should default to 0')

console.log(`QR valuation tests passed (${passed}/${cases.length})`)
