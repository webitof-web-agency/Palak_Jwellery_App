import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { Sale } from '../src/models/Sale.js'
import { ScanBatch } from '../src/models/ScanBatch.js'
import { Supplier } from '../src/models/Supplier.js'
import { User } from '../src/models/User.js'
import { batchService } from '../src/services/batch.service.js'

const makeToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase()

const makeSale = async ({
  supplierId,
  salesmanId,
  grossWeight,
  stoneWeight,
  otherWeight,
  netWeight,
  fineWeight,
  stoneAmount,
  entryMode,
  isDuplicate = false,
  wasManuallyEdited = false,
  requiresReview = false,
  warnings = [],
  itemCode,
}) => {
  const idempotencyKey = `batch-api-${itemCode}-${makeToken()}`
  return Sale.create({
    idempotencyKey,
    salesman: salesmanId,
    supplier: supplierId,
    category: 'TEST',
    itemCode,
    metalType: 'Gold',
    purity: '18K',
    notes: 'Batch API test item',
    qrRaw: entryMode === 'manual' ? null : `${itemCode}/18K`,
    grossWeight,
    stoneWeight,
    netWeight,
    ratePerGram: 0,
    totalValue: 0,
    isDuplicate,
    wasManuallyEdited,
    entryMode,
    settlementInputs: {
      purityPercent: 75,
      originalPurityPercent: 75,
      puritySource: 'supplier_override',
      purityOverridden: wasManuallyEdited,
      wastagePercent: 9,
      originalWastagePercent: 9,
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
      fineWeight,
      stoneAmount,
      settlementPercent: 84,
      requiresReview,
      warnings,
      netFormula: `${grossWeight} - ${stoneWeight} = ${netWeight}`,
      fineFormula: `${netWeight} * 84% = ${fineWeight}`,
      explanation: 'Batch test item',
    },
    parsedSnapshot: {
      display: {
        supplier: { name: 'Test Supplier', code: 'TST' },
        item: { itemCode, karat: '18K' },
        weights: {
          grossWeight,
          stoneWeight,
          qrNetWeight: netWeight,
          computedNetWeight: netWeight,
          selectedNetWeight: netWeight,
        },
        calculation: {
          settlementPercent: 84,
          fineWeight,
        },
        warnings: [],
        requiresReview,
        rawQr: `${itemCode}/18K`,
      },
    },
  })
}

const assertAlmostEqual = (actual, expected, precision = 0.0001) => {
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= precision, `${actual} !== ${expected}`)
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
      name: `Batch Supplier ${suffix}`,
      code: `BATCH-${suffix.slice(0, 8)}`,
      gst: '',
      address: '',
      paymentMode: 'other',
      isActive: true,
    })
    createdIds.suppliers.push(supplier._id)

    const salesman1 = await User.create({
      name: `Batch Salesman 1 ${suffix}`,
      email: `batch-salesman-1-${suffix.toLowerCase()}@example.com`,
      phone: `9000${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}`,
      role: 'salesman',
      isActive: true,
    })
    createdIds.users.push(salesman1._id)

    const salesman2 = await User.create({
      name: `Batch Salesman 2 ${suffix}`,
      email: `batch-salesman-2-${suffix.toLowerCase()}@example.com`,
      phone: `9001${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}B`,
      role: 'salesman',
      isActive: true,
    })
    createdIds.users.push(salesman2._id)

    const admin = await User.create({
      name: `Batch Admin ${suffix}`,
      email: `batch-admin-${suffix.toLowerCase()}@example.com`,
      phone: `9002${String(Date.now()).slice(-6)}`,
      passwordHash: `Password@${suffix}C`,
      role: 'admin',
      isActive: true,
    })
    createdIds.users.push(admin._id)

    const adminActor = { id: admin._id.toString(), role: 'admin' }
    const salesmanActor1 = { id: salesman1._id.toString(), role: 'salesman' }
    const salesmanActor2 = { id: salesman2._id.toString(), role: 'salesman' }

    const sale1 = await makeSale({
      supplierId: supplier._id,
      salesmanId: salesman1._id,
      grossWeight: 3.25,
      stoneWeight: 0.15,
      otherWeight: 0,
      netWeight: 3.1,
      fineWeight: 2.15,
      stoneAmount: 12.5,
      entryMode: 'qr_scan',
      itemCode: `ITEM-${suffix.slice(0, 4)}-1`,
      warnings: ['warning: one'],
    })
    const sale2 = await makeSale({
      supplierId: supplier._id,
      salesmanId: salesman1._id,
      grossWeight: 2,
      stoneWeight: 0.2,
      otherWeight: 0,
      netWeight: 1.8,
      fineWeight: 1.1,
      stoneAmount: 0,
      entryMode: 'manual',
      itemCode: `ITEM-${suffix.slice(0, 4)}-2`,
      isDuplicate: true,
      wasManuallyEdited: true,
      requiresReview: true,
    })
    createdIds.sales.push(sale1._id, sale2._id)

    const createResult = await batchService.createBatch({
      body: {
        supplierId: supplier._id,
        customerName: 'Batch Audit Customer',
        customerPhone: '9876543210',
        referenceNote: 'API smoke test',
      },
      actor: salesmanActor1,
    })
    createdIds.batches.push(createResult._id)

    assert.equal(createResult.status, 'open')
    assert.equal(createResult.itemCount, 0)
    assert.equal(createResult.assignedSalesman?._id, salesman1._id.toString())
    assert.equal(createResult.supplier?._id, supplier._id.toString())

    const addResult = await batchService.addBatchItems({
      id: createResult._id,
      body: { saleIds: [sale1._id, sale2._id] },
      actor: salesmanActor1,
    })

    assert.equal(addResult.status, 'open')
    assert.equal(addResult.itemCount, 2)
    assert.equal(addResult.currentRevision.revision, 1)
    assert.equal(addResult.currentRevision.entryMode, 'mixed')
    assert.equal(addResult.warningsCount, 1)
    assert.equal(addResult.reviewCount, 1)
    assert.equal(addResult.duplicateCount, 1)
    assert.equal(addResult.manualOverrideCount, 1)
    assertAlmostEqual(addResult.totals.grossWeight, 5.25)
    assertAlmostEqual(addResult.totals.stoneWeight, 0.35)
    assertAlmostEqual(addResult.totals.netWeight, 4.9)
    assertAlmostEqual(addResult.totals.fineWeight, 3.25)
    assertAlmostEqual(addResult.totals.stoneAmount, 12.5)

    const storedAfterAdd = await Sale.find({ batchId: createResult._id }).lean()
    assert.equal(storedAfterAdd.length, 2)
    assert.equal(storedAfterAdd.every((sale) => Number(sale.revisionAdded) === 1), true)
    assert.equal(storedAfterAdd.every((sale) => sale.addedBy), true)

    const submitResult = await batchService.submitBatch({
      id: createResult._id,
      actor: salesmanActor1,
    })

    assert.equal(submitResult.status, 'submitted')
    assert.equal(submitResult.submittedBy?._id, salesman1._id.toString())

    const finalizeResult1 = await batchService.finalizeBatch({
      id: createResult._id,
      actor: adminActor,
    })

    assert.equal(finalizeResult1.status, 'finalized')
    assert.equal(finalizeResult1.revisionHistory.length, 1)
    assert.equal(finalizeResult1.revisionHistory[0].revision, 1)

    const reopenResult = await batchService.reopenBatch({
      id: createResult._id,
      body: { reason: 'Need one more pair' },
      actor: adminActor,
    })

    assert.equal(reopenResult.status, 'reopened')
    assert.equal(reopenResult.revision, 2)
    assert.equal(reopenResult.reopenReason, 'Need one more pair')

    const reassigned = await batchService.updateBatchAssignment({
      id: createResult._id,
      body: { assignedSalesmanId: salesman2._id },
      actor: adminActor,
    })

    assert.equal(reassigned.assignedSalesman?._id, salesman2._id.toString())
    assert.equal(reassigned.salesman?._id, salesman2._id.toString())

    await assert.rejects(
      batchService.addBatchItems({
        id: createResult._id,
        body: { saleIds: [new mongoose.Types.ObjectId()] },
        actor: salesmanActor1,
      }),
      (error) => error?.code === 'FORBIDDEN'
    )

    const sale3 = await makeSale({
      supplierId: supplier._id,
      salesmanId: salesman2._id,
      grossWeight: 1.5,
      stoneWeight: 0.1,
      otherWeight: 0,
      netWeight: 1.4,
      fineWeight: 0.8,
      stoneAmount: 0,
      entryMode: 'qr_scan',
      itemCode: `ITEM-${suffix.slice(0, 4)}-3`,
    })
    createdIds.sales.push(sale3._id)

    const addAfterReopen = await batchService.addBatchItems({
      id: createResult._id,
      body: { saleIds: [sale3._id] },
      actor: salesmanActor2,
    })

    assert.equal(addAfterReopen.status, 'reopened')
    assert.equal(addAfterReopen.itemCount, 3)
    assert.equal(addAfterReopen.currentRevision.revision, 2)
    assert.equal(addAfterReopen.currentRevision.entryMode, 'mixed')
    assertAlmostEqual(addAfterReopen.totals.grossWeight, 6.75)
    assertAlmostEqual(addAfterReopen.totals.stoneWeight, 0.45)
    assertAlmostEqual(addAfterReopen.totals.netWeight, 6.3)
    assertAlmostEqual(addAfterReopen.totals.fineWeight, 4.05)

    const sale3Stored = await Sale.findById(sale3._id).lean()
    assert.equal(Number(sale3Stored.revisionAdded), 2)

    const submitResult2 = await batchService.submitBatch({
      id: createResult._id,
      actor: salesmanActor2,
    })
    assert.equal(submitResult2.status, 'submitted')
    assert.equal(submitResult2.submittedBy?._id, salesman2._id.toString())

    const finalizeResult2 = await batchService.finalizeBatch({
      id: createResult._id,
      actor: adminActor,
    })
    assert.equal(finalizeResult2.status, 'finalized')
    assert.equal(finalizeResult2.revisionHistory.length, 2)
    assert.equal(finalizeResult2.revisionHistory[1].revision, 2)

    const revisionsResult = await batchService.getBatchRevisions({
      id: createResult._id,
      actor: adminActor,
    })
    assert.equal(revisionsResult.revisionHistory.length, 2)
    assert.equal(revisionsResult.currentRevision.revision, 2)
    assert.equal(revisionsResult.currentRevision.status, 'finalized')

    const adminList = await batchService.listBatches({
      actor: adminActor,
      q: createResult.batchRef,
    })
    assert.equal(adminList.total, 1)
    assert.equal(adminList.batches[0].batchRef, createResult.batchRef)

    const salesman2List = await batchService.listBatches({
      actor: salesmanActor2,
      q: createResult.batchRef,
    })
    assert.equal(salesman2List.total, 1)

    const salesman1List = await batchService.listBatches({
      actor: salesmanActor1,
      q: createResult.batchRef,
    })
    assert.equal(salesman1List.total, 0)

    const detail = await batchService.getBatchDetail({
      id: createResult._id,
      actor: adminActor,
    })
    assert.equal(detail.items.length, 3)
    assert.equal(detail.currentRevision.revision, 2)
    assert.equal(detail.revisionHistory.length, 2)

    console.log('Scan batch API checks passed (1/1)')
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
  console.error('Scan batch API checks failed:', error)
  process.exit(1)
})
