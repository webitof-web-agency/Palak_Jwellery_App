import { compareWeight, normalizeConfidence } from './precision.service.js'
import { toNumber, toText } from './qrNormalization.shared.js'

const WARNING_TOLERANCE = 0.02
const CRITICAL_CONFIDENCE_PENALTY = 30
const NET_MISMATCH_PENALTY = 20
const FINE_MISMATCH_PENALTY = 15
const INVALID_VALUE_PENALTY = 20
const PHYSICS_PENALTY = 30
const LENIENT_CONFIDENCE_CAP = 50
const SUPPLIER_VALIDATION_RULES = {
  utsav: {
    allowMissingOtherWeight: true,
  },
  yug: {
    strict: true,
  },
  zar: {
    lenient: true,
  },
}

const clampConfidence = (value) => normalizeConfidence(value)

const normalizeWarnings = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map((warning) => toText(warning)).filter(Boolean))]
}

const getSupplierRule = (supplier) => {
  const supplierName = toText(supplier)?.toLowerCase()
  return supplierName ? SUPPLIER_VALIDATION_RULES[supplierName] || {} : {}
}

const hasValue = (value) => value !== null && value !== undefined

const appendWarning = (warnings, warning) => {
  const text = toText(warning)
  if (text) {
    warnings.push(text)
  }
}

const addCategoryWarning = (warnings, category, message) => {
  const categoryText = toText(category)
  const messageText = toText(message)
  if (categoryText && messageText) {
    appendWarning(warnings, `${categoryText}: ${messageText}`)
  }
}

const isMissing = (value) => value === null || value === undefined

const addUniqueWarning = (warnings, warning) => {
  const text = toText(warning)
  if (text && !warnings.includes(text)) {
    warnings.push(text)
  }
}

const checkWeightValue = (value, positiveWarning, zeroWarning, negativeWarning, allowZero = false) => {
  if (isMissing(value)) {
    return null
  }

  if (value < 0) {
    return negativeWarning
  }

  if (value === 0) {
    if (allowZero) {
      return null
    }
    return zeroWarning || positiveWarning
  }

  return null
}

const checkPercentValue = (value, warning) => {
  if (isMissing(value)) {
    return null
  }

  if (value < 0 || value > 100) {
    return warning
  }

  return null
}

const validate = (normalizedData = {}, options = {}) => {
  const supplier = toText(normalizedData?.supplier)
  const supplierRule = getSupplierRule(supplier)
  const warnings = normalizeWarnings(normalizedData?.warnings)
  let confidence = clampConfidence(normalizedData?.confidence)
  let status = 'approved'
  const designCode = toText(normalizedData?.design_code)
  const grossWeight = toNumber(normalizedData?.gross_weight)
  const stoneWeight = toNumber(normalizedData?.stone_weight)
  const otherWeight = toNumber(normalizedData?.other_weight)
  const netWeight = toNumber(normalizedData?.net_weight)
  const purityPercent = toNumber(normalizedData?.purity_percent)
  const wastagePercent = toNumber(normalizedData?.wastage_percent)
  const defaultWastagePercent = toNumber(options?.defaultWastagePercent)
  const settlementCalculationMode = String(options?.settlementCalculationMode || 'strict').trim().toLowerCase()
  const effectiveWastagePercent = wastagePercent !== null
    ? wastagePercent
    : (settlementCalculationMode === 'default_wastage' ? defaultWastagePercent : null)
  const fineWeight = toNumber(normalizedData?.fine_weight)
  const stoneAmount = toNumber(normalizedData?.stone_amount)
  const allWeightValuesMissing =
    isMissing(grossWeight) &&
    isMissing(stoneWeight) &&
    isMissing(otherWeight) &&
    isMissing(netWeight) &&
    isMissing(fineWeight) &&
    isMissing(stoneAmount)

  if (supplierRule.lenient) {
    addCategoryWarning(warnings, 'DATA', 'Supplier requires manual review')
    if (
      allWeightValuesMissing
    ) {
      addCategoryWarning(warnings, 'DATA', 'Insufficient QR data')
    }
    return {
      ...normalizedData,
      status: 'needs_review',
      confidence: Math.min(confidence, LENIENT_CONFIDENCE_CAP),
      warnings: [...new Set(warnings)],
    }
  }

  if (!designCode || netWeight === null) {
    status = 'needs_review'
    confidence -= CRITICAL_CONFIDENCE_PENALTY
    addCategoryWarning(warnings, 'DATA', 'Critical fields missing')
  }

  if (allWeightValuesMissing) {
    addCategoryWarning(warnings, 'DATA', supplierRule.lenient ? 'Insufficient QR data' : 'Insufficient data')
  }

  const grossWeightIssue = checkWeightValue(grossWeight, 'Invalid or zero weight', 'Invalid or zero weight', 'Invalid weight value')
  const stoneWeightIssue = checkWeightValue(stoneWeight, 'Invalid or zero weight', 'Invalid or zero weight', 'Invalid weight value')
  const otherWeightIssue = checkWeightValue(otherWeight, 'Invalid or zero weight', 'Invalid or zero weight', 'Invalid weight value', true)
  const netWeightIssue = checkWeightValue(netWeight, 'Invalid or zero net weight', 'Invalid or zero net weight', 'Invalid weight value')
  const fineWeightIssue = checkWeightValue(fineWeight, 'Invalid or zero weight', 'Invalid or zero weight', 'Invalid weight value')
  const stoneAmountIssue = checkWeightValue(stoneAmount, 'Invalid or zero weight', 'Invalid or zero weight', 'Invalid weight value', true)
  const purityIssue = checkPercentValue(purityPercent, 'Invalid purity value')
  const wastageIssue = checkPercentValue(wastagePercent, 'Invalid wastage value')

  for (const issue of [
    grossWeightIssue,
    stoneWeightIssue,
    otherWeightIssue,
    netWeightIssue,
    fineWeightIssue,
    stoneAmountIssue,
    purityIssue,
    wastageIssue,
  ]) {
    if (issue) {
      status = 'needs_review'
      confidence -= INVALID_VALUE_PENALTY
      addUniqueWarning(warnings, issue)
    }
  }

  if (hasValue(grossWeight) && hasValue(stoneWeight) && stoneWeight > grossWeight) {
    status = 'needs_review'
    confidence -= PHYSICS_PENALTY
    addCategoryWarning(warnings, 'STONE', 'Stone weight exceeds gross weight')
  }

  if (hasValue(grossWeight) && hasValue(netWeight) && netWeight > grossWeight) {
    status = 'needs_review'
    confidence -= PHYSICS_PENALTY
    addCategoryWarning(warnings, 'WEIGHT', 'Net weight exceeds gross weight')
  }

  if (hasValue(grossWeight) && hasValue(stoneWeight) && netWeight !== null) {
    if (otherWeight === null && supplierRule.allowMissingOtherWeight) {
      // Relaxed by supplier rule.
    } else {
      const expectedNet = grossWeight - stoneWeight - (otherWeight ?? 0)
      if (!compareWeight(expectedNet, netWeight, WARNING_TOLERANCE)) {
        status = 'needs_review'
        confidence -= NET_MISMATCH_PENALTY
        addCategoryWarning(warnings, 'WEIGHT', 'Net weight mismatch')
      }
    }
  }

  if (netWeight !== null && purityPercent !== null && effectiveWastagePercent !== null) {
    const expectedFine = netWeight * ((purityPercent + effectiveWastagePercent) / 100)
    if (fineWeight !== null) {
      if (!compareWeight(expectedFine, fineWeight, WARNING_TOLERANCE)) {
        status = 'needs_review'
        confidence -= FINE_MISMATCH_PENALTY
        addCategoryWarning(warnings, 'FINE', 'Fine weight mismatch')
      }
    } else {
      addCategoryWarning(warnings, 'FINE', 'Fine not provided')
      if (!warnings.some((warning) => warning.includes('Fine validation skipped'))) {
        addCategoryWarning(warnings, 'FINE', 'Fine validation skipped')
      }
    }
  }

  if (status === 'approved' && (purityPercent === null || effectiveWastagePercent === null || stoneAmount === null)) {
    addCategoryWarning(warnings, 'DATA', 'Partial data - verify before billing')
  }

  if (confidence < 60) {
    status = 'needs_review'
  }

  confidence = Math.max(0, Math.min(100, confidence))

  if (hasValue(grossWeight) && hasValue(stoneWeight) && stoneWeight > grossWeight) {
    confidence = Math.min(confidence, 59)
  }

  if (hasValue(grossWeight) && hasValue(netWeight) && netWeight > grossWeight) {
    confidence = Math.min(confidence, 59)
  }

  return {
    ...normalizedData,
    status,
    confidence,
    warnings: [...new Set(warnings)],
  }
}

export { validate }
