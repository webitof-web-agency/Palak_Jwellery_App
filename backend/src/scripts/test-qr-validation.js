import { validate } from '../services/qrValidation.service.js'

const testCases = [
  {
    name: 'Perfect Venzora',
    input: {
      supplier: 'VENZORA',
      design_code: 'CH-435A',
      gross_weight: 16.97,
      stone_weight: 0.316,
      other_weight: null,
      net_weight: 16.654,
      purity_percent: 18,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'approved',
      confidence: 92,
      warningIncludes: ['DATA: Partial data - verify before billing'],
    },
  },
  {
    name: 'Utsav relaxed net',
    input: {
      supplier: 'UTSAV',
      design_code: 'NST-5185',
      gross_weight: 15.1,
      stone_weight: 1.06,
      other_weight: null,
      net_weight: 13.66,
      purity_percent: null,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'approved',
      confidence: 92,
      warningIncludes: ['DATA: Partial data - verify before billing'],
    },
  },
  {
    name: 'Strict net mismatch',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 10,
      stone_weight: 1,
      other_weight: 0,
      net_weight: 8,
      purity_percent: 75,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['WEIGHT: Net weight mismatch'],
    },
  },
  {
    name: 'Stone exceeds gross',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 5,
      stone_weight: 6,
      other_weight: 0,
      net_weight: -1,
      purity_percent: 75,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['STONE: Stone weight exceeds gross weight'],
      confidenceMax: 59,
    },
  },
  {
    name: 'Net exceeds gross',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 5,
      stone_weight: 1,
      other_weight: 0,
      net_weight: 6,
      purity_percent: 75,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['WEIGHT: Net weight exceeds gross weight'],
      confidenceMax: 59,
    },
  },
  {
    name: 'Small rounding difference',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 10,
      stone_weight: 1,
      other_weight: 0,
      net_weight: 8.999,
      purity_percent: 75,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'approved',
      warningIncludes: ['DATA: Partial data - verify before billing'],
    },
  },
  {
    name: 'Negative weight',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: -10,
      stone_weight: 1,
      other_weight: 0,
      net_weight: 8,
      purity_percent: 75,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['Invalid weight value'],
    },
  },
  {
    name: 'Zero net weight',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 10,
      stone_weight: 10,
      other_weight: 0,
      net_weight: 0,
      purity_percent: 75,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['Invalid or zero net weight'],
    },
  },
  {
    name: 'Purity out of range',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 10,
      stone_weight: 1,
      other_weight: 0,
      net_weight: 9,
      purity_percent: 150,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['Invalid purity value'],
    },
  },
  {
    name: 'Wastage out of range',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 10,
      stone_weight: 1,
      other_weight: 0,
      net_weight: 9,
      purity_percent: 75,
      wastage_percent: -5,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['Invalid wastage value'],
    },
  },
  {
    name: 'Fine mismatch',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 12.62,
      stone_weight: 1.222,
      other_weight: null,
      net_weight: 11.398,
      purity_percent: 75,
      wastage_percent: 10,
      fine_weight: 2,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['FINE: Fine weight mismatch'],
    },
  },
  {
    name: 'Fine not present',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 10,
      stone_weight: 1,
      other_weight: 0,
      net_weight: 9,
      purity_percent: 75,
      wastage_percent: 10,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'approved',
      warningIncludes: ['FINE: Fine not provided', 'FINE: Fine validation skipped', 'DATA: Partial data - verify before billing'],
    },
  },
  {
    name: 'Critical fields missing',
    input: {
      supplier: 'YUG',
      design_code: null,
      gross_weight: 12.62,
      stone_weight: 1.222,
      other_weight: null,
      net_weight: null,
      purity_percent: 75,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['DATA: Critical fields missing'],
    },
  },
  {
    name: 'Confidence drift',
    input: {
      supplier: 'YUG',
      design_code: 'SWNK - 976',
      gross_weight: 10,
      stone_weight: 1,
      other_weight: 0,
      net_weight: 8.8,
      purity_percent: 150,
      wastage_percent: -5,
      fine_weight: null,
      stone_amount: null,
      confidence: 92,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      confidenceMax: 59,
      warningIncludes: ['Invalid purity value', 'Invalid wastage value', 'WEIGHT: Net weight mismatch'],
    },
  },
  {
    name: 'Garbage QR normalized',
    input: {
      supplier: 'YUG',
      design_code: null,
      gross_weight: null,
      stone_weight: null,
      other_weight: null,
      net_weight: null,
      purity_percent: null,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 10,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      warningIncludes: ['DATA: Insufficient data'],
    },
  },
  {
    name: 'Zar lenient',
    input: {
      supplier: 'ZAR',
      design_code: 'JFC74342',
      gross_weight: null,
      stone_weight: null,
      other_weight: null,
      net_weight: null,
      purity_percent: null,
      wastage_percent: null,
      fine_weight: null,
      stone_amount: null,
      confidence: 36,
      status: 'pending',
    },
    expected: {
      status: 'needs_review',
      confidence: 36,
      warningIncludes: ['DATA: Supplier requires manual review', 'DATA: Insufficient QR data'],
    },
  },
]

const failures = []

for (const testCase of testCases) {
  const result = validate(structuredClone(testCase.input))
  const statusOk = result.status === testCase.expected.status
  const confidenceOk = (() => {
    if (testCase.expected.confidence !== undefined) {
      return result.confidence === testCase.expected.confidence
    }

    if (testCase.expected.confidenceMin !== undefined && result.confidence < testCase.expected.confidenceMin) {
      return false
    }

    if (testCase.expected.confidenceMax !== undefined && result.confidence > testCase.expected.confidenceMax) {
      return false
    }

    return true
  })()
  const expectedWarnings = testCase.expected.warnings || []
  const warningIncludes = testCase.expected.warningIncludes || []
  const warningsOk =
    expectedWarnings.length === 0 && warningIncludes.length === 0
      ? Array.isArray(result.warnings) && result.warnings.length === 0
      : expectedWarnings.every((warning) => Array.isArray(result.warnings) && result.warnings.includes(warning)) &&
        warningIncludes.every((warning) => Array.isArray(result.warnings) && result.warnings.includes(warning))

  if (!statusOk || !confidenceOk || !warningsOk) {
    failures.push({
      name: testCase.name,
      expected: testCase.expected,
      actual: {
        status: result.status,
        confidence: result.confidence,
        warnings: result.warnings,
      },
    })
  }
}

if (failures.length > 0) {
  console.error('QR validation tests failed:')
  console.error(JSON.stringify(failures, null, 2))
  process.exitCode = 1
} else {
  console.log(`QR validation tests passed (${testCases.length}/${testCases.length})`)
}
