import { buildCsvExport, buildDashboardSummary, mapReportRow } from '../services/qrReporting.service.js'
import {
  compareCurrency,
  comparePercentage,
  compareWeight,
  formatCurrency,
  formatPercentage,
  formatWeight,
  roundCurrency,
  roundPercentage,
  roundWeight,
} from '../services/precision.service.js'
import { validate } from '../services/qrValidation.service.js'
import { valuate } from '../services/qrValuation.service.js'

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const almostEqual = (actual, expected, tolerance = 0.0001) =>
  Math.abs(Number(actual) - Number(expected)) <= tolerance

const precisionCases = [
  {
    name: 'Weight rounding',
    actual: roundWeight(12.3456),
    expected: 12.346,
  },
  {
    name: 'Currency rounding',
    actual: roundCurrency(12.345),
    expected: 12.35,
  },
  {
    name: 'Percentage rounding',
    actual: roundPercentage(75.678),
    expected: 75.68,
  },
]

for (const testCase of precisionCases) {
  assert(almostEqual(testCase.actual, testCase.expected), `${testCase.name} mismatch`)
}

assert(compareWeight(10.0004, 10.0009, 0.001), 'Weight tolerance should pass within range')
assert(!compareWeight(10, 10.003, 0.001), 'Weight tolerance should fail outside range')
assert(compareCurrency(10.004, 10.009, 0.01), 'Currency tolerance should pass within range')
assert(comparePercentage(75.004, 75.009, 0.01), 'Percentage tolerance should pass within range')
assert(formatWeight(1.2) === '1.200', 'Weight display should keep 3 decimals')
assert(formatCurrency(2.5) === '2.50', 'Currency display should keep 2 decimals')
assert(formatPercentage(75) === '75.00', 'Percentage display should keep 2 decimals')

const validationResult = validate({
  supplier: 'YUG',
  design_code: 'SWNK - 976',
  gross_weight: 12.62,
  stone_weight: 1.222,
  other_weight: 0,
  net_weight: 11.3984,
  purity_percent: 75,
  wastage_percent: 10,
  confidence: 92,
  status: 'pending',
})

assert(
  !(validationResult.warnings || []).includes('WEIGHT: Net weight mismatch'),
  'Validation tolerance should not flag a tiny net mismatch'
)

const valuationResult = valuate(validationResult, { defaultStoneRate: 2.5 })
assert(valuationResult && typeof valuationResult === 'object', 'Valuation should return an object')
assert(typeof valuationResult.totals.gross_weight === 'number', 'Valuation totals must be numeric')

const rawRecords = [
  {
    _id: '1',
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    parsed: { supplier: 'YUG', designCode: 'YUG-1' },
    status: 'approved',
    confidence: 92,
    valuation: {
      valuation_status: 'complete',
      warnings: [],
      totals: {
        gross_weight: 1.234,
        stone_weight: 0.111,
        other_weight: 0.222,
        net_weight: 0.901,
        fine_weight: 0.789,
        stone_amount: 12.345,
        other_amount: 0.5,
      },
    },
  },
  {
    _id: '2',
    createdAt: new Date('2026-05-01T11:00:00.000Z'),
    parsed: { supplier: 'YUG', designCode: 'YUG-2' },
    status: 'needs_review',
    confidence: 68,
    valuation: {
      valuation_status: 'partial',
      warnings: [],
      totals: {
        gross_weight: 2.111,
        stone_weight: 0.222,
        other_weight: 0.333,
        net_weight: 1.556,
        fine_weight: 1.111,
        stone_amount: 1.234,
        other_amount: 0.75,
      },
    },
  },
]

const reportRows = [
  mapReportRow({
    _id: '1',
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    parsed: { supplier: 'YUG', designCode: 'YUG-1' },
    status: 'approved',
    confidence: 92,
    valuation: {
      valuation_status: 'complete',
      warnings: [],
      totals: {
        gross_weight: 1.234,
        stone_weight: 0.111,
        other_weight: 0.222,
        net_weight: 0.901,
        fine_weight: 0.789,
        stone_amount: 12.345,
        other_amount: 0.5,
      },
    },
  }),
  mapReportRow({
    _id: '2',
    createdAt: new Date('2026-05-01T11:00:00.000Z'),
    parsed: { supplier: 'YUG', designCode: 'YUG-2' },
    status: 'needs_review',
    confidence: 68,
    valuation: {
      valuation_status: 'partial',
      warnings: [],
      totals: {
        gross_weight: 2.111,
        stone_weight: 0.222,
        other_weight: 0.333,
        net_weight: 1.556,
        fine_weight: 1.111,
        stone_amount: 1.234,
        other_amount: 0.75,
      },
    },
  }),
]

const summary = buildDashboardSummary(rawRecords)
assert(almostEqual(summary.total_gross_weight, 3.345), 'Dashboard totals should use persisted raw values')
assert(almostEqual(summary.total_stone_amount, 13.579), 'Amount totals should use persisted raw values')

const csv = buildCsvExport(reportRows)
assert(csv.includes('1.234'), 'CSV should preserve stored precision')
assert(csv.includes('12.345'), 'CSV should preserve stored currency precision')

assert(Number.isInteger(summary.total_items), 'Summary counts should stay integer')

console.log('QR precision tests passed (7/7)')
