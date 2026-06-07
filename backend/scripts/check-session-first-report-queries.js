import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { captureSessionService } from '../src/services/captureSession.service.js'
import { batchService } from '../src/services/batch.service.js'
import {
  buildScopedSummary,
  getScopeRows,
  isBatchFinalForOfficialReporting,
  isSessionFinalForOfficialReporting,
  listSettlementRows,
  listSessionReportRows,
  listSupplierSectionReportRows,
  selectLatestFinalizedBatchRevision,
} from '../src/services/settlementReports.service.js'
import { createSale } from '../src/controllers/sales.controller.js'
import { getSettlementSummary, listSettlementReports } from '../src/controllers/settlementReports.controller.js'
import { QrIngestion } from '../src/models/QrIngestion.js'
import { Sale } from '../src/models/Sale.js'
import { ScanBatch } from '../src/models/ScanBatch.js'
import { Supplier } from '../src/models/Supplier.js'
import { User } from '../src/models/User.js'
import { CaptureSession } from '../src/models/CaptureSession.js'

const makeToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()

const callController = async (handler, { query = {}, body = {}, user = {} } = {}) => {
  let resolveResponse
  const responsePromise = new Promise((resolve) => {
    resolveResponse = resolve
  })
  const res = {
    status: (statusCode) => ({
      json: (payload) => resolveResponse({ statusCode, payload }),
      send: (payload) => resolveResponse({ statusCode, payload }),
    }),
    json: (payload) => resolveResponse({ statusCode: 200, payload }),
    send: (payload) => resolveResponse({ statusCode: 200, payload }),
  }
  const req = { query, body, user, headers: {} }
  await Promise.resolve(handler(req, res)).catch((error) => {
    throw error
  })
  return responsePromise
}

const createBatchSale = async ({
  batchId,
  supplierId,
  salesmanId,
  itemCode,
  grossWeight,
  stoneWeight,
  netWeight,
  notes = 'Session-first report smoke test sale',
}) => {
  const response = await new Promise((resolve, reject) => {
    const req = {
      body: {
        supplierId,
        batchId,
        category: 'TEST',
        itemCode,
        metalType: 'Gold',
        purity: '18K',
        notes,
        grossWeight,
        stoneWeight,
        netWeight,
        qrRaw: `${itemCode}/18K`,
        displaySnapshot: {
          supplier: { name: 'Smoke Supplier', code: 'SMK' },
          item: { itemCode, karat: '18K' },
          weights: {
            grossWeight,
            stoneWeight,
            qrNetWeight: netWeight,
            computedNetWeight: netWeight,
            selectedNetWeight: netWeight,
          },
          calculation: {
            settlementPercent: 100,
            fineWeight: netWeight,
          },
          warnings: [],
          requiresReview: false,
          rawQr: `${itemCode}/18K`,
        },
      },
      headers: {
        'x-idempotency-key': `report-scope-${itemCode}-${makeToken()}`,
      },
      user: {
        id: salesmanId.toString(),
        role: 'salesman',
      },
    }
    const res = {
      status: (statusCode) => ({
        json: (payload) => resolve({ statusCode, payload }),
        send: (payload) => resolve({ statusCode, payload }),
      }),
      json: (payload) => resolve({ statusCode: 200, payload }),
      send: (payload) => resolve({ statusCode: 200, payload }),
    }
    Promise.resolve(createSale(req, res)).catch(reject)
  })

  assert.equal(response.statusCode, 201)
  assert.equal(response.payload?.success, true)

  const saleId = response.payload?.data?._id || response.payload?.data?.sale?._id
  assert.ok(saleId, 'Sale id should be returned from createSale')

  const sale = await Sale.findById(saleId).lean()
  assert.ok(sale, 'Sale should be persisted by createSale')
  return sale
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
    legacy: [],
  }

  try {
    const supplierSession = await Supplier.create({
      name: `Session Report Supplier ${suffix}`,
      code: `SR-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    const supplierFinal = await Supplier.create({
      name: `Final Supplier ${suffix}`,
      code: `FS-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    const supplierSubmitted = await Supplier.create({
      name: `Submitted Supplier ${suffix}`,
      code: `SS-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    const supplierReopened = await Supplier.create({
      name: `Reopened Supplier ${suffix}`,
      code: `RS-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    createdIds.suppliers.push(supplierSession._id, supplierFinal._id, supplierSubmitted._id, supplierReopened._id)

    const salesman = await User.create({
      name: `Report Salesman ${suffix}`,
      email: `report-salesman-${suffix.toLowerCase()}@example.com`,
      phone: `9510${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}1`,
      role: 'salesman',
      isActive: true,
    })
    const admin = await User.create({
      name: `Report Admin ${suffix}`,
      email: `report-admin-${suffix.toLowerCase()}@example.com`,
      phone: `9520${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}2`,
      role: 'admin',
      isActive: true,
    })
    createdIds.users.push(salesman._id, admin._id)

    const adminActor = { id: admin._id.toString(), role: 'admin' }
    const salesmanActor = { id: salesman._id.toString(), role: 'salesman' }

    const session = await captureSessionService.createSession({
      assignedSalesmanId: salesman._id,
      customerName: 'Session report customer',
      customerPhone: '9876500000',
      referenceNote: 'Session report smoke test',
      createdBy: admin._id,
      actor: adminActor,
    })
    createdIds.sessions.push(session._id)

    const sessionBatchResult = await captureSessionService.createSupplierBatchInSession({
      sessionId: session._id,
      supplierId: supplierSession._id,
      customerName: 'Session report customer',
      customerPhone: '9876500000',
      referenceNote: 'Session batch',
      actor: adminActor,
    })
    createdIds.batches.push(sessionBatchResult.batch._id)

    const sessionSale1 = await createBatchSale({
      batchId: sessionBatchResult.batch._id,
      supplierId: supplierSession._id,
      salesmanId: salesman._id,
      itemCode: `SESSION-${suffix.slice(0, 4)}-A`,
      grossWeight: 2.5,
      stoneWeight: 0.1,
      netWeight: 2.4,
    })
    const sessionSale2 = await createBatchSale({
      batchId: sessionBatchResult.batch._id,
      supplierId: supplierSession._id,
      salesmanId: salesman._id,
      itemCode: `SESSION-${suffix.slice(0, 4)}-B`,
      grossWeight: 1.25,
      stoneWeight: 0.05,
      netWeight: 1.2,
    })
    createdIds.sales.push(sessionSale1._id, sessionSale2._id)

    const sessionBatchSubmitted = await batchService.submitBatch({
      id: sessionBatchResult.batch._id,
      actor: adminActor,
    })
    assert.equal(sessionBatchSubmitted.status, 'submitted')

    const sessionBatchFinalized = await batchService.finalizeBatch({
      id: sessionBatchResult.batch._id,
      actor: adminActor,
    })
    assert.equal(sessionBatchFinalized.status, 'finalized')

    const sessionSubmitted = await captureSessionService.submitSession({
      sessionId: session._id,
      actor: adminActor,
    })
    assert.equal(sessionSubmitted.status, 'submitted')

    const sessionFinalized = await captureSessionService.finalizeSession({
      sessionId: session._id,
      actor: adminActor,
    })
    assert.equal(sessionFinalized.status, 'finalized')

    const finalBatch = await batchService.createBatch({
      body: {
        supplierId: supplierFinal._id,
        assignedSalesmanId: salesman._id,
        customerName: 'Final report batch',
        customerPhone: '9000000001',
        referenceNote: 'Final supplier section',
      },
      actor: adminActor,
    })
    createdIds.batches.push(finalBatch._id)

    const finalSale = await createBatchSale({
      batchId: finalBatch._id,
      supplierId: supplierFinal._id,
      salesmanId: salesman._id,
      itemCode: `FINAL-${suffix.slice(0, 4)}-A`,
      grossWeight: 4.5,
      stoneWeight: 0.2,
      netWeight: 4.3,
    })
    const zeroValueSale = await createBatchSale({
      batchId: finalBatch._id,
      supplierId: supplierFinal._id,
      salesmanId: salesman._id,
      itemCode: `FINAL-${suffix.slice(0, 4)}-Z`,
      grossWeight: 0.8,
      stoneWeight: 0,
      netWeight: 0.8,
    })
    createdIds.sales.push(finalSale._id, zeroValueSale._id)

    await batchService.submitBatch({
      id: finalBatch._id,
      actor: adminActor,
    })
    const finalizedBatchResult = await batchService.finalizeBatch({
      id: finalBatch._id,
      actor: adminActor,
    })
    assert.equal(finalizedBatchResult.status, 'finalized')

    const submittedOnlyBatch = await batchService.createBatch({
      body: {
        supplierId: supplierSubmitted._id,
        assignedSalesmanId: salesman._id,
        customerName: 'Submitted only batch',
        customerPhone: '9000000002',
        referenceNote: 'Should not show in official supplier section report',
      },
      actor: adminActor,
    })
    createdIds.batches.push(submittedOnlyBatch._id)

    const submittedSale = await createBatchSale({
      batchId: submittedOnlyBatch._id,
      supplierId: supplierSubmitted._id,
      salesmanId: salesman._id,
      itemCode: `SUBMITTED-${suffix.slice(0, 4)}-A`,
      grossWeight: 3.1,
      stoneWeight: 0.08,
      netWeight: 3.02,
    })
    createdIds.sales.push(submittedSale._id)

    const submittedBatchResult = await batchService.submitBatch({
      id: submittedOnlyBatch._id,
      actor: adminActor,
    })
    assert.equal(submittedBatchResult.status, 'submitted')

    const reopenedBatch = await batchService.createBatch({
      body: {
        supplierId: supplierReopened._id,
        assignedSalesmanId: salesman._id,
        customerName: 'Reopened batch',
        customerPhone: '9000000003',
        referenceNote: 'Should not count in official reports',
      },
      actor: adminActor,
    })
    createdIds.batches.push(reopenedBatch._id)

    const reopenedSale = await createBatchSale({
      batchId: reopenedBatch._id,
      supplierId: supplierReopened._id,
      salesmanId: salesman._id,
      itemCode: `REOPEN-${suffix.slice(0, 4)}-A`,
      grossWeight: 1.75,
      stoneWeight: 0.03,
      netWeight: 1.72,
    })
    createdIds.sales.push(reopenedSale._id)

    await batchService.submitBatch({
      id: reopenedBatch._id,
      actor: adminActor,
    })
    const reopenedFinalized = await batchService.finalizeBatch({
      id: reopenedBatch._id,
      actor: adminActor,
    })
    assert.equal(reopenedFinalized.status, 'finalized')

    const reopenedAfter = await batchService.reopenBatch({
      id: reopenedBatch._id,
      body: { reason: 'Smoke test reopen' },
      actor: adminActor,
    })
    assert.equal(reopenedAfter.status, 'reopened')

    const reopenedDoc = await ScanBatch.findById(reopenedBatch._id).lean()
    assert.ok(reopenedDoc, 'Reopened batch should remain persisted')
    const latestFinalizedRevision = selectLatestFinalizedBatchRevision(reopenedDoc)
    assert.ok(latestFinalizedRevision, 'Reopened batch should still retain a finalized revision snapshot')
    assert.equal(isBatchFinalForOfficialReporting(reopenedDoc), false)

    const sessionDoc = await CaptureSession.findById(session._id).lean()
    const sessionChildBatches = await ScanBatch.find({ sessionId: session._id }).lean()
    assert.ok(sessionDoc, 'Session should still be persisted')
    assert.equal(isSessionFinalForOfficialReporting(sessionDoc, sessionChildBatches), true)

    const officialSessionRows = await listSessionReportRows({ search: session.sessionRef })
    assert.equal(officialSessionRows.scope, 'session')
    assert.equal(officialSessionRows.rows.length, 1)
    assert.equal(officialSessionRows.rows[0].sessionRef, session.sessionRef)
    const sessionReportSummary = buildScopedSummary('session', officialSessionRows.rows)
    assert.equal(sessionReportSummary.total_items, officialSessionRows.rows[0].itemCount)
    assert.ok(sessionReportSummary.total_gross_weight > 0)
    assert.ok(sessionReportSummary.total_net_weight > 0)
    assert.ok(sessionReportSummary.total_fine_weight >= 0)
    assert.ok(sessionReportSummary.total_stone_weight >= 0)
    assert.ok(sessionReportSummary.total_stone_amount >= 0)

    const sessionRowsViaScope = await getScopeRows('session', { search: session.sessionRef })
    assert.equal(sessionRowsViaScope.scope, 'session')
    assert.equal(sessionRowsViaScope.rows.length, 1)

    const sessionScopedSummary = buildScopedSummary('session', officialSessionRows.rows)
    assert.equal(sessionScopedSummary.total_items, officialSessionRows.rows[0].itemCount)
    assert.ok(sessionScopedSummary.total_gross_weight > 0)
    assert.ok(sessionScopedSummary.total_net_weight > 0)

    const supplierSectionRows = await listSupplierSectionReportRows({ supplier: supplierFinal.code })
    assert.equal(supplierSectionRows.scope, 'supplier-section')
    assert.equal(supplierSectionRows.rows.length, 1)
    assert.equal(supplierSectionRows.rows[0].supplier.code, supplierFinal.code)
    const supplierSectionReportSummary = buildScopedSummary('supplier-section', supplierSectionRows.rows)
    assert.equal(supplierSectionReportSummary.total_items, supplierSectionRows.rows[0].itemCount)
    assert.ok(supplierSectionReportSummary.total_gross_weight > 0)
    assert.ok(supplierSectionReportSummary.total_net_weight > 0)

    const supplierRowsViaScope = await getScopeRows('supplier-section', { supplier: supplierFinal.code })
    assert.equal(supplierRowsViaScope.scope, 'supplier-section')
    assert.equal(supplierRowsViaScope.rows.length, 1)

    const supplierSectionRowsBySession = await listSupplierSectionReportRows({ session: session.sessionRef })
    assert.equal(supplierSectionRowsBySession.rows.length, 1)

    const supplierSectionSummary = buildScopedSummary('supplier-section', supplierSectionRows.rows)
    assert.ok(supplierSectionSummary.total_fine_weight >= 0)

    const submittedScopeRows = await listSupplierSectionReportRows({ supplier: supplierSubmitted.code })
    assert.equal(submittedScopeRows.rows.length, 0)

    const reopenedScopeRows = await listSupplierSectionReportRows({ supplier: supplierReopened.code })
    assert.equal(reopenedScopeRows.rows.length, 0)

    const itemLedgerRows = await listSettlementRows({ search: sessionSale1.itemCode })
    assert.equal(itemLedgerRows.rows.length, 1)
    assert.equal(itemLedgerRows.rows[0].item_code, sessionSale1.itemCode)
    assert.equal(itemLedgerRows.rows[0].batchId, String(sessionBatchResult.batch._id))
    assert.equal(itemLedgerRows.rows[0].sessionRef, session.sessionRef)
    assert.equal(itemLedgerRows.rows[0].source_type, undefined)

    const zeroItemRows = await listSettlementRows({ search: zeroValueSale.itemCode })
    assert.equal(zeroItemRows.rows.length, 1)
    assert.equal(zeroItemRows.rows[0].stone_weight, 0)
    assert.equal(zeroItemRows.rows[0].gross_weight, 0.8)

    const sessionSearchRows = await listSessionReportRows({ search: session.customerName })
    assert.equal(sessionSearchRows.rows.length, 1)
    const sessionFilterRows = await listSessionReportRows({ customer: session.customerName })
    assert.equal(sessionFilterRows.rows.length, 1)

    const ledgerController = await callController(listSettlementReports, {
      query: { search: sessionSale1.itemCode },
      user: adminActor,
    })
    assert.equal(ledgerController.statusCode, 200)
    assert.equal(Array.isArray(ledgerController.payload?.data), true)

    const scopedController = await callController(listSettlementReports, {
      query: { scope: 'session', search: session.sessionRef },
      user: adminActor,
    })
    assert.equal(scopedController.statusCode, 200)
    assert.equal(scopedController.payload?.data?.scope, 'session')
    assert.equal(Array.isArray(scopedController.payload?.data?.rows), true)
    assert.equal(scopedController.payload?.data?.rows.length, 1)

    const supplierSummaryController = await callController(getSettlementSummary, {
      query: { scope: 'supplier-section', supplier: supplierFinal.code },
      user: adminActor,
    })
    assert.equal(supplierSummaryController.statusCode, 200)
    assert.equal(supplierSummaryController.payload?.data?.scope, 'supplier-section')
    assert.equal(supplierSummaryController.payload?.data?.total_items, supplierSectionRows.rows[0].itemCount)

    const legacyRecord = await QrIngestion.create({
      raw: `LEGACY-${suffix}`,
      raw_qr: `LEGACY-${suffix}`,
      parsed: {
        supplier: `Legacy Supplier ${suffix}`,
        itemCode: `LEGACY-${suffix}`,
      },
      final: {
        supplier: `Legacy Supplier ${suffix}`,
        design_code: `LEGACY-${suffix}`,
        gross_weight: 0.9,
        stone_weight: 0,
        net_weight: 0.9,
        purity_percent: 18,
        wastage_percent: 0,
        fine_weight: 0.9,
        stone_amount: 0,
        itemCode: `LEGACY-${suffix}`,
        category: 'Legacy',
      },
      validation: {
        input: {},
        status: 'approved',
        confidence: 100,
        warnings: [],
        evaluatedAt: new Date(),
      },
      status: 'approved',
      confidence: 100,
      warnings: [],
      approval_note: 'Legacy settlement fallback smoke test',
      approvedAt: new Date(),
      reviewedAt: new Date(),
    })
    createdIds.legacy.push(legacyRecord._id)

    const legacySuppressedRows = await listSettlementRows({ search: `LEGACY-${suffix}` })
    assert.equal(legacySuppressedRows.rows.length, 0)

    const originalSaleExists = Sale.exists.bind(Sale)
    Sale.exists = async () => false
    try {
      const legacyFallbackRows = await listSettlementRows({ search: `LEGACY-${suffix}` })
      assert.equal(legacyFallbackRows.rows.length, 1)
      assert.equal(legacyFallbackRows.rows[0].source_type, 'legacy_qr')

      const legacyLedgerController = await callController(listSettlementReports, {
        query: { search: `LEGACY-${suffix}` },
        user: adminActor,
      })
      assert.equal(legacyLedgerController.statusCode, 200)
      assert.equal(Array.isArray(legacyLedgerController.payload?.data), true)
      assert.equal(legacyLedgerController.payload?.data.length, 1)
      assert.equal(legacyLedgerController.payload?.data[0].source_type, 'legacy_qr')
    } finally {
      Sale.exists = originalSaleExists
    }

    console.log('Session-first report query checks passed (23/23)')
  } finally {
    await Promise.allSettled([
      Sale.deleteMany({ _id: { $in: createdIds.sales } }),
      QrIngestion.deleteMany({ _id: { $in: createdIds.legacy } }),
      ScanBatch.deleteMany({ _id: { $in: createdIds.batches } }),
      CaptureSession.deleteMany({ _id: { $in: createdIds.sessions } }),
      Supplier.deleteMany({ _id: { $in: createdIds.suppliers } }),
      User.deleteMany({ _id: { $in: createdIds.users } }),
    ])

    await mongoose.disconnect()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
