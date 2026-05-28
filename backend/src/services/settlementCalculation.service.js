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

const addWarning = (warnings, message) => {
  const text = toText(message)
  if (text && !warnings.includes(text)) {
    warnings.push(text)
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
  const warnings = []
  const gross = toNumber(grossWeight)
  const stone = toNumber(stoneWeight)
  const other = toNumber(otherWeight)
  const qrNet = toNumber(qrNetWeight)
  const effectiveTolerance = Math.max(0, normalizeNumber(tolerance, DEFAULT_TOLERANCE))
  const computedNetWeight = calculateNetWeight({ grossWeight, stoneWeight, otherWeight })

  if (gross === null) {
    addWarning(warnings, 'Gross weight is missing')
  } else if (gross <= 0) {
    addWarning(warnings, 'Gross weight must be greater than 0')
  }

  if (stone !== null && stone < 0) {
    addWarning(warnings, 'Stone weight cannot be negative')
  }

  if (other !== null && other < 0) {
    addWarning(warnings, 'Other weight cannot be negative')
  }

  if (computedNetWeight < 0) {
    addWarning(warnings, 'Computed net weight is negative')
  }

  if (qrNet !== null) {
    const matches = compareWeight(computedNetWeight, qrNet, effectiveTolerance)
    if (!matches) {
      addWarning(warnings, 'QR net weight differs from computed net weight beyond tolerance')
    }
  }

  return {
    qrNetWeight: qrNet,
    computedNetWeight,
    tolerance: effectiveTolerance,
    warnings,
    requiresReview: warnings.length > 0,
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
}) => {
  const warnings = []
  const gross = normalizeNumber(grossWeight, 0)
  const stone = normalizeNumber(stoneWeight, 0)
  const other = normalizeNumber(otherWeight, 0)
  const qrNet = toNumber(qrNetWeight)
  const purity = toNumber(purityPercent)
  const wastage = toNumber(wastagePercent)
  const effectiveTolerance = Math.max(0, normalizeNumber(tolerance, DEFAULT_TOLERANCE))

  if (!hasProvidedNumber(grossWeight)) {
    addWarning(warnings, 'Gross weight is missing')
  } else if (gross <= 0) {
    addWarning(warnings, 'Gross weight must be greater than 0')
  }

  if (hasProvidedNumber(stoneWeight) && stone < 0) {
    addWarning(warnings, 'Stone weight cannot be negative')
  }

  if (hasProvidedNumber(otherWeight) && other < 0) {
    addWarning(warnings, 'Other weight cannot be negative')
  }

  const computedNetWeight = roundWeight(gross - stone - other)

  if (computedNetWeight < 0) {
    addWarning(warnings, 'Computed net weight is negative')
  }

  const qrValidation = validateQrNetWeight({
    grossWeight,
    stoneWeight,
    otherWeight,
    qrNetWeight,
    tolerance: effectiveTolerance,
  })

  for (const warning of qrValidation.warnings) {
    addWarning(warnings, warning)
  }

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
    : roundWeight(computedNetWeight * (settlementPercent / 100))

  const selectedNetWeight = computedNetWeight
  const requiresReview = warnings.length > 0 || qrValidation.requiresReview

  return {
    grossWeight: roundWeight(gross),
    stoneWeight: roundWeight(stone),
    otherWeight: roundWeight(other),
    qrNetWeight: qrNet,
    computedNetWeight,
    selectedNetWeight,
    purityPercent: purity,
    wastagePercent: wastage,
    settlementPercent,
    fineWeight,
    tolerance: effectiveTolerance,
    warnings: [...new Set(warnings)],
    requiresReview,
    calculationExplanation: {
      netFormula: 'netWeight = grossWeight - stoneWeight - otherWeight',
      fineFormula: 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
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
  const qrNet = toNumber(qrNetWeight)
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
  const otherWeight = roundWeight(ot)
  const computedNetWeight = roundWeight(gross - stoneWeight - otherWeight)

  if (computedNetWeight < 0) {
    addWarning(warnings, 'Computed net weight is negative')
  }

  if (qrNet !== null && !compareWeight(computedNetWeight, qrNet, effectiveTolerance)) {
    addWarning(warnings, 'QR net weight differs from computed net weight beyond tolerance')
  }

  return {
    grossWeight: roundWeight(gross),
    ssWeight: roundWeight(ss),
    msWeight: roundWeight(ms),
    spWeight: roundWeight(sp),
    otWeight: roundWeight(ot),
    stoneWeight,
    otherWeight,
    computedNetWeight,
    qrNetWeight: qrNet,
    tolerance: effectiveTolerance,
    warnings: [...new Set(warnings)],
    requiresReview: warnings.length > 0,
    calculationExplanation: {
      netFormula: 'computedNetWeight = grossWeight - (ssWeight + msWeight + spWeight) - otWeight',
      fineFormula: 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
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
  validateQrNetWeight,
}
