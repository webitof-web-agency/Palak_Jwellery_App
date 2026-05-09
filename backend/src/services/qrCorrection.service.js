import { validate } from './qrValidation.service.js'
import { valuate } from './qrValuation.service.js'
import { toNumber, toText } from './qrNormalization.shared.js'

const CORRECTION_FIELDS = [
  'gross_weight',
  'stone_weight',
  'other_weight',
  'net_weight',
  'purity_percent',
  'wastage_percent',
  'fine_weight',
  'stone_amount',
  'other_amount',
]

const normalizeCorrectionValue = (value) => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (value === '') {
    return null
  }

  const numeric = toNumber(value)
  return numeric === null ? undefined : numeric
}

const normalizeCorrectionNote = (value) => {
  const text = toText(value)
  return text || null
}

const mapParsedToResolved = (parsed = {}) => ({
  supplier: toText(parsed?.supplier) || 'Unknown',
  design_code: toText(parsed?.designCode) || toText(parsed?.itemCode),
  gross_weight: toNumber(parsed?.grossWeight),
  stone_weight: toNumber(parsed?.stoneWeight) ?? toNumber(parsed?.diamondWeight),
  other_weight: toNumber(parsed?.otherWeight),
  net_weight: toNumber(parsed?.netWeight),
  purity_percent: toNumber(parsed?.purity_percent) ?? toNumber(parsed?.purity),
  wastage_percent: toNumber(parsed?.wastage_percent),
  fine_weight: toNumber(parsed?.fine_weight),
  stone_amount: toNumber(parsed?.stone_amount),
  other_amount: toNumber(parsed?.other_amount),
  confidence: toNumber(parsed?.confidence) ?? 0,
  status: 'pending',
})

const buildCorrectionOverrides = (payload = {}, base = {}) => {
  const overrides = {}

  for (const field of CORRECTION_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue
    }

    const normalized = normalizeCorrectionValue(payload[field])
    if (normalized === undefined) {
      continue
    }

    if (normalized !== base?.[field]) {
      overrides[field] = normalized
    }
  }

  return overrides
}

const requiresCorrectionNote = (base = {}, overrides = {}, tolerance = 0.02) => {
  return CORRECTION_FIELDS.some((field) => {
    if (!Object.prototype.hasOwnProperty.call(overrides, field)) {
      return false
    }

    const original = toNumber(base?.[field])
    const next = toNumber(overrides?.[field])
    if (original === null || next === null) {
      return false
    }

    return Math.abs(original - next) > tolerance
  })
}

const applyCorrectionPatch = (currentCorrections = {}, payload = {}, base = {}) => {
  const nextCorrections = { ...currentCorrections }
  const changedFields = []

  for (const field of CORRECTION_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue
    }

    const normalized = normalizeCorrectionValue(payload[field])
    if (normalized === undefined) {
      continue
    }

    if (normalized === base?.[field]) {
      if (Object.prototype.hasOwnProperty.call(nextCorrections, field)) {
        delete nextCorrections[field]
        changedFields.push(field)
      }
      continue
    }

    if (nextCorrections[field] !== normalized) {
      nextCorrections[field] = normalized
      changedFields.push(field)
    }
  }

  return {
    corrections: nextCorrections,
    changedFields,
  }
}

const applyOverrides = (base = {}, overrides = {}) => ({
  ...base,
  ...overrides,
})

const buildValidationInput = (resolved = {}) => ({
  supplier: resolved.supplier || 'Unknown',
  design_code: resolved.design_code ?? null,
  gross_weight: resolved.gross_weight ?? null,
  stone_weight: resolved.stone_weight ?? null,
  other_weight: resolved.other_weight ?? null,
  net_weight: resolved.net_weight ?? null,
  purity_percent: resolved.purity_percent ?? null,
  wastage_percent: resolved.wastage_percent ?? null,
  fine_weight: resolved.fine_weight ?? null,
  stone_amount: resolved.stone_amount ?? null,
  confidence: resolved.confidence ?? 0,
  status: resolved.status || 'pending',
})

const buildFinalSnapshot = (resolved = {}) => ({
  supplier: resolved.supplier || 'Unknown',
  design_code: resolved.design_code ?? null,
  gross_weight: resolved.gross_weight ?? null,
  stone_weight: resolved.stone_weight ?? null,
  other_weight: resolved.other_weight ?? null,
  net_weight: resolved.net_weight ?? null,
  purity_percent: resolved.purity_percent ?? null,
  wastage_percent: resolved.wastage_percent ?? null,
  fine_weight: resolved.fine_weight ?? null,
  stone_amount: resolved.stone_amount ?? null,
  other_amount: resolved.other_amount ?? null,
  confidence: resolved.confidence ?? 0,
  status: resolved.status || 'pending',
  itemCode: resolved.design_code ?? '',
  category: null,
  productId: null,
  purity: resolved.purity_percent === null || resolved.purity_percent === undefined ? null : String(resolved.purity_percent),
  grossWeight: resolved.gross_weight ?? null,
  netWeight: resolved.net_weight ?? null,
  diamondWeight: resolved.stone_weight ?? null,
  designCode: resolved.design_code ?? null,
  customFields: [],
})

const buildWorkflowSnapshot = (parsed = {}, corrections = {}, workflowStatus = 'needs_review', options = {}) => {
  const baseResolved = mapParsedToResolved(parsed)
  const resolved = applyOverrides(baseResolved, corrections)
  const validationInput = buildValidationInput({ ...resolved, status: workflowStatus })
  const validated = validate(validationInput, options)
  const valuation = valuate(validated, options)

  return {
    baseResolved,
    resolved,
    validationInput,
    validated,
    valuation,
    final: buildFinalSnapshot(resolved),
  }
}

const buildOriginalWarnings = (parsed = {}, options = {}) => {
  const snapshot = buildWorkflowSnapshot(parsed, {}, 'pending', options)
  return {
    validationWarnings: Array.isArray(snapshot.validated?.warnings) ? [...snapshot.validated.warnings] : [],
    valuationWarnings: Array.isArray(snapshot.valuation?.warnings) ? [...snapshot.valuation.warnings] : [],
    snapshot,
  }
}

const buildCurrentWorkflow = (parsed = {}, corrections = {}, workflowStatus = 'needs_review', options = {}) => {
  const snapshot = buildWorkflowSnapshot(parsed, corrections, workflowStatus, options)
  return {
    corrections,
    ...snapshot,
    validationWarnings: Array.isArray(snapshot.validated?.warnings) ? [...snapshot.validated.warnings] : [],
    valuationWarnings: Array.isArray(snapshot.valuation?.warnings) ? [...snapshot.valuation.warnings] : [],
  }
}

const applyApprovalState = (record = {}, userId = null, timestamp = new Date()) => ({
  ...record,
  status: 'approved',
  approvedBy: userId,
  approvedAt: timestamp,
})

const applyReviewState = (record = {}, userId = null, timestamp = new Date()) => ({
  ...record,
  reviewedBy: userId,
  reviewedAt: timestamp,
})

export {
  CORRECTION_FIELDS,
  applyOverrides,
  applyCorrectionPatch,
  applyApprovalState,
  applyReviewState,
  buildCorrectionOverrides,
  buildCurrentWorkflow,
  buildFinalSnapshot,
  buildOriginalWarnings,
  buildValidationInput,
  mapParsedToResolved,
  normalizeCorrectionValue,
  normalizeCorrectionNote,
  requiresCorrectionNote,
}
