import { compareWeight, roundTo } from './precision.service.js'
import { toNumber, toText } from './qrNormalization.shared.js'

const WEIGHT_DECIMALS = 3
const PERCENT_DECIMALS = 2
const DEFAULT_TOLERANCE = 0.005

const normalizeNumber = (value, fallback = 0) => {
  const numeric = toNumber(value)
  return numeric === null ? fallback : numeric
}

const roundWeight = (value) => roundTo(value, WEIGHT_DECIMALS)

const roundPercent = (value) => roundTo(value, PERCENT_DECIMALS)

const hasProvidedNumber = (value) => toNumber(value) !== null

const toRoundedWeight = (value) => {
  const numeric = toNumber(value)
  return numeric === null ? null : roundWeight(numeric)
}

const addWarning = (warnings, message) => {
  const text = toText(message)
  if (text && !warnings.includes(text)) {
    warnings.push(text)
  }
}

const INFORMATIONAL_RECONCILIATION_WARNINGS = new Set([
  'Other Weight detected from QR reconciliation',
  'Other Weight inferred to match QR net',
])

const hasReviewWarnings = (warnings = []) =>
  warnings.some((warning) => !INFORMATIONAL_RECONCILIATION_WARNINGS.has(toText(warning)))

const reconcileWeightEquation = ({
  grossWeight,
  stoneWeight,
  otherWeight,
  qrNetWeight,
  unmatchedValues = [],
  tolerance = DEFAULT_TOLERANCE,
}) => {
  const warnings = []
  const gross = toRoundedWeight(grossWeight)
  const stone = toRoundedWeight(stoneWeight) ?? 0
  const explicitOther = toRoundedWeight(otherWeight) ?? 0
  const qrNet = toRoundedWeight(qrNetWeight)
  const effectiveTolerance = Math.max(0, normalizeNumber(tolerance, DEFAULT_TOLERANCE))
  const safeInferenceTolerance = Math.max(effectiveTolerance, 0.05)
  const normalizedUnmatchedValues = Array.isArray(unmatchedValues)
    ? unmatchedValues
        .map((value) => toRoundedWeight(value))
        .filter((value) => value !== null)
    : []

  if (gross === null) {
    addWarning(warnings, 'Gross weight is missing')
  } else if (gross <= 0) {
    addWarning(warnings, 'Gross weight must be greater than 0')
  }

  if (stoneWeight !== null && stone < 0) {
    addWarning(warnings, 'Stone weight cannot be negative')
  }

  if (otherWeight !== null && explicitOther < 0) {
    addWarning(warnings, 'Other weight cannot be negative')
  }

  if (qrNet !== null && gross !== null && qrNet > gross + effectiveTolerance) {
    addWarning(warnings, 'QR net weight cannot exceed gross weight')
  }

  const expectedDeduction = gross !== null && qrNet !== null ? roundWeight(gross - qrNet) : null
  const knownDeduction = roundWeight(stone + explicitOther)
  const remainingDeduction = expectedDeduction === null ? null : roundWeight(expectedDeduction - stone)
  let selectedOtherWeight = explicitOther
  let matchedUnmatchedValue = null
  let reconciliationStatus = 'unknown'

  if (expectedDeduction !== null) {
    if (expectedDeduction < 0) {
      addWarning(warnings, 'Computed deduction is negative')
      reconciliationStatus = 'review'
    } else if (knownDeduction > expectedDeduction + effectiveTolerance) {
      addWarning(warnings, 'Known deductions exceed expected deduction')
      reconciliationStatus = 'review'
    } else if (compareWeight(knownDeduction, expectedDeduction, effectiveTolerance)) {
      reconciliationStatus = explicitOther === 0 ? 'matched_zero_other' : 'matched'
    } else if (remainingDeduction !== null && remainingDeduction > 0) {
      matchedUnmatchedValue = normalizedUnmatchedValues.find((value) => compareWeight(value, remainingDeduction, effectiveTolerance)) ?? null

      if (matchedUnmatchedValue !== null) {
        selectedOtherWeight = matchedUnmatchedValue
        reconciliationStatus = 'reconciled_unmatched'
        addWarning(warnings, 'Other Weight detected from QR reconciliation')
      } else if (remainingDeduction <= safeInferenceTolerance) {
        selectedOtherWeight = remainingDeduction
        reconciliationStatus = 'inferred_remaining'
        addWarning(warnings, 'Other Weight inferred to match QR net')
      } else {
        reconciliationStatus = 'review'
        addWarning(warnings, 'Other weight could not be reconciled from QR')
      }
    } else if (remainingDeduction !== null && remainingDeduction < -effectiveTolerance) {
      addWarning(warnings, 'Known deductions exceed gross weight')
      reconciliationStatus = 'review'
    }
  }

  const computedNetWeight = gross === null
    ? null
    : roundWeight(gross - stone - selectedOtherWeight)

  if (computedNetWeight !== null && computedNetWeight < 0) {
    addWarning(warnings, 'Computed net weight is negative')
  }

  if (computedNetWeight !== null && qrNet !== null && !compareWeight(computedNetWeight, qrNet, effectiveTolerance)) {
    addWarning(warnings, 'QR net weight differs from computed net weight beyond tolerance')
  }

  const requiresReview = reconciliationStatus === 'review' || hasReviewWarnings(warnings)

  return {
    grossWeight: gross,
    stoneWeight: roundWeight(stone),
    otherWeight: roundWeight(selectedOtherWeight),
    explicitOtherWeight: roundWeight(explicitOther),
    qrNetWeight: qrNet,
    expectedDeduction,
    knownDeduction,
    remainingDeduction,
    unmatchedValues: normalizedUnmatchedValues,
    matchedUnmatchedValue,
    computedNetWeight,
    selectedNetWeight: computedNetWeight,
    reconciliationStatus,
    warnings: [...new Set(warnings)],
    requiresReview,
    reconciliationProof: {
      grossWeight: gross,
      qrNetWeight: qrNet,
      expectedDeduction,
      knownStoneWeight: roundWeight(stone),
      knownOtherWeight: roundWeight(explicitOther),
      remainingDeduction,
      unmatchedValues: normalizedUnmatchedValues,
      matchedUnmatchedValue,
      inferredOtherWeight: selectedOtherWeight !== explicitOther ? roundWeight(selectedOtherWeight) : null,
      reconciliationStatus,
    },
  }
}

const calculateNetWeight = ({ grossWeight, stoneWeight, otherWeight }) => {
  const gross = normalizeNumber(grossWeight, 0)
  const stone = normalizeNumber(stoneWeight, 0)
  const other = normalizeNumber(otherWeight, 0)
  return roundWeight(gross - stone - other)
}

const calculateSettlementPercent = ({ purityPercent, wastagePercent }) => {
  const purity = toNumber(purityPercent)
  const wastage = toNumber(wastagePercent)

  if (purity === null || wastage === null) {
    return null
  }

  return roundPercent(purity + wastage)
}

const calculateFineWeight = ({ netWeight, purityPercent, wastagePercent }) => {
  const net = toNumber(netWeight)
  const settlementPercent = calculateSettlementPercent({ purityPercent, wastagePercent })

  if (net === null || settlementPercent === null) {
    return null
  }

  return roundWeight(net * (settlementPercent / 100))
}

const validateQrNetWeight = ({
  grossWeight,
  stoneWeight,
  otherWeight,
  qrNetWeight,
  tolerance = DEFAULT_TOLERANCE,
}) => {
  const reconciliation = reconcileWeightEquation({
    grossWeight,
    stoneWeight,
    otherWeight,
    qrNetWeight,
    tolerance,
  })

  return {
    qrNetWeight: reconciliation.qrNetWeight,
    computedNetWeight: reconciliation.computedNetWeight,
    selectedNetWeight: reconciliation.selectedNetWeight,
    tolerance: Math.max(0, normalizeNumber(tolerance, DEFAULT_TOLERANCE)),
    warnings: reconciliation.warnings,
    requiresReview: reconciliation.requiresReview,
    reconciliationStatus: reconciliation.reconciliationStatus,
    reconciliationProof: reconciliation.reconciliationProof,
  }
}

const calculateSettlementSnapshot = ({
  grossWeight,
  stoneWeight,
  otherWeight,
  qrNetWeight,
  purityPercent,
  wastagePercent,
  tolerance = DEFAULT_TOLERANCE,
  unmatchedValues = [],
}) => {
  const purity = toNumber(purityPercent)
  const wastage = toNumber(wastagePercent)
  const effectiveTolerance = Math.max(0, normalizeNumber(tolerance, DEFAULT_TOLERANCE))
  const reconciliation = reconcileWeightEquation({
    grossWeight,
    stoneWeight,
    otherWeight,
    qrNetWeight,
    unmatchedValues,
    tolerance: effectiveTolerance,
  })
  const warnings = [...reconciliation.warnings]

  if (purity === null) {
    addWarning(warnings, 'Purity percent is missing')
  }

  if (wastage === null) {
    addWarning(warnings, 'Wastage percent is missing')
  }

  const settlementPercent = calculateSettlementPercent({
    purityPercent: purity,
    wastagePercent: wastage,
  })

  const fineWeight = settlementPercent === null
    ? null
    : roundWeight((reconciliation.selectedNetWeight ?? reconciliation.computedNetWeight ?? 0) * (settlementPercent / 100))

  const requiresReview = reconciliation.requiresReview || hasReviewWarnings(warnings)

  return {
    grossWeight: reconciliation.grossWeight,
    stoneWeight: reconciliation.stoneWeight,
    otherWeight: reconciliation.otherWeight,
    explicitOtherWeight: reconciliation.explicitOtherWeight,
    qrNetWeight: reconciliation.qrNetWeight,
    expectedDeduction: reconciliation.expectedDeduction,
    remainingDeduction: reconciliation.remainingDeduction,
    unmatchedValues: reconciliation.unmatchedValues,
    matchedUnmatchedValue: reconciliation.matchedUnmatchedValue,
    computedNetWeight: reconciliation.computedNetWeight,
    selectedNetWeight: reconciliation.selectedNetWeight,
    purityPercent: purity,
    wastagePercent: wastage,
    settlementPercent,
    fineWeight,
    tolerance: effectiveTolerance,
    warnings: [...new Set(warnings)],
    requiresReview,
    reconciliationStatus: reconciliation.reconciliationStatus,
    reconciliationProof: reconciliation.reconciliationProof,
    calculationExplanation: {
      netFormula: 'netWeight = grossWeight - stoneWeight - otherWeight',
      fineFormula: 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
      reconciliationStatus: reconciliation.reconciliationStatus,
    },
  }
}

const calculateYugWeightBreakdown = ({
  grossWeight,
  ssWeight,
  msWeight,
  spWeight,
  otWeight,
  qrNetWeight,
  tolerance = DEFAULT_TOLERANCE,
}) => {
  const warnings = []
  const gross = normalizeNumber(grossWeight, 0)
  const ss = normalizeNumber(ssWeight, 0)
  const ms = normalizeNumber(msWeight, 0)
  const sp = normalizeNumber(spWeight, 0)
  const ot = normalizeNumber(otWeight, 0)
  const effectiveTolerance = Math.max(0, normalizeNumber(tolerance, DEFAULT_TOLERANCE))

  if (!hasProvidedNumber(grossWeight)) {
    addWarning(warnings, 'Gross weight is missing')
  } else if (gross <= 0) {
    addWarning(warnings, 'Gross weight must be greater than 0')
  }

  for (const [label, value] of [
    ['SS weight', ssWeight],
    ['MS weight', msWeight],
    ['SP weight', spWeight],
    ['Other weight', otWeight],
  ]) {
    const numeric = toNumber(value)
    if (numeric !== null && numeric < 0) {
      addWarning(warnings, `${label} cannot be negative`)
    }
  }

  const stoneWeight = roundWeight(ss + ms + sp)
  const reconciliation = reconcileWeightEquation({
    grossWeight: gross,
    stoneWeight,
    otherWeight: ot,
    qrNetWeight,
    tolerance: effectiveTolerance,
  })

  const combinedWarnings = [...new Set([...warnings, ...reconciliation.warnings])]

  return {
    grossWeight: reconciliation.grossWeight,
    ssWeight: roundWeight(ss),
    msWeight: roundWeight(ms),
    spWeight: roundWeight(sp),
    otWeight: roundWeight(ot),
    stoneWeight,
    otherWeight: reconciliation.otherWeight,
    explicitOtherWeight: reconciliation.explicitOtherWeight,
    computedNetWeight: reconciliation.computedNetWeight,
    selectedNetWeight: reconciliation.selectedNetWeight,
    qrNetWeight: reconciliation.qrNetWeight,
    expectedDeduction: reconciliation.expectedDeduction,
    remainingDeduction: reconciliation.remainingDeduction,
    unmatchedValues: reconciliation.unmatchedValues,
    matchedUnmatchedValue: reconciliation.matchedUnmatchedValue,
    tolerance: effectiveTolerance,
    warnings: combinedWarnings,
    requiresReview: reconciliation.requiresReview || hasReviewWarnings(combinedWarnings),
    reconciliationStatus: reconciliation.reconciliationStatus,
    reconciliationProof: reconciliation.reconciliationProof,
    calculationExplanation: {
      netFormula: 'computedNetWeight = grossWeight - (ssWeight + msWeight + spWeight) - otWeight',
      fineFormula: 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
      reconciliationStatus: reconciliation.reconciliationStatus,
    },
  }
}

export {
  calculateFineWeight,
  calculateNetWeight,
  calculateSettlementPercent,
  calculateSettlementSnapshot,
  calculateYugWeightBreakdown,
  normalizeNumber,
  reconcileWeightEquation,
  validateQrNetWeight,
}

