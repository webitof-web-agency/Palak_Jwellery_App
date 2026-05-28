import {
  normalizeNull,
  parsePurity,
  parseWeight,
  readExtractedValue,
  resolveSupplierName,
  toNumber,
  toText,
} from './qrNormalization.shared.js'
import { cloneValue } from './qrParser.shared.js'
import {
  extractAadinathFallback,
  extractDesignCodeFromRaw,
  extractUtsavFallback,
} from './qrNormalization.fallbacks.js'
import { normalizeConfidence } from './precision.service.js'
import { getPurityForKarat } from './supplierBusinessSettings.service.js'

const DEFAULT_KARAT_PURITY_FALLBACK = {
  '9K': 37.5,
  '14K': 58.5,
  '18K': 75,
  '20K': 83.3,
  '22K': 91.6,
  '24K': 99.9,
}

const GENERIC_NET_FORMULA = 'netWeight = grossWeight - stoneWeight - otherWeight'
const GENERIC_FINE_FORMULA = 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100'

const toWarningText = (entry) => {
  if (!entry) return null
  if (typeof entry === 'string') {
    return toText(entry)
  }
  if (typeof entry !== 'object') {
    return toText(entry)
  }

  const field = toText(entry.field)
  const reason = toText(entry.reason)
  if (field && reason) {
    return `${field}: ${reason}`
  }
  return field || reason || null
}

const collectWarningTexts = (parsedResult, calculationBreakdown = null) => {
  const warnings = []
  const push = (value) => {
    const text = toWarningText(value)
    if (text && !warnings.includes(text)) {
      warnings.push(text)
    }
  }

  for (const entry of parsedResult?.errors || []) {
    push(entry)
  }

  for (const entry of parsedResult?.meta?.parseErrors || []) {
    push(entry)
  }

  for (const entry of parsedResult?.warnings || []) {
    push(entry)
  }

  for (const entry of calculationBreakdown?.warnings || []) {
    push(entry)
  }

  return warnings
}

const buildStoneComponentsDisplay = (parsedResult, stoneWeight, calculationBreakdown = null) => {
  const components = Array.isArray(calculationBreakdown?.stoneComponents) ? calculationBreakdown.stoneComponents : []

  if (components.length > 0) {
    return components.map((component, index) => ({
      key: `stoneComponent${index + 1}`,
      label: toText(component?.label) || `Stone Component ${index + 1}`,
      sourceField: toText(component?.sourceField) || null,
      value: normalizeNull(parseWeight(component?.value)),
    }))
  }

  const stone = parseWeight(stoneWeight)
  if (stone === null) {
    return []
  }

  return [
    {
      key: 'stoneWeight',
      label: 'Stone Weight',
      sourceField: 'stone_weight',
      value: stone,
    },
  ]
}

const buildDisplayContract = ({
  parsedResult,
  supplier,
  rawText,
  confidenceValue,
  designCode,
  category,
  stoneComponents,
  grossWeight,
  stoneWeight,
  otherWeight,
  netWeight,
  karat,
  purityPercent,
  wastagePercent,
  stoneAmount,
}) => {
  const calculationBreakdown = cloneValue(parsedResult?.calculationBreakdown ?? null)
  const warnings = collectWarningTexts(parsedResult, calculationBreakdown)
  const computedNetWeight = normalizeNull(
    parseWeight(calculationBreakdown?.computedNetWeight) ??
      (grossWeight !== null && stoneWeight !== null
        ? parseWeight(grossWeight - stoneWeight - (otherWeight ?? 0))
        : null)
  )
  const selectedNetWeight = normalizeNull(
    parseWeight(calculationBreakdown?.selectedNetWeight) ??
      computedNetWeight ??
      parseWeight(netWeight)
  )
  const qrNetWeight = normalizeNull(
    parseWeight(calculationBreakdown?.qrNetWeight) ??
      parseWeight(netWeight)
  )
  const mismatch = calculationBreakdown?.mismatch ?? (
    computedNetWeight !== null && qrNetWeight !== null
      ? Math.abs(Number((computedNetWeight - qrNetWeight).toFixed(3)))
      : null
  )
  const tolerance = calculationBreakdown?.tolerance ?? null
  const stoneComponentDisplay = buildStoneComponentsDisplay(parsedResult, stoneWeight, calculationBreakdown)
  const calculationExplanation = calculationBreakdown?.calculationExplanation || {
    netFormula: GENERIC_NET_FORMULA,
    fineFormula: GENERIC_FINE_FORMULA,
  }
  const supplierDisplay = {
    id: toText(supplier?._id) || toText(supplier?.id) || null,
    name: toText(supplier?.name) || toText(parsedResult?.supplier) || 'Unknown',
    code: toText(supplier?.code) || null,
    confidence: confidenceValue,
  }

  const itemDisplay = {
    itemCode: toText(readExtractedValue(parsedResult, ['itemCode', 'meta.itemCode'])) || toText(designCode),
    designCode: toText(designCode) || toText(readExtractedValue(parsedResult, ['designCode', 'design_code', 'itemCode', 'meta.itemCode'])),
    supplierInternalId: toText(readExtractedValue(parsedResult, ['supplierInternalId', 'meta.internalId', 'meta.supplierInternalId', 'meta.itemId'])),
    size: toText(readExtractedValue(parsedResult, ['size', 'meta.size'])),
    lotCode: toText(readExtractedValue(parsedResult, ['lotCode', 'meta.lotCode'])),
    category: toText(category),
    colorCategory: toText(readExtractedValue(parsedResult, ['colorCategory', 'meta.colorCategory'])) || toText(category),
    metalType: toText(readExtractedValue(parsedResult, ['metalType', 'meta.metalType'])),
    karat: toText(karat) || toText(readExtractedValue(parsedResult, ['karat', 'meta.karat', 'purity', 'meta.purity'])),
    purityPercent: normalizeNull(parseWeight(purityPercent)),
  }

  const weightsDisplay = {
    grossWeight: normalizeNull(parseWeight(grossWeight)),
    stoneWeight: normalizeNull(parseWeight(stoneWeight)),
    stoneComponents: stoneComponentDisplay,
    otherWeight: normalizeNull(parseWeight(otherWeight)),
    qrNetWeight,
    computedNetWeight,
    selectedNetWeight,
  }

  const amountsDisplay = {
    stoneAmount: normalizeNull(parseWeight(stoneAmount)),
    otherAmount: normalizeNull(parseWeight(readExtractedValue(parsedResult, ['otherAmount', 'other_amount', 'meta.otherAmount']))),
  }

  const calculationDisplay = {
    netFormula: toText(calculationBreakdown?.netFormula) || GENERIC_NET_FORMULA,
    fineFormula: toText(calculationBreakdown?.fineFormula) || GENERIC_FINE_FORMULA,
    mismatch: normalizeNull(parseWeight(mismatch)),
    tolerance: normalizeNull(parseWeight(tolerance)),
    explanation: calculationExplanation,
  }

  return {
    supplier: supplierDisplay,
    item: itemDisplay,
    weights: weightsDisplay,
    amounts: amountsDisplay,
    calculation: calculationDisplay,
    warnings,
    requiresReview: Boolean(calculationBreakdown?.requiresReview || warnings.length > 0),
    rawQr: rawText,
  }
}

const normalize = (parsedResult, supplier) => {
  const confidenceValue = normalizeConfidence(parsedResult?.confidence)
  const rawText = toText(parsedResult?.raw)
  const supplierName = resolveSupplierName(parsedResult, supplier).toUpperCase()
  const aadinathFallback = supplierName.includes('AADINATH') ? extractAadinathFallback(rawText) : {}
  const utsavFallback = supplierName.includes('UTSAV') ? extractUtsavFallback(rawText) : {}
  const karat = toText(readExtractedValue(parsedResult, ['karat', 'meta.karat', 'purity', 'meta.purity']))
  const designCode =
    toText(readExtractedValue(parsedResult, ['design_code', 'designCode', 'designCodeValue', 'itemCode', 'category', 'meta.itemCode'])) ||
    extractDesignCodeFromRaw(rawText)
  const category = toText(
    readExtractedValue(parsedResult, [
      'category',
      'colorCategory',
      'meta.category',
      'meta.colorCategory',
    ])
  )
  const grossWeight = normalizeNull(
    parseWeight(readExtractedValue(parsedResult, ['gross_weight', 'grossWeight', 'gw', 'GWT', 'gross', 'metalWeight'])) ??
      aadinathFallback.grossWeight
  )
  const stoneWeight = normalizeNull(
    parseWeight(readExtractedValue(parsedResult, ['stone_weight', 'stoneWeight', 'sw', 'SWT', 'diamondWeight'])) ??
      aadinathFallback.stoneWeight ??
      utsavFallback.stoneWeight
  )
  const otherWeight = normalizeNull(
    parseWeight(readExtractedValue(parsedResult, ['other_weight', 'otherWeight', 'ow', 'OW'])) ??
      utsavFallback.otherWeight
  )
  const netWeight = normalizeNull(
    parseWeight(readExtractedValue(parsedResult, ['net_weight', 'netWeight', 'nw', 'NWT'])) ?? aadinathFallback.netWeight
  )
  const stoneAmount = normalizeNull(parseWeight(readExtractedValue(parsedResult, ['stone_amount', 'stoneAmount', 'stoneValue', 'stoneVal'])))
  const explicitPurityPercent = normalizeNull(
    toNumber(readExtractedValue(parsedResult, ['purity_percent', 'purityPercent', 'purityValue', 'meta.purityPercent', 'meta.purity_percent']))
  )
  const resolvedPurityPercent = normalizeNull(
    explicitPurityPercent ??
      (karat ? getPurityForKarat(supplier, karat, DEFAULT_KARAT_PURITY_FALLBACK) : null) ??
      parsePurity(rawText)
  )
  const display = buildDisplayContract({
    parsedResult,
    supplier,
    rawText,
    confidenceValue,
    designCode,
    category,
    stoneComponents: null,
    grossWeight,
    stoneWeight,
    otherWeight,
    netWeight,
    karat,
    purityPercent: resolvedPurityPercent,
    wastagePercent: normalizeNull(parseWeight(readExtractedValue(parsedResult, ['wastage_percent', 'wastagePercent', 'wastage', 'ws', 'WST']))),
    stoneAmount,
  })

  return {
    supplier: resolveSupplierName(parsedResult, supplier),
    rawQr: rawText,
    itemCode: normalizeNull(designCode),
    design_code: normalizeNull(designCode),
    gross_weight: grossWeight,
    stone_weight: stoneWeight,
    other_weight: otherWeight,
    net_weight: netWeight,
    purityPercent: resolvedPurityPercent,
    purity_percent: resolvedPurityPercent,
    category: normalizeNull(category),
    wastage_percent: normalizeNull(parseWeight(readExtractedValue(parsedResult, ['wastage_percent', 'wastagePercent', 'wastage', 'ws', 'WST']))),
    fine_weight: normalizeNull(parseWeight(readExtractedValue(parsedResult, ['fine_weight', 'fineWeight', 'fine', 'fw']))),
    stone_amount: stoneAmount,
    confidence: confidenceValue,
    status: 'pending',
    calculationBreakdown: cloneValue(parsedResult?.calculationBreakdown ?? null),
    warnings: display.warnings,
    requiresReview: display.requiresReview,
    calculation: display.calculation,
    rawQr: rawText,
    display,
  }
}

export { normalize }
