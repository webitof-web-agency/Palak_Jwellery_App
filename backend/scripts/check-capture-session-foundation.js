import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { CaptureSession } from '../src/models/CaptureSession.js'
import { Sale } from '../src/models/Sale.js'
import { ScanBatch } from '../src/models/ScanBatch.js'
import {
  assertAllowedSessionTransition,
  buildSessionRef,
  buildSessionSummary,
  calculateSessionTotals,
  canFinalizeSession,
  canSessionAcceptBatches,
  canSubmitSession,
  deriveSessionStatus,
  validateUniqueSupplierBatches,
} from '../src/services/captureSessionLifecycle.service.js'

const makeId = () => new mongoose.Types.ObjectId()

const makeBatch = ({
  id = makeId(),
  sessionId = makeId(),
  supplierId = makeId(),
  status = 'submitted',
  itemCount = 1,
  grossWeight = 0,
  stoneWeight = 0,
  otherWeight = 0,
  netWeight = 0,
  fineWeight = 0,
  stoneAmount = 0,
  warningsCount = 0,
  reviewCount = 0,
  duplicateCount = 0,
  manualOverrideCount = 0,
} = {}) => ({
  _id: id,
  sessionId,
  supplierId,
  status,
  itemCount,
  totals: {
    grossWeight,
    stoneWeight,
    otherWeight,
    netWeight,
    fineWeight,
    stoneAmount,
  },
  warningsCount,
  reviewCount,
  duplicateCount,
  manualOverrideCount,
})

const run = async () => {
  const sessionRef = buildSessionRef({
    prefix: 'SESSION',
    createdAt: new Date('2026-06-01T10:30:00.000Z'),
    sequence: 7,
  })
  const salesmanId = makeId()
  const sessionId = makeId()

  // 1. CaptureSession validates with required fields and empty totals.
  const session = new CaptureSession({
    sessionRef,
    assignedSalesmanId: salesmanId,
    status: 'draft',
    batchIds: [],
    totals: {
      supplierCount: 0,
      itemCount: 0,
      grossWeight: 0,
      stoneWeight: 0,
      otherWeight: 0,
      netWeight: 0,
      fineWeight: 0,
      stoneAmount: 0,
    },
  })
  assert.equal(session.validateSync(), undefined, 'CaptureSession should validate')

  // 2. Optional customer fields can be omitted.
  assert.equal(session.customerName, '')
  assert.equal(session.customerPhone, '')
  assert.equal(session.referenceNote, '')

  // 3. Existing standalone ScanBatch validates without sessionId.
  const standaloneBatch = new ScanBatch({
    batchRef: 'YUG-20260601-0001',
    supplierId: makeId(),
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
  assert.equal(standaloneBatch.validateSync(), undefined, 'Standalone ScanBatch should validate')

  // 4. Session-linked ScanBatch validates with sessionId.
  const linkedBatch = new ScanBatch({
    batchRef: 'YUG-20260601-0002',
    sessionId,
    supplierId: makeId(),
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
  assert.equal(linkedBatch.validateSync(), undefined, 'Session-linked ScanBatch should validate')

  // 5. Existing old-style Sale validates unchanged.
  const oldSale = new Sale({
    salesman: salesmanId,
    supplier: makeId(),
    grossWeight: 1,
    stoneWeight: 0,
    netWeight: 1,
    ratePerGram: 0,
    totalValue: 0,
  })
  assert.equal(oldSale.validateSync(), undefined, 'Old-style Sale should validate')

  // 6. calculateSessionTotals sums across supplier batches and excludes cancelled batches.
  const yInv = makeId()
  const vInv = makeId()
  const uInv = makeId()
  const cancelledSession = makeId()
  const sessionBatches = [
    makeBatch({
      id: makeId(),
      sessionId,
      supplierId: yInv,
      status: 'submitted',
      itemCount: 10,
      grossWeight: 10.5,
      stoneWeight: 0.4,
      otherWeight: 0.1,
      netWeight: 10,
      fineWeight: 7.5,
      stoneAmount: 100,
      warningsCount: 1,
      reviewCount: 1,
      duplicateCount: 0,
      manualOverrideCount: 1,
    }),
    makeBatch({
      id: makeId(),
      sessionId,
      supplierId: vInv,
      status: 'finalized',
      itemCount: 5,
      grossWeight: 5,
      stoneWeight: 0.2,
      otherWeight: 0,
      netWeight: 4.8,
      fineWeight: 3.3,
      stoneAmount: 50,
      warningsCount: 0,
      reviewCount: 0,
      duplicateCount: 1,
      manualOverrideCount: 0,
    }),
    makeBatch({
      id: makeId(),
      sessionId,
      supplierId: uInv,
      status: 'cancelled',
      itemCount: 3,
      grossWeight: 99,
      stoneWeight: 9,
      otherWeight: 1,
      netWeight: 88,
      fineWeight: 66,
      stoneAmount: 999,
      warningsCount: 9,
      reviewCount: 9,
      duplicateCount: 9,
      manualOverrideCount: 9,
    }),
    makeBatch({
      id: makeId(),
      sessionId: cancelledSession,
      supplierId: makeId(),
      status: 'cancelled',
      itemCount: 2,
      grossWeight: 4,
      stoneWeight: 0.1,
      otherWeight: 0.05,
      netWeight: 3.85,
      fineWeight: 2.4,
      stoneAmount: 0,
    }),
  ]

  const totals = calculateSessionTotals(sessionBatches)
  assert.deepEqual(totals, {
    supplierCount: 2,
    itemCount: 15,
    grossWeight: 15.5,
    stoneWeight: 0.6,
    otherWeight: 0.1,
    netWeight: 14.8,
    fineWeight: 10.8,
    stoneAmount: 150,
  })

  // 7. validateUniqueSupplierBatches.
  assert.equal(validateUniqueSupplierBatches(sessionBatches), true)
  assert.equal(
    validateUniqueSupplierBatches([
      { _id: makeId(), sessionId: null, supplierId: yInv },
      { _id: makeId(), sessionId: null, supplierId: yInv },
    ]),
    true
  )
  assert.throws(
    () => validateUniqueSupplierBatches([
      { _id: makeId(), sessionId, supplierId: yInv },
      { _id: makeId(), sessionId, supplierId: yInv },
    ]),
    (error) => error?.code === 'SESSION_DUPLICATE_SUPPLIER'
  )

  // 8. Session transition rules.
  assert.equal(assertAllowedSessionTransition('draft', 'open'), true)
  assert.equal(assertAllowedSessionTransition('open', 'submitted'), true)
  assert.equal(assertAllowedSessionTransition('submitted', 'finalized'), true)
  assert.equal(assertAllowedSessionTransition('open', 'cancelled'), true)
  assert.throws(
    () => assertAllowedSessionTransition('cancelled', 'open'),
    (error) => error?.code === 'SESSION_STATUS_TRANSITION_INVALID'
  )
  assert.throws(
    () => assertAllowedSessionTransition('draft', 'finalized'),
    (error) => error?.code === 'SESSION_STATUS_TRANSITION_INVALID'
  )

  // 9. canSubmitSession.
  assert.equal(canSubmitSession({ status: 'open' }, []), false)
  assert.equal(canSubmitSession({ status: 'open' }, [
    makeBatch({ sessionId, supplierId: yInv, status: 'open', itemCount: 1 }),
  ]), false)
  assert.equal(canSubmitSession({ status: 'open' }, [
    makeBatch({ sessionId, supplierId: yInv, status: 'submitted', itemCount: 1 }),
    makeBatch({ sessionId, supplierId: vInv, status: 'finalized', itemCount: 1 }),
  ]), true)

  // 10. canFinalizeSession.
  assert.equal(canFinalizeSession({ status: 'submitted' }, []), false)
  assert.equal(canFinalizeSession({ status: 'submitted' }, [
    makeBatch({ sessionId, supplierId: yInv, status: 'submitted', itemCount: 1 }),
  ]), false)
  assert.equal(canFinalizeSession({ status: 'submitted' }, [
    makeBatch({ sessionId, supplierId: yInv, status: 'finalized', itemCount: 1 }),
    makeBatch({ sessionId, supplierId: vInv, status: 'finalized', itemCount: 1 }),
  ]), true)

  // 11. deriveSessionStatus.
  assert.equal(deriveSessionStatus([], 'draft'), 'draft')
  assert.equal(deriveSessionStatus([
    makeBatch({ sessionId, supplierId: yInv, status: 'open', itemCount: 1 }),
  ], 'draft'), 'open')
  assert.equal(deriveSessionStatus([
    makeBatch({ sessionId, supplierId: yInv, status: 'finalized', itemCount: 1 }),
    makeBatch({ sessionId, supplierId: vInv, status: 'finalized', itemCount: 1 }),
  ], 'submitted'), 'submitted')
  assert.equal(deriveSessionStatus([
    makeBatch({ sessionId, supplierId: yInv, status: 'finalized', itemCount: 1 }),
    makeBatch({ sessionId, supplierId: vInv, status: 'finalized', itemCount: 1 }),
  ], 'finalized'), 'finalized')
  assert.equal(deriveSessionStatus([
    makeBatch({ sessionId, supplierId: yInv, status: 'reopened', itemCount: 1 }),
  ], 'finalized'), 'open')

  // 12. buildSessionSummary.
  const summary = buildSessionSummary(
    {
      _id: sessionId,
      sessionRef,
      customerName: 'Customer A',
      customerPhone: '9876543210',
      referenceNote: 'Summary test',
      assignedSalesmanId: salesmanId,
      status: 'open',
      createdAt: new Date('2026-06-01T10:30:00.000Z'),
      updatedAt: new Date('2026-06-01T12:00:00.000Z'),
    },
    sessionBatches
  )
  assert.equal(summary.sessionRef, sessionRef)
  assert.equal(summary.customerName, 'Customer A')
  assert.equal(summary.supplierCount, 2)
  assert.equal(summary.itemCount, 15)
  assert.ok(!('batchIds' in summary))
  assert.ok(!('items' in summary))

  // 13. Index/helper behavior for one supplier batch per session.
  const indexes = ScanBatch.schema.indexes()
  const uniqueSessionSupplierIndex = indexes.find(([fields, options]) => {
    return (
      fields?.sessionId === 1 &&
      fields?.supplierId === 1 &&
      options?.unique === true &&
      options?.partialFilterExpression?.sessionId?.$type === 'objectId'
    )
  })
  assert.ok(uniqueSessionSupplierIndex, 'Session supplier partial unique index should exist')
}

run()
  .then(() => {
    console.log('Capture session foundation checks passed (13/13)')
  })
  .catch((error) => {
    console.error('Capture session foundation checks failed')
    console.error(error)
    process.exitCode = 1
  })
