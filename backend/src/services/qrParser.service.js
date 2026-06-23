import { asErrorList, cloneValue, createEmptyFields, createResult, normalizeRaw, normalizeSupplierKey, readParsedValue, toNumber, toText } from './qrParser.shared.js'
import { buildParserCandidates, scoreConfidence } from './qrParser.config.js'
import { detectSupplier } from './qrParser.detection.js'
import { runParserByStrategy } from './qrParser.strategies.js'
import {
  isLikelyYugDelimiterRaw,
  isLikelyYugRaw,
  isLikelyYugStructuralRaw,
  normalizeStrategy,
  scoreYugStructuralSignature,
  splitYugPositionalRaw,
} from './qrParser.patterns.js'
import { calculateYugWeightBreakdown } from './settlementCalculation.service.js'
import { getQrNetTolerance } from './supplierBusinessSettings.service.js'

export { detectSupplier }

const resolveSupplierContext = (input = null) => {
  if (!input) {
    return {
      supplier: null,
      qrMapping: null,
    }
  }

  if (input.qrMapping || input.name || input.code) {
    return {
      supplier: input,
      qrMapping: input.qrMapping || null,
    }
  }

  return {
    supplier: null,
    qrMapping: input,
  }
}

const createYugCalculationBreakdown = (raw, breakdown) => ({
  rawQr: raw,
  grossWeight: breakdown.grossWeight,
  stoneComponents: [
    {
      sourceField: '[4]',
      label: 'stone component 1',
      value: breakdown.ssWeight,
    },
    {
      sourceField: '[14]',
      label: 'stone component 2',
      value: breakdown.msWeight,
    },
  ],
  otherWeight: {
    sourceField: '[11]',
    value: breakdown.otWeight,
  },
  qrNetWeight: breakdown.qrNetWeight,
  computedNetWeight: breakdown.computedNetWeight,
  selectedNetWeight: breakdown.computedNetWeight,
  netFormula: 'computedNetWeight = grossWeight - stone component 1 - stone component 2 - otherWeight',
  mismatch: breakdown.qrNetWeight === null ? null : Math.abs(Number((breakdown.computedNetWeight - breakdown.qrNetWeight).toFixed(3))),
  tolerance: breakdown.tolerance,
  warnings: breakdown.warnings,
  requiresReview: breakdown.requiresReview,
})

const enrichYugParseResult = (result, raw, supplier = null) => {
  const parts = splitYugPositionalRaw(raw)
  if (parts.length < 15) {
    return result
  }

  const toNumeric = (value) => {
    const parsed = toNumber(value)
    return parsed === null ? null : parsed
  }

  const grossWeight = toNumeric(parts[3])
  const stoneComponent1 = toNumeric(parts[4])
  const qrNetWeight = toNumeric(parts[5])
  const stoneAmount = toNumeric(parts[6])
  const itemCode = toText(parts[7])
  const size = toText(parts[8])
  const metalType = toText(parts[9])
  const lotCode = toText(parts[10])
  const otherWeight = toNumeric(parts[11])
  const category = toText(parts[13])
  const stoneComponent2 = toNumeric(parts[14])
  const karat = toText(parts[2])
  const structural = scoreYugStructuralSignature(raw)
  const tolerance = getQrNetTolerance(supplier)

  const breakdown = calculateYugWeightBreakdown({
    grossWeight,
    ssWeight: stoneComponent1,
    msWeight: stoneComponent2,
    spWeight: 0,
    otWeight: otherWeight,
    qrNetWeight,
    tolerance,
  })

  const mergedFields = result?.fields ? { ...result.fields } : createEmptyFields()
  mergedFields.grossWeight = { value: grossWeight, parsed: grossWeight !== null }
  mergedFields.stoneWeight = { value: breakdown.stoneWeight, parsed: true }
  mergedFields.otherWeight = { value: breakdown.otherWeight, parsed: otherWeight !== null }
  mergedFields.netWeight = { value: qrNetWeight, parsed: qrNetWeight !== null }
  mergedFields.stoneAmount = { value: stoneAmount, parsed: stoneAmount !== null }
  mergedFields.category = { value: category, parsed: category !== null }
  mergedFields.colorCategory = { value: category, parsed: category !== null }
  mergedFields.size = { value: size, parsed: size !== null }
  mergedFields.metalType = { value: metalType, parsed: metalType !== null }
  mergedFields.lotCode = { value: lotCode, parsed: lotCode !== null }
  mergedFields.stoneComponent1 = { value: stoneComponent1, parsed: stoneComponent1 !== null }
  mergedFields.stoneComponent2 = { value: stoneComponent2, parsed: stoneComponent2 !== null }
  mergedFields.karat = { value: karat, parsed: karat !== null }
  mergedFields.designCode = { value: itemCode, parsed: itemCode !== null }
  mergedFields.meta = {
    ...(result?.fields?.meta || {}),
    itemCode: { value: itemCode, parsed: itemCode !== null },
    structuralScore: { value: structural.score, parsed: true },
  }

  return {
    ...result,
    fields: mergedFields,
    calculationBreakdown: createYugCalculationBreakdown(raw, breakdown),
  }
}

export const parseQR = (rawQRString, supplierOrMapping) => {
  const normalizedRaw = normalizeRaw(rawQRString)
  const { supplier, qrMapping } = resolveSupplierContext(supplierOrMapping)
  const supplierForDetection = supplier || (qrMapping ? { qrMapping } : null)
  const isYugSupplier = toText(supplier?.name)?.toLowerCase() === 'yug' || toText(supplier?.code)?.toLowerCase() === 'yug'
  const { candidate, parserConfig } = buildParserCandidates(normalizedRaw, supplierForDetection)
  const strategy = normalizeStrategy(candidate?.strategy || parserConfig?.strategy)

  try {
    const result = runParserByStrategy(strategy, normalizedRaw, parserConfig)

    if (
      candidate?.name === 'default_slash_format' &&
      result?.fields?.category?.parsed &&
      !result?.fields?.meta?.itemCode?.parsed
    ) {
      result.fields.meta.itemCode = {
        value: result.fields.category.value,
        parsed: true,
      }
    }

    const structuralYug = isLikelyYugStructuralRaw(normalizedRaw) || isLikelyYugDelimiterRaw(normalizedRaw) || isLikelyYugRaw(normalizedRaw)
    const shouldEnrichYug = isYugSupplier || structuralYug
    const enrichedResult = shouldEnrichYug
      ? enrichYugParseResult(result, normalizedRaw, supplierForDetection)
      : result
    const confidence = scoreConfidence(candidate, enrichedResult)
    const enrichedConfidence = shouldEnrichYug && structuralYug
      ? Math.min(100, Math.max(confidence, candidate?.source === 'builtin' ? 90 : confidence))
      : confidence

    return {
      ...enrichedResult,
      pattern: {
        name: candidate?.name || null,
        source: candidate?.source || null,
        supplier: normalizeSupplierKey(supplierForDetection),
        strategy,
      },
      confidence: enrichedConfidence,
    }
  } catch (error) {
    return createResult({
      success: false,
      strategy,
      fields: createEmptyFields(),
      errors: [{ field: 'parser', reason: error?.message || 'Failed to parse QR' }],
      raw: normalizedRaw,
      pattern: {
        name: candidate?.name || null,
        source: candidate?.source || null,
        supplier: normalizeSupplierKey(supplier),
        strategy,
      },
      confidence: 0,
    })
  }
}

export const normalizeParsedQR = (parsedResult, supplier) => {
  const raw = normalizeRaw(parsedResult?.raw)
  const supplierName = toText(supplier?.name) || toText(supplier?.code) || ''
  const supplierKey = supplierName.toLowerCase()
  const confidenceValue = Number.isFinite(parsedResult?.confidence) ? parsedResult.confidence : null
  const parseErrors = asErrorList(parsedResult?.errors)
  const errors = []

  const pushError = (field, reason) => {
    errors.push({
      field,
      reason,
    })
  }

  if (!supplierName) {
    pushError('supplier', 'Supplier is required')
  }

  const itemCodePaths = (() => {
    if (supplierKey === 'venzora') {
      return [
        ['itemCode'],
        ['meta', 'itemCode'],
        ['category'],
      ]
    }

    if (supplierKey === 'yug') {
      return [
        ['meta', 'itemCode'],
        ['itemCode'],
        ['category'],
      ]
    }

    if (supplierKey === 'adinath' || supplierKey === 'utsav') {
      return [
        ['category'],
        ['itemCode'],
        ['meta', 'itemCode'],
      ]
    }

    if (supplierKey === 'aayra') {
      // Slash format: itemCode from meta.itemCode (token 0) or designCode
      // Tab format: itemCode from meta.itemCode (field 1 = category text)
      return [
        ['meta', 'itemCode'],
        ['designCode'],
        ['meta', 'designCode'],
        ['category'],
      ]
    }

    return [
      ['itemCode'],
      ['meta', 'itemCode'],
      ['category'],
    ]
  })()

  const itemCode = toText(readParsedValue(parsedResult, itemCodePaths))
  if (!itemCode) {
    pushError('itemCode', 'Item code is required')
  }

  const readNumber = (paths, fieldName, required = false) => {
    const rawValue = readParsedValue(parsedResult, paths)

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      if (required) {
        pushError(fieldName, `${fieldName} is missing`)
      }
      return null
    }

    const parsed = toNumber(rawValue)
    if (parsed === null) {
      pushError(fieldName, `${fieldName} is not a valid number`)
      return null
    }

    return parsed
  }

  const grossWeight = readNumber([['grossWeight']], 'grossWeight', true)
  const stoneWeight = readNumber([['stoneWeight']], 'stoneWeight', false)
  const otherWeight = readNumber([['otherWeight']], 'otherWeight', false)
  const netWeight = readNumber([['netWeight']], 'netWeight', false)
  const stoneAmount = readNumber([['stoneAmount'], ['stone_amount']], 'stoneAmount', false)
  const diamondWeight = readNumber([['diamondWeight']], 'diamondWeight', false)
  const karat = toText(
    readParsedValue(parsedResult, [
      ['karat'],
      ['meta', 'karat'],
    ])
  )
  const purity = toText(
    readParsedValue(parsedResult, [
      ['purity'],
      ['meta', 'purity'],
    ])
  )
  const designCode = toText(
    readParsedValue(parsedResult, [
      ['designCode'],
      ['meta', 'designCode'],
    ])
  )
  const category = toText(
    readParsedValue(parsedResult, [
      ['category'],
      ['colorCategory'],
      ['meta', 'category'],
      ['meta', 'colorCategory'],
    ])
  )
  const normalizedDiamondWeight = diamondWeight ?? stoneWeight

  return {
    supplier: supplierName,
    itemCode: itemCode || null,
    design_code: itemCode || null,
    category: category || null,
    grossWeight,
    gross_weight: grossWeight,
    stoneWeight,
    stone_weight: stoneWeight,
    otherWeight,
    other_weight: otherWeight,
    netWeight,
    net_weight: netWeight,
    purity,
    purity_percent: purity,
    diamondWeight: normalizedDiamondWeight,
    designCode,
    karat,
    stoneAmount,
    stone_amount: stoneAmount,
    confidence: confidenceValue,
    raw,
    calculationBreakdown: cloneValue(parsedResult?.calculationBreakdown ?? null),
    meta: {
      strategy: toText(parsedResult?.strategy) || null,
      pattern: cloneValue(parsedResult?.pattern ?? null),
      confidence: Number.isFinite(parsedResult?.confidence) ? parsedResult.confidence : null,
      parseErrors,
      originalFields: cloneValue(parsedResult?.fields ?? parsedResult ?? {}),
    },
    errors,
  }
}
