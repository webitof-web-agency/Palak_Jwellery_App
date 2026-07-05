import assert from 'node:assert/strict'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

const {
  buildSalesSessionReportRowsFromSessions,
  buildSalesSessionReportSummaryFromSessions,
} = await import('../src/services/salesSessionReports.service.js')

const makeSalesman = (id, name) => ({
  _id: id,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
  phone: '',
})

const makeItem = ({
  itemCode,
  supplierName,
  category = '',
  appliedKarat = '',
  wastage = 0,
  grossWeight,
  stoneWeight,
  otherWeight,
  netWeight,
  fineWeight,
  stoneAmount = 0,
  otherAmount = 0,
  warnings = [],
} = {}) => ({
  clientItemId: `${itemCode}-client`,
  itemCode,
  supplierName,
  category,
  appliedKarat,
  wastage,
  grossWeight,
  stoneWeight,
  otherWeight,
  netWeight,
  fineWeight,
  stoneAmount,
  otherAmount,
  warnings,
  requiresReview: warnings.length > 0,
})

const fixtures = [
  {
    _id: '686400000000000000000001',
    sessionRef: 'SESSION-ONE',
    status: 'submitted',
    createdAt: new Date('2026-07-02T10:00:00.000Z'),
    updatedAt: new Date('2026-07-02T10:05:00.000Z'),
    customerName: 'Aadinath Jewels',
    customerPhone: '',
    customerArea: 'Andheri West',
    customerEmail: '',
    assignedSalesmanId: makeSalesman('6864000000000000000000a1', 'Salesman One'),
    lockedSettingsSnapshot: { supplierName: 'YUG', karat: '18K', wastage: 10 },
    mobileItems: [
      makeItem({
        itemCode: 'YUG-001',
        supplierName: 'YUG',
        category: 'Orange',
        appliedKarat: '18K',
        wastage: 10,
        grossWeight: 10,
        stoneWeight: 1,
        otherWeight: 0.5,
        netWeight: 8.5,
        fineWeight: 7,
        stoneAmount: 100,
        otherAmount: 20,
      }),
      makeItem({
        itemCode: 'UTSAV-001',
        supplierName: 'UTSAV',
        category: '',
        appliedKarat: '14K',
        wastage: 12.5,
        grossWeight: 5,
        stoneWeight: 0.2,
        otherWeight: 0,
        netWeight: 4.8,
        fineWeight: 3.4,
        stoneAmount: 30,
        otherAmount: 0,
        warnings: ['QR Karat Mismatch'],
      }),
    ],
  },
  {
    _id: '686400000000000000000002',
    sessionRef: 'SESSION-CANCELLED',
    status: 'cancelled',
    createdAt: new Date('2026-07-02T11:00:00.000Z'),
    updatedAt: new Date('2026-07-02T11:10:00.000Z'),
    customerName: 'Cancelled Customer',
    customerPhone: '',
    customerArea: 'Bandra',
    customerEmail: '',
    assignedSalesmanId: makeSalesman('6864000000000000000000a2', 'Salesman Two'),
    lockedSettingsSnapshot: { supplierName: 'VENZORA', karat: '22K', wastage: 8 },
    mobileItems: [
      makeItem({
        itemCode: 'VEN-001',
        supplierName: 'VENZORA',
        category: 'Ring',
        appliedKarat: '22K',
        wastage: 8,
        grossWeight: 20,
        stoneWeight: 1,
        otherWeight: 0,
        netWeight: 19,
        fineWeight: 17,
        stoneAmount: 50,
        otherAmount: 0,
      }),
    ],
  },
]

const activeSessions = fixtures.filter((session) => session.status !== 'cancelled')

const activeSessionRows = buildSalesSessionReportRowsFromSessions({
  sessions: activeSessions,
  filters: { mode: 'session', status: 'active' },
})

assert.equal(activeSessionRows.length, 1, 'active session mode should exclude cancelled sessions')
assert.equal(activeSessionRows[0].itemCount, 2, 'active session should keep both mobile items')

const supplierRows = buildSalesSessionReportRowsFromSessions({
  sessions: activeSessions,
  filters: { mode: 'supplier', status: 'active' },
})

assert.equal(supplierRows.length, 2, 'supplier mode should create one row per supplier')
assert.equal(supplierRows.find((row) => row.groupLabel === 'YUG')?.grossWeight, 10)
assert.equal(supplierRows.find((row) => row.groupLabel === 'UTSAV')?.warningsCount, 1)

const categoryRows = buildSalesSessionReportRowsFromSessions({
  sessions: activeSessions,
  filters: { mode: 'category', status: 'active' },
})

assert.equal(categoryRows.some((row) => row.groupLabel === 'YUG - Orange'), true, 'category mode should combine supplier and category when category exists')
assert.equal(categoryRows.some((row) => row.groupLabel === 'UTSAV'), true, 'category mode should fall back to supplier when category is missing')

const karatRows = buildSalesSessionReportRowsFromSessions({
  sessions: activeSessions,
  filters: { mode: 'karat', status: 'active' },
})

assert.equal(karatRows.find((row) => row.groupLabel === '18K')?.itemCount, 1)
assert.equal(karatRows.find((row) => row.groupLabel === '14K')?.supplierBreakdown?.[0]?.supplierName, 'UTSAV')

const wastageRows = buildSalesSessionReportRowsFromSessions({
  sessions: activeSessions,
  filters: { mode: 'wastage', status: 'active' },
})

assert.equal(wastageRows.find((row) => row.groupLabel === '10.00%')?.itemCount, 1)
assert.equal(wastageRows.find((row) => row.groupLabel === '12.50%')?.stoneAmount, 30)

const activeSummary = buildSalesSessionReportSummaryFromSessions({
  sessions: activeSessions,
  filters: { mode: 'supplier', status: 'active' },
})

assert.equal(activeSummary.totalSessions, 1, 'summary should count only active sessions')
assert.equal(activeSummary.totalItems, 2, 'summary should count only included active items')
assert.equal(activeSummary.grossWeight, 15, 'summary gross total mismatch')
assert.equal(activeSummary.netWeight, 13.3, 'summary net total mismatch')
assert.equal(activeSummary.warningsCount, 1, 'summary warning count mismatch')

console.log('check-sales-session-reports: ok')
