import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { Sale } from '../src/models/Sale.js'
import { ScanBatch } from '../src/models/ScanBatch.js'
import {
  assertAllowedTransition,
  buildBatchRef,
  canAdminReopen,
  canSalesmanAddItems,
  calculateBatchTotals,
  deriveBatchEntryMode,
  finalizeBatchState,
  reopenBatchState,
} from '../src/services/batchLifecycle.service.js'

const makeId = () => new mongoose.Types.ObjectId()

const supplierId = makeId()
const salesmanId = makeId()
const actorId = makeId()
const supplierIdText = supplierId.toString()
const salesmanIdText = salesmanId.toString()
const actorIdText = actorId.toString()
const batchRef = buildBatchRef({
  supplierCode: 'YUG',
  createdAt: new Date('2026-06-01T10:30:00.000Z'),
  sequence: 1,
})

const makeSaleItem = ({
  id = makeId(),
  supplier = supplierIdText,
  entryMode = 'qr_scan',
  grossWeight = 0,
  stoneWeight = 0,
  otherWeight = 0,
  netWeight = 0,
  fineWeight = 0,
  stoneAmount = 0,
  requiresReview = false,
  isDuplicate = false,
  wasManuallyEdited = false,
  warnings = [],
} = {}) => ({
  _id: id,
  supplier,
  entryMode,
  grossWeight,
  stoneWeight,
  netWeight,
  stoneAmount,
  wasManuallyEdited,
  isDuplicate,
  calculationSnapshot: {
    grossWeight,
    stoneWeight,
    otherWeight,
    selectedNetWeight: netWeight,
    fineWeight,
    stoneAmount,
    requiresReview,
    warnings,
  },
  parsedSnapshot: {
    display: {
      requiresReview,
      warnings,
    },
  },
  settlementInputs: {
    purityOverridden: wasManuallyEdited,
    wastageOverridden: false,
  },
})

const run = () => {
  // 1. ScanBatch validates with required fields and empty totals.
  const batch = new ScanBatch({
    batchRef,
    supplierId,
    supplierCode: 'YUG',
    assignedSalesmanId: salesmanId,
    status: 'open',
    revision: 1,
    totals: {
      grossWeight: 0,
      stoneWeight: 0,
      otherWeight: 0,
      netWeight: 0,
      fineWeight: 0,
      stoneAmount: 0,
    },
  })
  assert.equal(batch.validateSync(), undefined, 'ScanBatch should validate')

  // 2. Existing old-style Sale validates without batchId.
  const oldSale = new Sale({
    salesman: salesmanId,
    supplier: supplierId,
    grossWeight: 3.25,
    stoneWeight: 0.15,
    netWeight: 3.1,
    ratePerGram: 0,
    totalValue: 0,
  })
  assert.equal(oldSale.validateSync(), undefined, 'Old-style Sale should validate')

  // 3. New Sale validates with batch metadata.
  const newSale = new Sale({
    batchId: makeId(),
    revisionAdded: 1,
    entryMode: 'qr_scan',
    addedBy: actorId,
    addedAt: new Date(),
    salesman: salesmanId,
    supplier: supplierId,
    grossWeight: 4.2,
    stoneWeight: 0.2,
    netWeight: 4,
    ratePerGram: 0,
    totalValue: 0,
  })
  assert.equal(newSale.validateSync(), undefined, 'New Sale with batch fields should validate')

  // 4. calculateBatchTotals sums multiple items and keeps zero values valid.
  const saleItems = [
    makeSaleItem({
      grossWeight: 3.25,
      stoneWeight: 0.15,
      otherWeight: 0.05,
      netWeight: 3.05,
      fineWeight: 2.15,
      stoneAmount: 12.5,
      warnings: ['missing field mapping'],
    }),
    makeSaleItem({
      grossWeight: 2,
      stoneWeight: 0,
      otherWeight: 0,
      netWeight: 2,
      fineWeight: 1.2,
      stoneAmount: 0,
      isDuplicate: true,
      wasManuallyEdited: true,
      requiresReview: true,
    }),
  ]
  const totals = calculateBatchTotals(saleItems)
  assert.deepEqual(totals, {
    grossWeight: 5.25,
    stoneWeight: 0.15,
    otherWeight: 0.05,
    netWeight: 5.05,
    fineWeight: 3.35,
    stoneAmount: 12.5,
  })

  // 5. deriveBatchEntryMode handles qr_scan, manual, and mixed.
  assert.equal(deriveBatchEntryMode([makeSaleItem({ entryMode: 'qr_scan' }), makeSaleItem({ entryMode: 'qr_scan' })]), 'qr_scan')
  assert.equal(deriveBatchEntryMode([makeSaleItem({ entryMode: 'manual' }), makeSaleItem({ entryMode: 'manual' })]), 'manual')
  assert.equal(
    deriveBatchEntryMode([
      makeSaleItem({ entryMode: 'qr_scan' }),
      makeSaleItem({ entryMode: 'manual' }),
    ]),
    'mixed'
  )

  // 6. Allowed lifecycle transitions.
  assert.equal(assertAllowedTransition('draft', 'open'), true)
  assert.equal(assertAllowedTransition('open', 'submitted'), true)
  assert.equal(assertAllowedTransition('submitted', 'finalized'), true)

  let finalizedBatch = {
    batchRef,
    supplierId: supplierIdText,
    assignedSalesmanId: salesmanIdText,
    status: 'submitted',
    revision: 1,
    revisions: [],
  }

  finalizedBatch = finalizeBatchState(finalizedBatch, {
    actorId,
    saleItems,
  })
  assert.equal(finalizedBatch.status, 'finalized')
  assert.equal(finalizedBatch.revisions.length, 1)

  const reopenedBatch = reopenBatchState(finalizedBatch, {
    actorId,
    reason: 'Customer requested additional items',
  })
  assert.equal(reopenedBatch.status, 'reopened')
  assert.equal(reopenedBatch.revision, 2)
  assert.equal(canAdminReopen(finalizedBatch), true)

  const submittedAgain = {
    ...reopenedBatch,
    status: 'submitted',
  }
  assert.equal(assertAllowedTransition('reopened', 'submitted'), true)
  const finalizedAgain = finalizeBatchState(submittedAgain, {
    actorId,
    saleItems: [
      ...saleItems,
      makeSaleItem({
        grossWeight: 1,
        stoneWeight: 0,
        otherWeight: 0,
        netWeight: 1,
        fineWeight: 0.5,
        stoneAmount: 0,
      }),
    ],
  })
  assert.equal(finalizedAgain.status, 'finalized')
  assert.equal(finalizedAgain.revisions.length, 2)

  // 7. Invalid lifecycle checks.
  assert.throws(
    () => assertAllowedTransition('finalized', 'open'),
    (error) => error instanceof Error && error.message.includes('not allowed')
  )
  assert.equal(canSalesmanAddItems(finalizedAgain), false)
  assert.throws(
    () => reopenBatchState(finalizedAgain, { actorId }),
    (error) => error instanceof Error && error.message.includes('Reopen reason is required')
  )

  // 8. Immutable revision snapshot.
  const revisionSnapshotBefore = JSON.parse(JSON.stringify(finalizedBatch.revisions[0]))
  const reopenedSnapshotBatch = reopenBatchState(finalizedBatch, {
    actorId,
    reason: 'Need 2 more items',
  })
  assert.deepEqual(JSON.parse(JSON.stringify(finalizedBatch.revisions[0])), revisionSnapshotBefore)
  assert.deepEqual(JSON.parse(JSON.stringify(reopenedSnapshotBatch.revisions[0])), revisionSnapshotBefore)

  // 9. Mixed supplier items are rejected.
  assert.throws(
    () => finalizeBatchState(
      {
        batchRef: buildBatchRef({ supplierCode: 'YUG', createdAt: new Date('2026-06-01T10:30:00.000Z'), sequence: 2 }),
        supplierId: supplierIdText,
        assignedSalesmanId: salesmanIdText,
        status: 'submitted',
        revision: 1,
        revisions: [],
      },
      {
        actorId,
        saleItems: [
          makeSaleItem({ supplier: supplierId }),
          makeSaleItem({ supplier: makeId() }),
        ],
      }
    ),
    (error) => error instanceof Error && error.message.includes('Mixed supplier batches are not allowed')
  )

  console.log('Scan batch foundation checks passed')
}

run()
