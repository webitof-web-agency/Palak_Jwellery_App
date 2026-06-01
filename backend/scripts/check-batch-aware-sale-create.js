import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { createSale } from '../src/controllers/sales.controller.js'
import { Sale } from '../src/models/Sale.js'
import { ScanBatch } from '../src/models/ScanBatch.js'
import { Supplier } from '../src/models/Supplier.js'
import { User } from '../src/models/User.js'
import { batchService, refreshBatchAggregates } from '../src/services/batch.service.js'

const makeToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()

const almostEqual = (actual, expected, tolerance = 0.0001) => {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `${actual} !== ${expected}`
  )
}

const makeRes = () => {
  const result = {
    statusCode: 200,
    body: null,
  }

  return {
    status(code) {
      result.statusCode = code
      return this
    },
    json(payload) {
      result.body = payload
      return payload
    },
    get result() {
      return result
    },
  }
}

const invokeCreateSale = async ({ body, user, headers = {} }) => {
  const res = makeRes()
  await createSale(
    {
      body,
      user,
      headers,
    },
    res
  )
  return res.result
}

const makeSaleBody = ({
  supplierId,
  itemCode,
  qrRaw,
  grossWeight,
  stoneWeight,
  netWeight,
  batchId,
  purity = '18K',
  category = 'TEST',
  metalType = 'Gold',
  notes = 'Batch-aware sale test',
  overrideDuplicate = false,
  wasManuallyEdited = false,
}) => ({
  supplierId: supplierId.toString(),
  category,
  itemCode,
  metalType,
  purity,
  notes,
  grossWeight,
  stoneWeight,
  netWeight,
  qrRaw,
  overrideDuplicate,
  wasManuallyEdited,
  ...(batchId ? { batchId: batchId.toString() } : {}),
})

const run = async () => {
  await connectDB()

  const suffix = makeToken()
  const createdIds = {
    sales: [],
    batches: [],
    suppliers: [],
    users: [],
  }

  try {
    const supplier1 = await Supplier.create({
      name: `Batch Supplier A ${suffix}`,
      code: `BATCHA-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    const supplier2 = await Supplier.create({
      name: `Batch Supplier B ${suffix}`,
      code: `BATCHB-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    createdIds.suppliers.push(supplier1._id, supplier2._id)

    const salesman1 = await User.create({
      name: `Batch Salesman 1 ${suffix}`,
      email: `batch-salesman-1-${suffix.toLowerCase()}@example.com`,
      phone: `9100${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}1`,
      role: 'salesman',
      isActive: true,
    })
    const salesman2 = await User.create({
      name: `Batch Salesman 2 ${suffix}`,
      email: `batch-salesman-2-${suffix.toLowerCase()}@example.com`,
      phone: `9200${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}2`,
      role: 'salesman',
      isActive: true,
    })
    const admin = await User.create({
      name: `Batch Admin ${suffix}`,
      email: `batch-admin-${suffix.toLowerCase()}@example.com`,
      phone: `9300${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}3`,
      role: 'admin',
      isActive: true,
    })
    createdIds.users.push(salesman1._id, salesman2._id, admin._id)

    const salesmanActor1 = { id: salesman1._id.toString(), role: 'salesman' }
    const salesmanActor2 = { id: salesman2._id.toString(), role: 'salesman' }
    const adminActor = { id: admin._id.toString(), role: 'admin' }

    // 1. Standalone old-style Sale create still works without batchId.
    const standaloneResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `STAND-${suffix.slice(0, 4)}`,
        qrRaw: `STAND-${suffix}/QR`,
        grossWeight: 3.25,
        stoneWeight: 0.15,
        netWeight: 3.1,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `standalone-${suffix}`,
      },
    })
    assert.equal(standaloneResult.statusCode, 201)
    assert.equal(standaloneResult.body.success, true)
    assert.equal(standaloneResult.body.data.batch, undefined)
    assert.equal(standaloneResult.body.data.batchSyncWarning, undefined)
    createdIds.sales.push(standaloneResult.body.data._id)

    const standaloneSale = await Sale.findById(standaloneResult.body.data._id).lean()
    assert.ok(standaloneSale)
    assert.equal(standaloneSale.batchId, null)

    // 2. Create an open batch assigned to the first salesman.
    const batchDetail = await batchService.createBatch({
      body: {
        supplierId: supplier1._id,
        customerName: 'Batch Customer',
        customerPhone: '9876543210',
        referenceNote: 'Batch-aware sale create smoke test',
      },
      actor: salesmanActor1,
    })
    createdIds.batches.push(batchDetail._id)

    assert.equal(batchDetail.status, 'open')
    assert.equal(batchDetail.itemCount, 0)
    assert.equal(batchDetail.totals.grossWeight, 0)
    assert.equal(batchDetail.totals.stoneWeight, 0)
    assert.equal(batchDetail.totals.netWeight, 0)

    const emptyRefresh = await refreshBatchAggregates(batchDetail._id)
    assert.equal(emptyRefresh.summary.itemCount, 0)
    assert.equal(emptyRefresh.summary.totals.grossWeight, 0)
    assert.equal(emptyRefresh.summary.totals.stoneWeight, 0)
    assert.equal(emptyRefresh.summary.totals.netWeight, 0)

    // 3. Salesman creates Sale inside own assigned open batch.
    const batchSale1Result = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `BATCH-${suffix.slice(0, 4)}-1`,
        qrRaw: `BATCH-${suffix}/QR-1`,
        grossWeight: 4.2,
        stoneWeight: 0.2,
        netWeight: 4.0,
        batchId: batchDetail._id,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `batch-sale-1-${suffix}`,
      },
    })

    assert.equal(batchSale1Result.statusCode, 201)
    assert.equal(batchSale1Result.body.success, true)
    assert.equal(batchSale1Result.body.data.batchSyncWarning, false)
    assert.equal(batchSale1Result.body.data.batch.batchRef, batchDetail.batchRef)
    assert.equal(batchSale1Result.body.data.batch.status, 'open')
    assert.equal(batchSale1Result.body.data.batch.revision, 1)
    assert.equal(batchSale1Result.body.data.batch.itemCount, 1)
    almostEqual(batchSale1Result.body.data.batch.totals.grossWeight, 4.2)
    almostEqual(batchSale1Result.body.data.batch.totals.stoneWeight, 0.2)
    almostEqual(batchSale1Result.body.data.batch.totals.netWeight, 4.0)
    createdIds.sales.push(batchSale1Result.body.data._id)

    const storedBatchSale1 = await Sale.findById(batchSale1Result.body.data._id).lean()
    assert.ok(storedBatchSale1)
    assert.equal(storedBatchSale1.batchId.toString(), batchDetail._id.toString())
    assert.equal(Number(storedBatchSale1.revisionAdded), 1)
    assert.equal(storedBatchSale1.addedBy.toString(), salesman1._id.toString())
    assert.ok(storedBatchSale1.addedAt)
    assert.equal(storedBatchSale1.entryMode, 'qr_scan')

    // 4. Second item updates totals correctly.
    const batchSale2Result = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `BATCH-${suffix.slice(0, 4)}-2`,
        qrRaw: null,
        grossWeight: 2.0,
        stoneWeight: 0.1,
        netWeight: 1.9,
        batchId: batchDetail._id,
        purity: '18K',
        wasManuallyEdited: true,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `batch-sale-2-${suffix}`,
      },
    })

    assert.equal(batchSale2Result.statusCode, 201)
    assert.equal(batchSale2Result.body.success, true)
    assert.equal(batchSale2Result.body.data.batchSyncWarning, false)
    assert.equal(batchSale2Result.body.data.batch.itemCount, 2)
    almostEqual(batchSale2Result.body.data.batch.totals.grossWeight, 6.2)
    almostEqual(batchSale2Result.body.data.batch.totals.stoneWeight, 0.3)
    almostEqual(batchSale2Result.body.data.batch.totals.netWeight, 5.9)
    createdIds.sales.push(batchSale2Result.body.data._id)

    const storedBatchSale2 = await Sale.findById(batchSale2Result.body.data._id).lean()
    assert.ok(storedBatchSale2)
    assert.equal(Number(storedBatchSale2.revisionAdded), 1)
    assert.equal(storedBatchSale2.entryMode, 'manual')

    // 5. Batch detail reflects created Sale items.
    const batchDetailAfterAdd = await batchService.getBatchDetail({
      id: batchDetail._id,
      actor: salesmanActor1,
    })
    assert.equal(batchDetailAfterAdd.itemCount, 2)
    assert.equal(batchDetailAfterAdd.items.length, 2)
    assert.equal(batchDetailAfterAdd.items.some((sale) => sale._id.toString() === batchSale1Result.body.data._id.toString()), true)
    assert.equal(batchDetailAfterAdd.items.some((sale) => sale._id.toString() === batchSale2Result.body.data._id.toString()), true)

    const helperRefresh = await refreshBatchAggregates(batchDetail._id)
    assert.equal(helperRefresh.summary.itemCount, 2)
    almostEqual(helperRefresh.summary.totals.grossWeight, 6.2)
    almostEqual(helperRefresh.summary.totals.stoneWeight, 0.3)
    almostEqual(helperRefresh.summary.totals.netWeight, 5.9)

    // 6. Supplier mismatch is rejected.
    const mismatchResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier2._id,
        itemCode: `MISMATCH-${suffix.slice(0, 4)}`,
        qrRaw: `MISMATCH-${suffix}/QR`,
        grossWeight: 1.2,
        stoneWeight: 0,
        netWeight: 1.2,
        batchId: batchDetail._id,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `batch-mismatch-${suffix}`,
      },
    })
    assert.equal(mismatchResult.statusCode, 400)
    assert.equal(mismatchResult.body.code, 'SUPPLIER_MISMATCH')

    // 7. Salesman cannot add Sale into another salesman’s batch.
    const forbiddenResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `FORBIDDEN-${suffix.slice(0, 4)}`,
        qrRaw: `FORBIDDEN-${suffix}/QR`,
        grossWeight: 1.1,
        stoneWeight: 0,
        netWeight: 1.1,
        batchId: batchDetail._id,
      }),
      user: salesmanActor2,
      headers: {
        'x-idempotency-key': `batch-forbidden-${suffix}`,
      },
    })
    assert.equal(forbiddenResult.statusCode, 403)
    assert.equal(forbiddenResult.body.code, 'FORBIDDEN')

    // 8. Sale cannot be added to submitted batch.
    const submittedBatch = await batchService.submitBatch({
      id: batchDetail._id,
      actor: salesmanActor1,
    })
    assert.equal(submittedBatch.status, 'submitted')

    const submittedResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `SUBMITTED-${suffix.slice(0, 4)}`,
        qrRaw: `SUBMITTED-${suffix}/QR`,
        grossWeight: 1.3,
        stoneWeight: 0,
        netWeight: 1.3,
        batchId: batchDetail._id,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `batch-submitted-${suffix}`,
      },
    })
    assert.equal(submittedResult.statusCode, 409)
    assert.equal(submittedResult.body.code, 'BATCH_LOCKED')

    // 9. Sale cannot be added to finalized batch.
    const finalizedBatch = await batchService.finalizeBatch({
      id: batchDetail._id,
      actor: adminActor,
    })
    assert.equal(finalizedBatch.status, 'finalized')

    const finalizedResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `FINALIZED-${suffix.slice(0, 4)}`,
        qrRaw: `FINALIZED-${suffix}/QR`,
        grossWeight: 1.4,
        stoneWeight: 0,
        netWeight: 1.4,
        batchId: batchDetail._id,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `batch-finalized-${suffix}`,
      },
    })
    assert.equal(finalizedResult.statusCode, 409)
    assert.equal(finalizedResult.body.code, 'BATCH_LOCKED')

    // 10. Sale can be added to reopened batch.
    const reopenedBatch = await batchService.reopenBatch({
      id: batchDetail._id,
      body: { reason: 'Need one more item' },
      actor: adminActor,
    })
    assert.equal(reopenedBatch.status, 'reopened')
    assert.equal(reopenedBatch.revision, 2)

    const reopenedSaleResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `REOPENED-${suffix.slice(0, 4)}`,
        qrRaw: null,
        grossWeight: 0.75,
        stoneWeight: 0,
        netWeight: 0.75,
        batchId: batchDetail._id,
        wasManuallyEdited: true,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `batch-reopened-${suffix}`,
      },
    })
    assert.equal(reopenedSaleResult.statusCode, 201)
    assert.equal(reopenedSaleResult.body.success, true)
    assert.equal(reopenedSaleResult.body.data.batchSyncWarning, false)
    assert.equal(reopenedSaleResult.body.data.batch.revision, 2)
    assert.equal(reopenedSaleResult.body.data.batch.itemCount, 3)
    createdIds.sales.push(reopenedSaleResult.body.data._id)

    const storedReopenedSale = await Sale.findById(reopenedSaleResult.body.data._id).lean()
    assert.ok(storedReopenedSale)
    assert.equal(Number(storedReopenedSale.revisionAdded), 2)
    assert.equal(storedReopenedSale.entryMode, 'manual')

    // 11. Duplicate QR behavior remains unchanged.
    const duplicateQr = `DUP-${suffix}/QR`
    const dupFirstResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `DUP-${suffix.slice(0, 4)}-1`,
        qrRaw: duplicateQr,
        grossWeight: 1.5,
        stoneWeight: 0,
        netWeight: 1.5,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `dup-standalone-${suffix}`,
      },
    })
    assert.equal(dupFirstResult.statusCode, 201)
    createdIds.sales.push(dupFirstResult.body.data._id)

    const dupSecondResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `DUP-${suffix.slice(0, 4)}-2`,
        qrRaw: duplicateQr,
        grossWeight: 1.5,
        stoneWeight: 0,
        netWeight: 1.5,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `dup-standalone-2-${suffix}`,
      },
    })
    assert.equal(dupSecondResult.statusCode, 409)
    assert.equal(dupSecondResult.body.code, 'DUPLICATE_QR')

    // 12. Duplicate QR override behavior remains unchanged.
    const dupOverrideResult = await invokeCreateSale({
      body: makeSaleBody({
        supplierId: supplier1._id,
        itemCode: `DUP-${suffix.slice(0, 4)}-3`,
        qrRaw: duplicateQr,
        grossWeight: 1.5,
        stoneWeight: 0,
        netWeight: 1.5,
        overrideDuplicate: true,
      }),
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': `dup-standalone-override-${suffix}`,
      },
    })
    assert.equal(dupOverrideResult.statusCode, 201)
    assert.equal(dupOverrideResult.body.data.isDuplicate, true)
    createdIds.sales.push(dupOverrideResult.body.data._id)

    // 13. Idempotency retry does not create duplicate Sale.
    const idempotentKey = `batch-idempotent-${suffix}`
    const idempotentPayload = makeSaleBody({
      supplierId: supplier1._id,
      itemCode: `IDEMP-${suffix.slice(0, 4)}`,
      qrRaw: `IDEMP-${suffix}/QR`,
      grossWeight: 2.5,
      stoneWeight: 0,
      netWeight: 2.5,
      batchId: batchDetail._id,
    })

    const idempotentFirst = await invokeCreateSale({
      body: idempotentPayload,
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': idempotentKey,
      },
    })
    assert.equal(idempotentFirst.statusCode, 201)
    assert.equal(idempotentFirst.body.success, true)
    createdIds.sales.push(idempotentFirst.body.data._id)

    const batchAfterIdempotentFirst = await batchService.getBatchDetail({
      id: batchDetail._id,
      actor: salesmanActor1,
    })
    const itemCountAfterFirst = batchAfterIdempotentFirst.itemCount

    const idempotentSecond = await invokeCreateSale({
      body: idempotentPayload,
      user: salesmanActor1,
      headers: {
        'x-idempotency-key': idempotentKey,
      },
    })
    assert.equal(idempotentSecond.statusCode, 201)
    assert.equal(idempotentSecond.body.data._id.toString(), idempotentFirst.body.data._id.toString())
    assert.equal(idempotentSecond.body.data.batchSyncWarning, false)
    assert.equal(idempotentSecond.body.data.batch.itemCount, idempotentFirst.body.data.batch.itemCount)

    const batchAfterIdempotentSecond = await batchService.getBatchDetail({
      id: batchDetail._id,
      actor: salesmanActor1,
    })
    assert.equal(batchAfterIdempotentSecond.itemCount, itemCountAfterFirst)

    // 14. Existing unbatched Sale remains valid.
    const standaloneAfter = await Sale.findById(standaloneResult.body.data._id).lean()
    assert.ok(standaloneAfter)
    assert.equal(standaloneAfter.batchId, null)

    // 15. Aggregate refresh helper can rebuild totals from linked Sales.
    const rebuildResult = await refreshBatchAggregates(batchDetail._id)
    assert.equal(rebuildResult.summary.itemCount, batchAfterIdempotentSecond.itemCount)
    almostEqual(rebuildResult.summary.totals.grossWeight, batchAfterIdempotentSecond.totals.grossWeight)
    almostEqual(rebuildResult.summary.totals.stoneWeight, batchAfterIdempotentSecond.totals.stoneWeight)
    almostEqual(rebuildResult.summary.totals.netWeight, batchAfterIdempotentSecond.totals.netWeight)

    // 16. Zero weights remain valid where business rules allow.
    const emptyBatch = await batchService.createBatch({
      body: {
        supplierId: supplier1._id,
        customerName: 'Zero Weight Check',
        customerPhone: '',
        referenceNote: 'Zero totals should stay valid',
      },
      actor: salesmanActor1,
    })
    createdIds.batches.push(emptyBatch._id)

    const zeroRefresh = await refreshBatchAggregates(emptyBatch._id)
    assert.equal(zeroRefresh.summary.itemCount, 0)
    assert.equal(zeroRefresh.summary.totals.grossWeight, 0)
    assert.equal(zeroRefresh.summary.totals.stoneWeight, 0)
    assert.equal(zeroRefresh.summary.totals.otherWeight, 0)
    assert.equal(zeroRefresh.summary.totals.netWeight, 0)
    assert.equal(zeroRefresh.summary.totals.fineWeight, 0)
    assert.equal(zeroRefresh.summary.totals.stoneAmount, 0)

    // 17. Batch list/detail reflects created Sale item.
    const batchList = await batchService.listBatches({
      actor: salesmanActor1,
      q: batchDetail.batchRef,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })
    assert.ok(batchList.batches.length >= 1)
    const finalBatchDetail = await batchService.getBatchDetail({
      id: batchDetail._id,
      actor: salesmanActor1,
    })
    const listedBatch = batchList.batches.find((entry) => entry._id.toString() === batchDetail._id.toString())
    assert.ok(listedBatch)
    assert.equal(listedBatch.itemCount, finalBatchDetail.itemCount)
    assert.equal(finalBatchDetail.items.some((sale) => sale._id.toString() === idempotentFirst.body.data._id.toString()), true)
    assert.equal(finalBatchDetail.currentRevision.revision, 2)

    console.log('Batch-aware sale create checks passed (18/18)')
  } finally {
    if (createdIds.sales.length > 0) {
      await Sale.deleteMany({ _id: { $in: createdIds.sales } })
    }
    if (createdIds.batches.length > 0) {
      await ScanBatch.deleteMany({ _id: { $in: createdIds.batches } })
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
  console.error('Batch-aware sale create checks failed:', error)
  process.exitCode = 1
})
