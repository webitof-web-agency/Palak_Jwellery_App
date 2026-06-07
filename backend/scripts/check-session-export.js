import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import reportsRouter from '../src/routes/reports.routes.js'
import { Sale } from '../src/models/Sale.js'
import { CaptureSession } from '../src/models/CaptureSession.js'
import { ScanBatch } from '../src/models/ScanBatch.js'
import { Supplier } from '../src/models/Supplier.js'
import { User } from '../src/models/User.js'
import { batchService } from '../src/services/batch.service.js'
import { captureSessionService } from '../src/services/captureSession.service.js'
import {
  SettlementScopedExportError,
  buildSessionExportData,
  buildSessionExportFileName,
  renderSessionCsv,
  renderSessionPdf,
} from '../src/services/settlementScopedExports.service.js'
import { exportSessionCsv, exportSessionPdf } from '../src/controllers/settlementReports.controller.js'

const makeToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()

const createSaleDoc = async ({
  supplierId,
  salesmanId,
  itemCode,
  grossWeight,
  stoneWeight,
  otherWeight = 0,
  netWeight,
}) => {
  return Sale.create({
    idempotencyKey: `session-export-${itemCode}-${makeToken()}`,
    salesman: salesmanId,
    supplier: supplierId,
    category: 'TEST',
    itemCode,
    metalType: 'Gold',
    purity: '18K',
    notes: 'Session export smoke test',
    qrRaw: `${itemCode}/18K`,
    grossWeight,
    stoneWeight,
    otherWeight,
    netWeight,
    ratePerGram: 0,
    totalValue: 0,
    isDuplicate: false,
    wasManuallyEdited: false,
    entryMode: 'qr_scan',
    settlementInputs: {
      purityPercent: 75,
      originalPurityPercent: 75,
      puritySource: 'supplier_override',
      purityOverridden: false,
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
      requiresReview: false,
      warnings: [],
      netFormula: `${grossWeight} - ${stoneWeight} - ${otherWeight} = ${netWeight}`,
      fineFormula: `${netWeight} * 85% = ${netWeight}`,
      explanation: 'Session export smoke test',
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
        warnings: [],
        requiresReview: false,
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
    sessions: [],
    batches: [],
    sales: [],
    suppliers: [],
    users: [],
  }

  try {
    const supplier1 = await Supplier.create({
      name: `Session Export Supplier 1 ${suffix}`,
      code: `SES-1-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    const supplier2 = await Supplier.create({
      name: `Session Export Supplier 2 ${suffix}`,
      code: `SES-2-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    createdIds.suppliers.push(supplier1._id, supplier2._id)

    const salesman = await User.create({
      name: `Session Export Salesman ${suffix}`,
      email: `session-export-salesman-${suffix.toLowerCase()}@example.com`,
      phone: `9710${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}1`,
      role: 'salesman',
      isActive: true,
    })
    const admin = await User.create({
      name: `Session Export Admin ${suffix}`,
      email: `session-export-admin-${suffix.toLowerCase()}@example.com`,
      phone: `9720${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}2`,
      role: 'admin',
      isActive: true,
    })
    createdIds.users.push(salesman._id, admin._id)

    const adminActor = { id: admin._id.toString(), role: 'admin' }
    const salesmanActor = { id: salesman._id.toString(), role: 'salesman' }

    const session = await captureSessionService.createSession({
      assignedSalesmanId: salesman._id,
      customerName: 'Session export customer',
      customerPhone: '9888800000',
      referenceNote: 'Session export smoke test',
      createdBy: admin._id,
      actor: adminActor,
    })
    createdIds.sessions.push(session._id)

    const batch1Result = await captureSessionService.createSupplierBatchInSession({
      sessionId: session._id,
      supplierId: supplier1._id,
      customerName: 'Session export customer',
      customerPhone: '9888800000',
      referenceNote: 'Session export batch one',
      actor: adminActor,
    })
    const batch2Result = await captureSessionService.createSupplierBatchInSession({
      sessionId: session._id,
      supplierId: supplier2._id,
      customerName: 'Session export customer',
      customerPhone: '9888800000',
      referenceNote: 'Session export batch two',
      actor: adminActor,
    })
    createdIds.batches.push(batch1Result.batch._id, batch2Result.batch._id)

    const sale1 = await createSaleDoc({
      supplierId: supplier1._id,
      salesmanId: salesman._id,
      itemCode: `SES-${suffix.slice(0, 4)}-A`,
      grossWeight: 2.75,
      stoneWeight: 0.15,
      netWeight: 2.6,
    })
    const sale2 = await createSaleDoc({
      supplierId: supplier2._id,
      salesmanId: salesman._id,
      itemCode: `SES-${suffix.slice(0, 4)}-B`,
      grossWeight: 1.2,
      stoneWeight: 0,
      netWeight: 1.2,
    })
    createdIds.sales.push(sale1._id, sale2._id)

    const addBatch1 = await batchService.addBatchItems({
      id: batch1Result.batch._id,
      body: { saleIds: [sale1._id] },
      actor: salesmanActor,
    })
    const addBatch2 = await batchService.addBatchItems({
      id: batch2Result.batch._id,
      body: { saleIds: [sale2._id] },
      actor: salesmanActor,
    })
    assert.equal(addBatch1.currentRevision.revision, 1)
    assert.equal(addBatch2.currentRevision.revision, 1)

    await batchService.submitBatch({ id: batch1Result.batch._id, actor: adminActor })
    await batchService.finalizeBatch({ id: batch1Result.batch._id, actor: adminActor })
    await batchService.submitBatch({ id: batch2Result.batch._id, actor: adminActor })
    await batchService.finalizeBatch({ id: batch2Result.batch._id, actor: adminActor })

    const submittedSession = await captureSessionService.submitSession({
      sessionId: session._id,
      actor: adminActor,
    })
    assert.equal(submittedSession.status, 'submitted')

    const finalizedSession = await captureSessionService.finalizeSession({
      sessionId: session._id,
      actor: adminActor,
    })
    assert.equal(finalizedSession.status, 'finalized')

    const exportData = await buildSessionExportData(session._id)
    assert.equal(exportData.scope, 'session')
    assert.equal(exportData.sections.length, 2)
    assert.equal(exportData.rows.length, 2)
    assert.equal(exportData.summary.total_sections, 2)
    assert.equal(exportData.summary.total_items, 2)
    assert.equal(exportData.session.sessionRef, session.sessionRef)
    assert.equal(exportData.sessionSummary.sessionRef, session.sessionRef)
    assert.equal(exportData.rows[1].stone, 0)
    assert.equal(exportData.rows[1].stone_amount, 0)

    const csv = renderSessionCsv(exportData)
    const csvLines = csv.trim().split('\n')
    assert.equal(csvLines.length, 3)
    const csvHeader = csvLines[0].split(',')
    const headerIndex = Object.fromEntries(csvHeader.map((column, index) => [column, index]))
    assert.equal(
      csvLines[0],
      'session_ref,customer_reference,supplier,batch_ref,revision,sale_ref,item_code,design_code,category,metal,karat,purity,wastage,gross,stone,other,net,fine,stone_amount,duplicate_flag,review_flag,manual_override_flag'
    )
    const csvRow = csvLines[2].split(',')
    assert.equal(Number(csvRow[headerIndex.stone]), 0)
    assert.equal(Number(csvRow[headerIndex.stone_amount]), 0)

    const csvFileName = buildSessionExportFileName(exportData.session, 'csv')
    const pdfFileName = buildSessionExportFileName(exportData.session, 'pdf')
    assert.match(csvFileName, /^settlement-session-[a-z0-9-]+-[a-z0-9-]+\.csv$/i)
    assert.match(pdfFileName, /^settlement-session-[a-z0-9-]+-[a-z0-9-]+\.pdf$/i)

    const csvResponse = await callController(exportSessionCsv, {
      params: { sessionId: session._id.toString() },
      query: {},
      user: adminActor,
    })
    assert.equal(csvResponse.statusCode, 200)
    assert.equal(csvResponse.headers['Content-Type'], 'text/csv; charset=utf-8')
    assert.match(csvResponse.headers['Content-Disposition'], /attachment; filename="settlement-session-/)
    assert.equal(String(csvResponse.payload).startsWith('session_ref,'), true)

    const pdfResponse = await callController(exportSessionPdf, {
      params: { sessionId: session._id.toString() },
      query: {},
      user: adminActor,
    })
    assert.equal(pdfResponse.statusCode, 200)
    assert.equal(pdfResponse.headers['Content-Type'], 'application/pdf')
    assert.match(pdfResponse.headers['Content-Disposition'], /attachment; filename="settlement-session-/)
    assert.ok(Buffer.isBuffer(pdfResponse.payload) || pdfResponse.payload instanceof Uint8Array)

    await batchService.reopenBatch({
      id: batch1Result.batch._id,
      body: { reason: 'Session pending change smoke test' },
      actor: adminActor,
    })

    await assert.rejects(
      () => buildSessionExportData(session._id),
      (error) => error instanceof SettlementScopedExportError && error.code === 'SESSION_HAS_PENDING_CHANGES'
    )

    const controllerRejected = await callController(exportSessionCsv, {
      params: { sessionId: session._id.toString() },
      query: {},
      user: adminActor,
    })
    assert.equal(controllerRejected.statusCode, 409)
    assert.equal(controllerRejected.payload?.code, 'SESSION_HAS_PENDING_CHANGES')

    assertAdminOnlyRoute('/settlement/sessions/:sessionId/export.csv')
    assertAdminOnlyRoute('/settlement/sessions/:sessionId/export.pdf')

    console.log('Session export checks passed (14/14)')
  } finally {
    await Promise.allSettled([
      Sale.deleteMany({ _id: { $in: createdIds.sales } }),
      ScanBatch.deleteMany({ _id: { $in: createdIds.batches } }),
      CaptureSession.deleteMany({ _id: { $in: createdIds.sessions } }),
      Supplier.deleteMany({ _id: { $in: createdIds.suppliers } }),
      User.deleteMany({ _id: { $in: createdIds.users } }),
    ])
    await mongoose.disconnect()
  }
}

run().catch((error) => {
  console.error('Session export checks failed:')
  console.error(error)
  process.exitCode = 1
})
