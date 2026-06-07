import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { exportSupplierSectionCsv, exportSupplierSectionPdf } from '../src/controllers/settlementReports.controller.js'
import reportsRouter from '../src/routes/reports.routes.js'
import { Sale } from '../src/models/Sale.js'
import { ScanBatch } from '../src/models/ScanBatch.js'
import { Supplier } from '../src/models/Supplier.js'
import { User } from '../src/models/User.js'
import { batchService } from '../src/services/batch.service.js'
import {
  SettlementScopedExportError,
  buildSupplierSectionExportData,
  buildSupplierSectionExportFileName,
  renderSupplierSectionCsv,
  renderSupplierSectionPdf,
} from '../src/services/settlementScopedExports.service.js'

const makeToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()

const createSaleDoc = async ({
  supplierId,
  salesmanId,
  itemCode,
  grossWeight,
  stoneWeight,
  otherWeight = 0,
  netWeight,
  isDuplicate = false,
  wasManuallyEdited = false,
  requiresReview = false,
  warnings = [],
}) => {
  return Sale.create({
    idempotencyKey: `supplier-export-${itemCode}-${makeToken()}`,
    salesman: salesmanId,
    supplier: supplierId,
    category: 'TEST',
    itemCode,
    metalType: 'Gold',
    purity: '18K',
    notes: 'Supplier section export smoke test',
    qrRaw: `${itemCode}/18K`,
    grossWeight,
    stoneWeight,
    otherWeight,
    netWeight,
    ratePerGram: 0,
    totalValue: 0,
    isDuplicate,
    wasManuallyEdited,
    entryMode: 'qr_scan',
    settlementInputs: {
      purityPercent: 75,
      originalPurityPercent: 75,
      puritySource: 'supplier_override',
      purityOverridden: wasManuallyEdited,
      wastagePercent: 10,
      originalWastagePercent: 10,
      wastageSource: 'supplier_category',
      wastageOverridden: false,
      supplierId,
      supplierCode: null,
      resolvedAt: new Date(),
    },
    calculationSnapshot: {
      grossWeight,
      stoneWeight,
      otherWeight,
      qrNetWeight: netWeight,
      computedNetWeight: netWeight,
      selectedNetWeight: netWeight,
      fineWeight: netWeight,
      stoneAmount: 0,
      settlementPercent: 85,
      requiresReview,
      warnings,
      netFormula: `${grossWeight} - ${stoneWeight} - ${otherWeight} = ${netWeight}`,
      fineFormula: `${netWeight} * 85% = ${netWeight}`,
      explanation: 'Supplier export smoke test',
    },
    parsedSnapshot: {
      display: {
        supplier: { name: 'Smoke Supplier', code: 'SMK' },
        item: { itemCode, karat: '18K' },
        weights: {
          grossWeight,
          stoneWeight,
          otherWeight,
          qrNetWeight: netWeight,
          computedNetWeight: netWeight,
          selectedNetWeight: netWeight,
        },
        calculation: {
          settlementPercent: 85,
          fineWeight: netWeight,
        },
        warnings,
        requiresReview,
        rawQr: `${itemCode}/18K`,
      },
    },
    saleDate: new Date(),
    addedAt: new Date(),
  })
}

const callController = async (handler, { params = {}, query = {}, user = {} } = {}) => {
  const headers = {}
  let resolved
  const response = new Promise((resolve) => {
    resolved = resolve
  })

  const res = {
    setHeader: (key, value) => {
      headers[key] = value
    },
    status: (statusCode) => ({
      json: (payload) => resolved({ statusCode, payload, headers }),
      send: (payload) => resolved({ statusCode, payload, headers }),
    }),
    json: (payload) => resolved({ statusCode: 200, payload, headers }),
    send: (payload) => resolved({ statusCode: 200, payload, headers }),
  }
  const req = { params, query, user, headers: {} }
  await Promise.resolve(handler(req, res))
  return response
}

const extractRoute = (path) => {
  const layer = reportsRouter.stack.find((entry) => entry.route?.path === path)
  assert.ok(layer, `Route not found: ${path}`)
  return layer.route.stack
}

const assertAdminOnlyRoute = (path) => {
  const stack = extractRoute(path)
  assert.ok(stack.length >= 3, `Unexpected middleware stack for ${path}`)
  assert.equal(stack[0].name, 'authenticate')
  assert.equal(typeof stack[1].handle, 'function')
  assert.match(stack[1].handle.toString(), /FORBIDDEN|roles\.includes/)
}

const run = async () => {
  await connectDB()

  const suffix = makeToken()
  const createdIds = {
    batches: [],
    sales: [],
    suppliers: [],
    users: [],
  }

  try {
    const supplier = await Supplier.create({
      name: `Export Supplier ${suffix}`,
      code: `EXP-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    createdIds.suppliers.push(supplier._id)

    const salesman = await User.create({
      name: `Export Salesman ${suffix}`,
      email: `export-salesman-${suffix.toLowerCase()}@example.com`,
      phone: `9610${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}1`,
      role: 'salesman',
      isActive: true,
    })
    const admin = await User.create({
      name: `Export Admin ${suffix}`,
      email: `export-admin-${suffix.toLowerCase()}@example.com`,
      phone: `9620${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}2`,
      role: 'admin',
      isActive: true,
    })
    createdIds.users.push(salesman._id, admin._id)

    const adminActor = { id: admin._id.toString(), role: 'admin' }

    const batch = await batchService.createBatch({
      body: {
        supplierId: supplier._id,
        assignedSalesmanId: salesman._id,
        customerName: 'Supplier section export customer',
        customerPhone: '9777700000',
        referenceNote: 'Supplier export smoke test',
      },
      actor: adminActor,
    })
    createdIds.batches.push(batch._id)

    const sale1 = await createSaleDoc({
      supplierId: supplier._id,
      salesmanId: salesman._id,
      itemCode: `EXP-${suffix.slice(0, 4)}-A`,
      grossWeight: 3.25,
      stoneWeight: 0,
      netWeight: 3.25,
      isDuplicate: true,
      wasManuallyEdited: true,
      warnings: ['review watermark'],
      requiresReview: true,
    })
    createdIds.sales.push(sale1._id)

    const addResult = await batchService.addBatchItems({
      id: batch._id,
      body: { saleIds: [sale1._id] },
      actor: adminActor,
    })
    assert.equal(addResult.status, 'open')
    assert.equal(addResult.currentRevision.revision, 1)
    assert.equal(addResult.currentRevision.itemCount, 1)
    assert.ok(addResult.currentRevision.warningsCount >= 1)
    assert.equal(addResult.currentRevision.reviewCount, 1)
    assert.equal(addResult.currentRevision.duplicateCount, 1)
    assert.equal(addResult.currentRevision.manualOverrideCount, 1)

    await batchService.submitBatch({ id: batch._id, actor: adminActor })
    const finalizedBatch = await batchService.finalizeBatch({ id: batch._id, actor: adminActor })
    assert.equal(finalizedBatch.status, 'finalized')

    const exportData = await buildSupplierSectionExportData(batch._id)
    assert.equal(exportData.scope, 'supplier-section')
    assert.equal(exportData.revision.revision, 1)
    assert.equal(exportData.rows.length, 1)
    assert.equal(exportData.summary.total_items, 1)
    assert.equal(exportData.summary.supplier_count, 1)
    assert.ok(exportData.flags.warningsCount >= 1)
    assert.ok(exportData.flags.reviewCount >= 1)
    assert.equal(exportData.flags.duplicateCount, 1)
    assert.equal(exportData.flags.manualOverrideCount, 1)
    assert.equal(exportData.rows[0].stone, 0)
    assert.equal(exportData.rows[0].stone_amount, 0)
    assert.equal(exportData.sourceOfTruth, 'revision.saleIds')

    const historicalExport = await buildSupplierSectionExportData(batch._id, 1)
    assert.equal(historicalExport.scope, 'supplier-section')
    assert.equal(historicalExport.revision.revision, 1)
    assert.equal(historicalExport.rows.length, 1)
    assert.equal(historicalExport.summary.total_items, 1)

    const csv = renderSupplierSectionCsv(exportData)
    const csvLines = csv.trim().split('\n')
    assert.equal(csvLines.length, 2)
    const csvHeader = csvLines[0].split(',')
    const headerIndex = Object.fromEntries(csvHeader.map((column, index) => [column, index]))
    assert.equal(
      csvLines[0],
      'session_ref,session_customer,batch_ref,supplier,revision,finalized_at,sale_ref,item_code,design_code,category,metal,karat,purity,wastage,gross,stone,other,net,fine,stone_amount,duplicate_flag,review_flag,manual_override_flag'
    )
    const csvRow = csvLines[1].split(',')
    assert.equal(Number(csvRow[headerIndex.stone]), 0)
    assert.equal(Number(csvRow[headerIndex.stone_amount]), 0)

    const csvFileName = buildSupplierSectionExportFileName(exportData.batch, exportData.revision, 'csv')
    const pdfFileName = buildSupplierSectionExportFileName(exportData.batch, exportData.revision, 'pdf')
    assert.match(csvFileName, /^settlement-section-[a-z0-9-]+-rev1-[a-z0-9-]+\.csv$/i)
    assert.match(pdfFileName, /^settlement-section-[a-z0-9-]+-rev1-[a-z0-9-]+\.pdf$/i)

    const csvResponse = await callController(exportSupplierSectionCsv, {
      params: { batchId: batch._id.toString() },
      query: {},
      user: adminActor,
    })
    assert.equal(csvResponse.statusCode, 200)
    assert.equal(csvResponse.headers['Content-Type'], 'text/csv; charset=utf-8')
    assert.match(csvResponse.headers['Content-Disposition'], /attachment; filename="settlement-section-/)
    assert.equal(String(csvResponse.payload).startsWith('session_ref,'), true)

    const pdfResponse = await callController(exportSupplierSectionPdf, {
      params: { batchId: batch._id.toString() },
      query: {},
      user: adminActor,
    })
    assert.equal(pdfResponse.statusCode, 200)
    assert.equal(pdfResponse.headers['Content-Type'], 'application/pdf')
    assert.match(pdfResponse.headers['Content-Disposition'], /attachment; filename="settlement-section-/)
    assert.ok(Buffer.isBuffer(pdfResponse.payload) || pdfResponse.payload instanceof Uint8Array)

    await batchService.reopenBatch({
      id: batch._id,
      body: { reason: 'Historical revision smoke test' },
      actor: adminActor,
    })

    await assert.rejects(
      () => buildSupplierSectionExportData(batch._id),
      (error) => error instanceof SettlementScopedExportError && error.code === 'BATCH_NOT_FINALIZED'
    )

    assertAdminOnlyRoute('/settlement/supplier-sections/:batchId/export.csv')
    assertAdminOnlyRoute('/settlement/supplier-sections/:batchId/export.pdf')

    console.log('Supplier-section export checks passed (16/16)')
  } finally {
    await Promise.allSettled([
      Sale.deleteMany({ _id: { $in: createdIds.sales } }),
      ScanBatch.deleteMany({ _id: { $in: createdIds.batches } }),
      Supplier.deleteMany({ _id: { $in: createdIds.suppliers } }),
      User.deleteMany({ _id: { $in: createdIds.users } }),
    ])
    await mongoose.disconnect()
  }
}

run().catch((error) => {
  console.error('Supplier-section export checks failed:')
  console.error(error)
  process.exitCode = 1
})
