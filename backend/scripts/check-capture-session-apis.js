import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { captureSessionService } from '../src/services/captureSession.service.js'
import { batchService } from '../src/services/batch.service.js'
import { Sale } from '../src/models/Sale.js'
import { CaptureSession } from '../src/models/CaptureSession.js'
import { ScanBatch } from '../src/models/ScanBatch.js'
import { Supplier } from '../src/models/Supplier.js'
import { User } from '../src/models/User.js'
import { createSale } from '../src/controllers/sales.controller.js'

const makeToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()

const almostEqual = (actual, expected, tolerance = 0.0001) => {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `${actual} !== ${expected}`
  )
}

const createBatchSale = async ({
  batchId,
  supplierId,
  salesmanId,
  itemCode,
  grossWeight,
  stoneWeight,
  netWeight,
  isDuplicate = false,
  wasManuallyEdited = false,
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
        notes: 'Capture session smoke test sale',
        grossWeight,
        stoneWeight,
        netWeight,
        qrRaw: `${itemCode}/18K`,
        overrideDuplicate: isDuplicate,
        wasManuallyEdited,
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
        'x-idempotency-key': `session-api-${itemCode}-${makeToken()}`,
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
  }

  try {
    const supplier1 = await Supplier.create({
      name: `Session Supplier 1 ${suffix}`,
      code: `SESS-1-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    const supplier2 = await Supplier.create({
      name: `Session Supplier 2 ${suffix}`,
      code: `SESS-2-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    const supplier3 = await Supplier.create({
      name: `Session Supplier 3 ${suffix}`,
      code: `SESS-3-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    createdIds.suppliers.push(supplier1._id, supplier2._id, supplier3._id)

    const salesman1 = await User.create({
      name: `Session Salesman 1 ${suffix}`,
      email: `session-salesman-1-${suffix.toLowerCase()}@example.com`,
      phone: `9410${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}1`,
      role: 'salesman',
      isActive: true,
    })
    const salesman2 = await User.create({
      name: `Session Salesman 2 ${suffix}`,
      email: `session-salesman-2-${suffix.toLowerCase()}@example.com`,
      phone: `9420${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}2`,
      role: 'salesman',
      isActive: true,
    })
    const admin = await User.create({
      name: `Session Admin ${suffix}`,
      email: `session-admin-${suffix.toLowerCase()}@example.com`,
      phone: `9430${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}3`,
      role: 'admin',
      isActive: true,
    })
    createdIds.users.push(salesman1._id, salesman2._id, admin._id)

    const adminActor = { id: admin._id.toString(), role: 'admin' }
    const salesmanActor1 = { id: salesman1._id.toString(), role: 'salesman' }
    const salesmanActor2 = { id: salesman2._id.toString(), role: 'salesman' }

    // 1. Salesman-created sessions are always bound to the logged-in salesman.
    const salesmanCreatedSession = await captureSessionService.createSession({
      assignedSalesmanId: salesman1._id,
      customerName: 'Salesman owned session',
      customerPhone: '9888888888',
      referenceNote: 'Salesman self-assignment smoke test',
      createdBy: salesman2._id,
      actor: salesmanActor2,
    })
    createdIds.sessions.push(salesmanCreatedSession._id)
    assert.equal(salesmanCreatedSession.assignedSalesman?._id, salesman2._id.toString())

    // 2. Admin creates a capture session for salesman 1.
    const session = await captureSessionService.createSession({
      assignedSalesmanId: salesman1._id,
      customerName: 'Session Customer',
      customerPhone: '9876543210',
      referenceNote: 'Capture session API smoke test',
      createdBy: admin._id,
      actor: adminActor,
    })
    createdIds.sessions.push(session._id)

    assert.equal(session.status, 'draft')
    assert.equal(session.assignedSalesman?._id, salesman1._id.toString())

    // 3. Session listing and detail access work.
    const listResult = await captureSessionService.listSessions({
      actor: adminActor,
      q: session.sessionRef,
      limit: 10,
    })
    assert.ok(listResult.total >= 1)
    assert.equal(
      listResult.sessions.some((entry) => entry.sessionRef === session.sessionRef),
      true
    )

    const detailForSalesman1 = await captureSessionService.getSessionById(session._id, salesmanActor1)
    assert.equal(detailForSalesman1.sessionRef, session.sessionRef)
    assert.equal(detailForSalesman1.batches.length, 0)
    await assert.rejects(
      () => captureSessionService.getSessionById(session._id, salesmanActor2),
      (error) => error?.code === 'FORBIDDEN'
    )

    // 4. Create a supplier batch inside the session.
    const sessionBatchResult = await captureSessionService.createSupplierBatchInSession({
      sessionId: session._id,
      supplierId: supplier1._id,
      customerName: 'Session Customer',
      customerPhone: '9876543210',
      referenceNote: 'Session batch one',
      actor: adminActor,
    })
    createdIds.batches.push(sessionBatchResult.batch._id)

    assert.equal(sessionBatchResult.batch.batchRef.startsWith('SESS-1-'), true)
    assert.equal(sessionBatchResult.session.itemCount, 0)
    assert.equal(sessionBatchResult.session.supplierCount, 1)

    const storedSessionBatch = await ScanBatch.findById(sessionBatchResult.batch._id).lean()
    assert.ok(storedSessionBatch)
    assert.equal(storedSessionBatch.sessionId.toString(), session._id.toString())

    const sessionBatchSale = await createBatchSale({
      batchId: sessionBatchResult.batch._id,
      supplierId: supplier1._id,
      salesmanId: salesman1._id,
      itemCode: `SESSION-${suffix.slice(0, 4)}-1`,
      grossWeight: 2.5,
      stoneWeight: 0.1,
      netWeight: 2.4,
    })
    createdIds.sales.push(sessionBatchSale._id)

    const sessionAfterFirstSale = await captureSessionService.getSessionById(session._id, adminActor)
    assert.equal(sessionAfterFirstSale.itemCount, 1)
    assert.equal(sessionAfterFirstSale.status, 'open')

    // 5. Attach an existing compatible batch from another supplier.
    const standaloneBatch = await batchService.createBatch({
      body: {
        supplierId: supplier2._id,
        assignedSalesmanId: salesman1._id,
        customerName: 'Standalone attach batch',
        customerPhone: '9000000000',
        referenceNote: 'Attach into session',
      },
      actor: adminActor,
    })
    createdIds.batches.push(standaloneBatch._id)

    const attachResult = await captureSessionService.attachExistingBatchToSession({
      sessionId: session._id,
      batchId: standaloneBatch._id,
      actor: adminActor,
    })
    assert.equal(attachResult.session.supplierCount, 2)
    assert.equal(attachResult.sessionSyncWarning, false)

    const storedAttachedBatch = await ScanBatch.findById(standaloneBatch._id).lean()
    assert.ok(storedAttachedBatch)
    assert.equal(storedAttachedBatch.sessionId.toString(), session._id.toString())

    const attachedBatchSale = await createBatchSale({
      batchId: standaloneBatch._id,
      supplierId: supplier2._id,
      salesmanId: salesman1._id,
      itemCode: `SESSION-${suffix.slice(0, 4)}-2`,
      grossWeight: 3.5,
      stoneWeight: 0.2,
      netWeight: 3.3,
    })
    createdIds.sales.push(attachedBatchSale._id)

    const sessionAfterSecondSale = await captureSessionService.getSessionById(session._id, adminActor)
    assert.equal(sessionAfterSecondSale.itemCount, 2)
    assert.equal(sessionAfterSecondSale.supplierCount, 2)

    const mismatchedBatch = await batchService.createBatch({
      body: {
        supplierId: supplier3._id,
        assignedSalesmanId: salesman2._id,
        customerName: 'Assignment mismatch attach batch',
        customerPhone: '9000000002',
        referenceNote: 'Should fail by assignment',
      },
      actor: adminActor,
    })
    createdIds.batches.push(mismatchedBatch._id)

    await assert.rejects(
      () => captureSessionService.attachExistingBatchToSession({
        sessionId: session._id,
        batchId: mismatchedBatch._id,
        actor: adminActor,
      }),
      (error) => error?.code === 'ASSIGNMENT_MISMATCH'
    )

    const salesmanAttachBatch = await batchService.createBatch({
      body: {
        supplierId: supplier3._id,
        assignedSalesmanId: salesman1._id,
        customerName: 'Salesman attach batch',
        customerPhone: '9000000003',
        referenceNote: 'Should fail by permissions',
      },
      actor: adminActor,
    })
    createdIds.batches.push(salesmanAttachBatch._id)

    await assert.rejects(
      () => captureSessionService.attachExistingBatchToSession({
        sessionId: session._id,
        batchId: salesmanAttachBatch._id,
        actor: salesmanActor1,
      }),
      (error) => error?.code === 'FORBIDDEN'
    )

    // 6. Duplicate supplier in the same session is rejected.
    const duplicateSupplierBatch = await batchService.createBatch({
      body: {
        supplierId: supplier1._id,
        assignedSalesmanId: salesman1._id,
        customerName: 'Duplicate supplier attach batch',
        customerPhone: '9000000001',
        referenceNote: 'Should fail',
      },
      actor: adminActor,
    })
    createdIds.batches.push(duplicateSupplierBatch._id)

    await assert.rejects(
      () => captureSessionService.attachExistingBatchToSession({
        sessionId: session._id,
        batchId: duplicateSupplierBatch._id,
        actor: adminActor,
      }),
      (error) => error?.code === 'SESSION_SUPPLIER_EXISTS'
    )

    // 7. Refresh aggregates is explicit and returns the current summary.
    const refreshed = await captureSessionService.refreshSessionAggregates(session._id, adminActor)
    assert.equal(refreshed.summary.sessionRef, session.sessionRef)
    assert.equal(refreshed.summary.supplierCount, 2)
    assert.equal(refreshed.summary.status, 'open')

    // 8. Session submission is blocked until child batches are submitted/finalized.
    await assert.rejects(
      () => captureSessionService.submitSession({ sessionId: session._id, actor: salesmanActor1 }),
      (error) => error?.code === 'SESSION_ACTIVE_BATCHES'
    )

    // Move both batches to submitted so the session can submit.
    await batchService.submitBatch({ id: sessionBatchResult.batch._id, actor: salesmanActor1 })
    await batchService.submitBatch({ id: standaloneBatch._id, actor: salesmanActor1 })

    const sessionAfterBatchSubmit = await captureSessionService.getSessionById(session._id, adminActor)
    assert.equal(sessionAfterBatchSubmit.status, 'open')
    assert.equal(sessionAfterBatchSubmit.itemCount, 2)

    const submittedSession = await captureSessionService.submitSession({
      sessionId: session._id,
      actor: salesmanActor1,
    })
    assert.equal(submittedSession.status, 'submitted')

    // 9. Finalization requires all child batches finalized and admin access.
    await assert.rejects(
      () => captureSessionService.finalizeSession({ sessionId: session._id, actor: salesmanActor1 }),
      (error) => error?.code === 'FORBIDDEN'
    )

    await assert.rejects(
      () => captureSessionService.finalizeSession({ sessionId: session._id, actor: adminActor }),
      (error) => error?.code === 'SESSION_UNFINALIZED_BATCHES'
    )

    await batchService.finalizeBatch({ id: sessionBatchResult.batch._id, actor: adminActor })
    await batchService.finalizeBatch({ id: standaloneBatch._id, actor: adminActor })

    const finalizedSession = await captureSessionService.finalizeSession({
      sessionId: session._id,
      actor: adminActor,
    })
    assert.equal(finalizedSession.status, 'finalized')

    await batchService.reopenBatch({
      id: sessionBatchResult.batch._id,
      body: { reason: 'Session reopened for correction' },
      actor: adminActor,
    })
    const sessionAfterReopen = await captureSessionService.getSessionById(session._id, adminActor)
    assert.equal(sessionAfterReopen.status, 'open')

    // 10. Cancel works on a fresh draft/open session only and requires a reason.
    const cancellableSession = await captureSessionService.createSession({
      assignedSalesmanId: salesman2._id,
      customerName: 'Cancellable session',
      customerPhone: '9999999999',
      referenceNote: 'Cancel smoke test',
      createdBy: admin._id,
      actor: adminActor,
    })
    createdIds.sessions.push(cancellableSession._id)

    await assert.rejects(
      () => captureSessionService.cancelSession({
        sessionId: cancellableSession._id,
        actor: adminActor,
      }),
      (error) => error?.code === 'CANCEL_REASON_REQUIRED'
    )

    const cancelledSession = await captureSessionService.cancelSession({
      sessionId: cancellableSession._id,
      actor: adminActor,
      reason: 'No longer needed',
    })
    assert.equal(cancelledSession.status, 'cancelled')
    assert.equal(cancelledSession.referenceNote, 'Cancel smoke test')

    // 11. Distinct suppliers in one session remain valid.
    assert.equal(finalizedSession.supplierCount, 2)
    almostEqual(finalizedSession.totals.supplierCount, 2, 0.0001)

    console.log('Capture session API checks passed (11/11)')
  } finally {
    if (createdIds.batches.length > 0) {
      await ScanBatch.deleteMany({ _id: { $in: createdIds.batches } })
    }
    if (createdIds.sales.length > 0) {
      await Sale.deleteMany({ _id: { $in: createdIds.sales } })
    }
    if (createdIds.sessions.length > 0) {
      await CaptureSession.deleteMany({ _id: { $in: createdIds.sessions } })
    }
    if (createdIds.suppliers.length > 0) {
      await Supplier.deleteMany({ _id: { $in: createdIds.suppliers } })
    }
    if (createdIds.users.length > 0) {
      await User.deleteMany({ _id: { $in: createdIds.users } })
    }
    await mongoose.disconnect()
  }
}

run().catch((error) => {
  console.error('Capture session API checks failed')
  console.error(error)
  process.exitCode = 1
})
