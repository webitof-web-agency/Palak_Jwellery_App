import {
  buildCsvExport,
  buildDashboardSummary,
  buildPdfBuffer,
  buildReportDetail,
  buildReportQuery,
  filterReportRows,
  mapReportRow,
} from '../services/qrReporting.service.js'

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const isClose = (actual, expected, tolerance = 0.0001) => {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance
}

const records = [
  {
    _id: '000000000000000000000001',
    createdAt: new Date('2026-05-01T09:00:00.000Z'),
    parsed: { supplier: 'YUG', designCode: 'YUG-1' },
    final: { designCode: 'YUG-1' },
    status: 'approved',
    confidence: 92,
    validationWarnings: ['WEIGHT: Net weight mismatch'],
    valuation: {
      valuation_status: 'complete',
      warnings: ['FINE: Supplier fine differs from derived fine'],
      totals: {
        gross_weight: 12.62,
        stone_weight: 1.222,
        other_weight: 0,
        net_weight: 11.398,
        fine_weight: 9.6185,
        stone_amount: 3.055,
        other_amount: 0,
      },
    },
  },
  {
    _id: '000000000000000000000002',
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    parsed: { supplier: 'ZAR', designCode: 'ZAR-1' },
    final: { designCode: 'ZAR-1' },
    status: 'needs_review',
    confidence: 40,
    validationWarnings: ['DATA: Insufficient QR data'],
    valuation: {
      valuation_status: 'supplier_only',
      warnings: ['DATA: Supplier requires manual review'],
      totals: {
        gross_weight: 0,
        stone_weight: 0,
        other_weight: 0,
        net_weight: 0,
        fine_weight: 8.25,
        stone_amount: 120,
        other_amount: 0,
      },
    },
  },
  {
    _id: '000000000000000000000003',
    createdAt: new Date('2026-05-02T10:00:00.000Z'),
    parsed: { supplier: 'UTSAV', designCode: 'UTS-1' },
    final: { designCode: 'UTS-1' },
    status: 'needs_review',
    confidence: 68,
    validationWarnings: ['DATA: Partial data - verify before billing'],
    valuation: {
      valuation_status: 'partial',
      warnings: [],
      totals: {
        gross_weight: 15.1,
        stone_weight: 1.06,
        other_weight: 0.38,
        net_weight: 13.66,
        fine_weight: 0,
        stone_amount: 2.65,
        other_amount: 0,
      },
    },
  },
]

const filtered = filterReportRows(records, {
  supplier: 'YUG',
  status: 'approved',
  valuationStatus: 'complete',
  confidenceThreshold: 90,
})

assert(filtered.length === 1, 'filtered aggregation should return one row')
assert(filtered[0].supplier === 'YUG', 'filtered row supplier mismatch')

const searchFiltered = filterReportRows(records, {
  search: 'uts-1',
})

assert(searchFiltered.length === 1, 'search filtering should return one row')
assert(searchFiltered[0].supplier === 'UTSAV', 'search filtering supplier mismatch')

const searchQuery = buildReportQuery({ search: 'yug-1' })
assert(Array.isArray(searchQuery.$or), 'search query should include OR conditions')
assert(searchQuery.$or.length > 0, 'search query OR conditions should not be empty')

const summary = buildDashboardSummary(records)
assert(summary.total_items === 3, 'summary total_items mismatch')
assert(isClose(summary.total_gross_weight, 27.72), 'summary gross total mismatch')
assert(isClose(summary.total_stone_weight, 2.282), 'summary stone total mismatch')
assert(isClose(summary.total_other_weight, 0.38), 'summary other total mismatch')
assert(isClose(summary.total_net_weight, 25.058), 'summary net total mismatch')
assert(isClose(summary.total_fine_weight, 17.8685), 'summary fine total mismatch')
assert(isClose(summary.total_stone_amount, 125.705), 'summary stone amount mismatch')
assert(summary.approved_count === 1, 'approved count mismatch')
assert(summary.needs_review_count === 2, 'needs review count mismatch')
assert(summary.complete_valuation_count === 1, 'complete valuation count mismatch')
assert(summary.partial_valuation_count === 1, 'partial valuation count mismatch')
assert(summary.supplier_only_count === 1, 'supplier only count mismatch')

const csv = buildCsvExport(records.map((record) => mapReportRow(record)))
assert(csv.startsWith('supplier,design_code,gross_weight'), 'CSV header mismatch')
assert(csv.split('\n').length === 4, 'CSV row count mismatch')
assert(csv.includes('YUG-1'), 'CSV content missing design code')

const pdf = buildPdfBuffer(records.map((record) => mapReportRow(record)), summary, {
  supplier: 'All',
  reportDate: '2026-05-02',
})
assert(Buffer.isBuffer(pdf), 'PDF output must be a buffer')
assert(pdf.toString('utf8').startsWith('%PDF-1.4'), 'PDF header mismatch')

const detail = buildReportDetail(records[1])
assert(Array.isArray(detail.validation_warnings), 'validation_warnings must be an array')
assert(Array.isArray(detail.valuation_warnings), 'valuation_warnings must be an array')
assert(detail.validation_warnings.length === 1, 'validation_warnings separation mismatch')
assert(detail.valuation_warnings.length === 1, 'valuation_warnings separation mismatch')
assert(detail.validation_warnings[0] === 'DATA: Insufficient QR data', 'validation warning mismatch')
assert(detail.valuation_warnings[0] === 'DATA: Supplier requires manual review', 'valuation warning mismatch')

console.log('QR reporting tests passed (6/6)')
