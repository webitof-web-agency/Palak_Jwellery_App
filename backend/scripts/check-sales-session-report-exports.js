import assert from 'node:assert/strict'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

const {
  buildSalesSessionReportRowsFromSessions,
  listSalesSessionReportExportData,
} = await import('../src/services/salesSessionReports.service.js')
const {
  buildSalesSessionReportCsv,
  buildSalesSessionReportCsvFileName,
  buildSalesSessionReportPdfBuffer,
  buildSalesSessionReportPdfFileName,
} = await import('../src/services/salesSessionReportExports.service.js')

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

const summaryForFixtureRows = {
  totalSessions: 1,
  totalItems: 2,
  grossWeight: 15,
  stoneWeight: 1.2,
  otherWeight: 0.5,
  netWeight: 13.3,
  fineWeight: 10.4,
  stoneAmount: 130,
  otherAmount: 20,
  warningsCount: 1,
}

const sessionRows = buildSalesSessionReportRowsFromSessions({
  sessions: fixtures,
  filters: { mode: 'session', status: 'active', page: 9, limit: 1 },
})
const sessionCsv = buildSalesSessionReportCsv({ mode: 'session', rows: sessionRows })
assert.match(sessionCsv, /^session_ref,date,customer_name,customer_phone,customer_area,salesman,suppliers,items,gross_weight,stone_weight,other_weight,net_weight,fine_weight,warnings_count,status/m)
assert.equal(sessionCsv.includes('SESSION-CANCELLED'), false, 'session export should exclude cancelled rows by default')
assert.equal(sessionCsv.includes('SESSION-ONE'), true, 'session export should include active rows')

const supplierRows = buildSalesSessionReportRowsFromSessions({
  sessions: fixtures,
  filters: { mode: 'supplier', status: 'active', page: 99, limit: 1 },
})
const supplierCsv = buildSalesSessionReportCsv({ mode: 'supplier', rows: supplierRows })
assert.equal(supplierCsv.includes('YUG'), true)
assert.equal(supplierCsv.includes('UTSAV'), true)
assert.equal(supplierCsv.includes('VENZORA'), false)

const categoryRows = buildSalesSessionReportRowsFromSessions({
  sessions: fixtures,
  filters: { mode: 'category', status: 'active', page: 50, limit: 1 },
})
const categoryCsv = buildSalesSessionReportCsv({ mode: 'category', rows: categoryRows })
assert.equal(categoryCsv.includes('YUG - Orange'), true, 'category export should include supplier-category label')
assert.equal(categoryCsv.includes('UTSAV'), true, 'category export should fall back to supplier when category is missing')
assert.equal(categoryCsv.includes('Uncategorized'), false, 'category export should avoid Uncategorized when supplier exists')

const karatRows = buildSalesSessionReportRowsFromSessions({
  sessions: fixtures,
  filters: { mode: 'karat', status: 'active', page: 10, limit: 1 },
})
const karatCsv = buildSalesSessionReportCsv({ mode: 'karat', rows: karatRows })
assert.equal(karatCsv.includes('18K'), true)
assert.equal(karatCsv.includes('14K'), true)
assert.equal(karatCsv.includes('UTSAV - 1'), true)

const wastageRows = buildSalesSessionReportRowsFromSessions({
  sessions: fixtures,
  filters: { mode: 'wastage', status: 'active', page: 20, limit: 1 },
})
const wastageCsv = buildSalesSessionReportCsv({ mode: 'wastage', rows: wastageRows })
assert.equal(wastageCsv.includes('10.00%'), true)
assert.equal(wastageCsv.includes('12.50%'), true)
assert.equal(wastageCsv.includes('YUG - 1'), true)

assert.equal(buildSalesSessionReportCsvFileName('session', new Date('2026-07-02T00:00:00.000Z')), 'sales-session-report-session-2026-07-02.csv')
assert.equal(buildSalesSessionReportPdfFileName('session', new Date('2026-07-02T00:00:00.000Z')), 'sales-session-report-session-2026-07-02.pdf')
assert.equal(typeof listSalesSessionReportExportData, 'function', 'export data helper should exist for controller/export use')

for (const mode of ['session', 'supplier', 'category', 'karat', 'wastage']) {
  const rows = buildSalesSessionReportRowsFromSessions({
    sessions: fixtures,
    filters: { mode, status: 'active', page: 1, limit: 999 },
  })
  const buffer = await buildSalesSessionReportPdfBuffer({
    mode,
    rows,
    summary: summaryForFixtureRows,
    filters: { mode, status: 'active' },
  })
  assert.equal(Buffer.isBuffer(buffer), true, `${mode} pdf export should return a buffer`)
  assert.equal(buffer.length > 100, true, `${mode} pdf export should not be empty`)
}

console.log('check-sales-session-report-exports: ok')
