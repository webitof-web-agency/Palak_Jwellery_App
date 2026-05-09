import {
  applyApprovalState,
  applyCorrectionPatch,
  applyReviewState,
  buildCurrentWorkflow,
  buildFinalSnapshot,
  normalizeCorrectionNote,
  requiresCorrectionNote,
} from '../services/qrCorrection.service.js'

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const isClose = (actual, expected, tolerance = 0.0001) => {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance
}

const parsed = {
  supplier: 'YUG',
  designCode: 'SWNK - 976',
  grossWeight: 10,
  stoneWeight: 1,
  otherWeight: 0,
  netWeight: 8,
  purity: '75',
  confidence: 'high',
}

const originalWorkflow = buildCurrentWorkflow(parsed, {}, 'needs_review')
assert(
  originalWorkflow.validationWarnings.includes('WEIGHT: Net weight mismatch'),
  'original workflow should keep the net mismatch warning',
)

const patch = applyCorrectionPatch({}, { net_weight: 9 }, originalWorkflow.resolved)
assert(patch.changedFields.includes('net_weight'), 'correction patch should record changed field')
assert(isClose(patch.corrections.net_weight, 9), 'correction patch should store the override')
assert(
  requiresCorrectionNote(originalWorkflow.baseResolved, patch.corrections),
  'major numeric overrides should require a correction note',
)
assert(
  normalizeCorrectionNote('  supplier clarified  ') === 'supplier clarified',
  'correction note should be normalized',
)

const correctedWorkflow = buildCurrentWorkflow(parsed, patch.corrections, 'needs_review')
assert(
  !correctedWorkflow.validationWarnings.includes('WEIGHT: Net weight mismatch'),
  'corrected workflow should clear the net mismatch warning',
)
assert(
  correctedWorkflow.final.net_weight === 9,
  'corrected workflow should resolve the final net weight',
)

const finalSnapshot = buildFinalSnapshot(correctedWorkflow.resolved)
assert(finalSnapshot.design_code === 'SWNK - 976', 'final snapshot should preserve design code')
assert(isClose(finalSnapshot.net_weight, 9), 'final snapshot should preserve corrected net weight')

const approved = applyApprovalState({}, 'user-123', new Date('2026-05-07T10:00:00.000Z'))
assert(approved.status === 'approved', 'approval state should set status to approved')
assert(approved.approvedBy === 'user-123', 'approval state should persist approvedBy')
assert(approved.approvedAt instanceof Date, 'approval state should persist approvedAt')

const reviewed = applyReviewState({}, 'user-456', new Date('2026-05-07T11:00:00.000Z'))
assert(reviewed.reviewedBy === 'user-456', 'review state should persist reviewedBy')
assert(reviewed.reviewedAt instanceof Date, 'review state should persist reviewedAt')

console.log('QR correction tests passed (5/5)')
