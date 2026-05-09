import { asErrorList, cloneValue, createEmptyFields, createResult, normalizeRaw, normalizeSupplierKey, readParsedValue, toNumber, toText } from './qrParser.shared.js'
import { buildParserCandidates, scoreConfidence } from './qrParser.config.js'
import { detectSupplier } from './qrParser.detection.js'
import { runParserByStrategy } from './qrParser.strategies.js'
import { normalizeStrategy } from './qrParser.patterns.js'

export { detectSupplier }

export const parseQR = (rawQRString, supplierQRMappingConfig) => {
  const normalizedRaw = normalizeRaw(rawQRString)
  const supplier = supplierQRMappingConfig && typeof supplierQRMappingConfig === 'object'
    ? { qrMapping: supplierQRMappingConfig }
    : null
  const { candidate, parserConfig } = buildParserCandidates(normalizedRaw, supplier)
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

    const confidence = scoreConfidence(candidate, result)

    return {
      ...result,
      pattern: {
        name: candidate?.name || null,
        source: candidate?.source || null,
        supplier: normalizeSupplierKey(supplier),
        strategy,
      },
      confidence,
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
  const normalizedDiamondWeight = diamondWeight ?? stoneWeight

  return {
    supplier: supplierName,
    itemCode: itemCode || null,
    category: null,
    grossWeight,
    stoneWeight,
    otherWeight,
    netWeight,
    purity,
    diamondWeight: normalizedDiamondWeight,
    designCode,
    karat,
    raw,
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
