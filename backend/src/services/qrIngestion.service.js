const normalizeText = (value) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const parsed = Number.parseFloat(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeConfidenceLabel = (value) => {
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase()
    if (lowered === 'high' || lowered === 'low') {
      return lowered
    }
  }

  const numeric = normalizeNumber(value)
  if (numeric === null) {
    return 'low'
  }

  return numeric >= 70 ? 'high' : 'low'
}

const normalizeCustomFields = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const key = normalizeText(entry.key)
      const normalizedValue = normalizeText(entry.value)

      if (!key && !normalizedValue) {
        return null
      }

      return {
        key: key || 'unknown',
        value: normalizedValue || '',
      }
    })
    .filter(Boolean)
}

const detectDelimiter = (raw) => {
  if (typeof raw !== 'string') {
    return null
  }

  const candidates = ['/', '|', ',', ';', '\n', '\t']
  let best = null
  let bestCount = 0

  for (const delimiter of candidates) {
    const count = raw.split(delimiter).length - 1
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }

  return bestCount > 0 ? best : null
}

const tokenizeRaw = (raw) => {
  if (typeof raw !== 'string') {
    return []
  }

  const delimiter = detectDelimiter(raw)
  const delimiterTokens = delimiter
    ? raw.split(delimiter).map((part) => part.trim()).filter(Boolean)
    : []

  if (delimiterTokens.length > 0) {
    return delimiterTokens
  }

  return raw
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

const flattenErrors = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  const errors = []

  for (const item of value) {
    if (typeof item === 'string') {
      const text = item.trim()
      if (text) {
        errors.push(text)
      }
      continue
    }

    if (item && typeof item === 'object') {
      const field = normalizeText(item.field) || 'unknown'
      const reason = normalizeText(item.reason) || 'Unknown parse error'
      errors.push(`${field}: ${reason}`)
    }
  }

  return [...new Set(errors)]
}

export const buildParsedIngestionData = (normalizedResult, supplier) => ({
  supplier:
    normalizeText(normalizedResult?.supplier) ||
    normalizeText(supplier?.name) ||
    normalizeText(supplier?.code) ||
    '',
  itemCode:
    normalizeText(normalizedResult?.itemCode) ||
    normalizeText(normalizedResult?.design_code) ||
    normalizeText(normalizedResult?.designCode),
  purity:
    normalizeText(normalizedResult?.purity) ||
    normalizeText(normalizedResult?.purity_percent),
  grossWeight:
    normalizeNumber(normalizedResult?.grossWeight) ??
    normalizeNumber(normalizedResult?.gross_weight),
  netWeight:
    normalizeNumber(normalizedResult?.netWeight) ??
    normalizeNumber(normalizedResult?.net_weight),
  diamondWeight:
    normalizeNumber(normalizedResult?.diamondWeight ?? normalizedResult?.stoneWeight) ??
    normalizeNumber(normalizedResult?.stone_weight),
  stoneWeight:
    normalizeNumber(normalizedResult?.stoneWeight) ??
    normalizeNumber(normalizedResult?.stone_weight),
  otherWeight:
    normalizeNumber(normalizedResult?.otherWeight) ??
    normalizeNumber(normalizedResult?.other_weight),
  designCode:
    normalizeText(normalizedResult?.designCode) ||
    normalizeText(normalizedResult?.design_code),
  confidence: normalizeConfidenceLabel(normalizedResult?.confidence),
  errors: flattenErrors([
    ...(Array.isArray(normalizedResult?.errors) ? normalizedResult.errors : []),
    ...(Array.isArray(normalizedResult?.meta?.parseErrors) ? normalizedResult.meta.parseErrors : []),
  ]),
  warnings: [],
})

export const buildUnknownParsedIngestionData = (raw) => {
  const text = normalizeText(raw) || ''
  const tokens = tokenizeRaw(text)
  const itemCode = normalizeText(tokens[0]) || null
  const numericTokens = tokens
    .slice(1)
    .filter((token) => /^-?\d+(?:\.\d+)?$/.test(token))
  const numbers = numericTokens
    .map((value) => normalizeNumber(value))
    .filter((value) => value !== null)

  const grossWeight = numbers[0] ?? null
  const netWeight = numbers[1] ?? null
  const diamondWeight = numbers[2] ?? null
  const purityMatch = text.match(/\b\d{2}(?:KT|K)\b/i)
  const purity = purityMatch ? normalizeText(purityMatch[0].toUpperCase()) : null
  const delimiter = detectDelimiter(text)
  const prefixPatterns = tokens
    .map((token) => token.match(/^[A-Za-z]+(?=[^A-Za-z0-9]|$)/)?.[0])
    .filter(Boolean)
    .map((value) => value.toUpperCase())

  return {
    supplier: 'Unknown',
    itemCode,
    purity,
    grossWeight,
    netWeight,
    diamondWeight,
    designCode: null,
    errors: [],
    warnings: ['Unknown supplier format'],
    confidence: 'low',
    fallback: {
      delimiter,
      prefixPatterns: [...new Set(prefixPatterns)],
      sampleTokens: tokens.slice(0, 8),
      confidence: 'low',
    },
  }
}

export const buildDefaultFinalFromParsed = (parsed) => ({
  itemCode: normalizeText(parsed?.itemCode) || '',
  category: null,
  productId: null,
  purity: normalizeText(parsed?.purity),
  grossWeight: normalizeNumber(parsed?.grossWeight),
  netWeight: normalizeNumber(parsed?.netWeight),
  diamondWeight: normalizeNumber(parsed?.diamondWeight),
  designCode: normalizeText(parsed?.designCode),
  customFields: [],
})

export const buildParsedWarnings = (parsed) => {
  const warnings = []
  const grossWeight = normalizeNumber(parsed?.grossWeight)
  const netWeight = normalizeNumber(parsed?.netWeight)
  const diamondWeight = normalizeNumber(parsed?.diamondWeight)

  if (grossWeight !== null && grossWeight > 0 && netWeight === 0) {
    warnings.push('netWeight is 0 while grossWeight is greater than 0')
  }

  if (
    grossWeight !== null &&
    diamondWeight !== null &&
    diamondWeight > grossWeight
  ) {
    warnings.push('diamondWeight is greater than grossWeight')
  }

  const suspiciousValues = [grossWeight, netWeight, diamondWeight].filter((value) => value !== null)
  if (suspiciousValues.some((value) => value > 1000)) {
    warnings.push('One or more weights are unusually high')
  }

  if (suspiciousValues.some((value) => value > 0 && value < 0.001)) {
    warnings.push('One or more weights are unusually low')
  }

  return [...new Set(warnings)]
}

export const mergeFinalData = (parsed, currentFinal = {}, overrides = {}) => {
  const base = {
    ...buildDefaultFinalFromParsed(parsed),
    ...currentFinal,
  }

  const merged = { ...base }

  for (const key of Object.keys(overrides || {})) {
    const value = overrides[key]
    if (value === undefined) continue

    if (key === 'customFields') {
      merged.customFields = normalizeCustomFields(value)
      continue
    }

    if (['itemCode', 'category', 'productId', 'purity', 'designCode'].includes(key)) {
      merged[key] = normalizeText(value)
      continue
    }

    if (['grossWeight', 'netWeight', 'diamondWeight'].includes(key)) {
      merged[key] = normalizeNumber(value)
    }
  }

  merged.itemCode = normalizeText(merged.itemCode) || ''
  merged.category = normalizeText(merged.category)
  merged.productId = normalizeText(merged.productId)
  merged.purity = normalizeText(merged.purity)
  merged.designCode = normalizeText(merged.designCode)
  merged.grossWeight = normalizeNumber(merged.grossWeight)
  merged.netWeight = normalizeNumber(merged.netWeight)
  merged.diamondWeight = normalizeNumber(merged.diamondWeight)
  merged.customFields = normalizeCustomFields(merged.customFields)

  return merged
}

export const buildUnknownFinalFromParsed = (parsed) => ({
  itemCode: normalizeText(parsed?.itemCode) || '',
  category: null,
  productId: null,
  purity: normalizeText(parsed?.purity),
  grossWeight: normalizeNumber(parsed?.grossWeight),
  netWeight: normalizeNumber(parsed?.netWeight),
  diamondWeight: normalizeNumber(parsed?.diamondWeight),
  designCode: normalizeText(parsed?.designCode),
  customFields: [],
})

export const buildUnknownLearningMetadata = (raw, parsed) => ({
  delimiter: parsed?.fallback?.delimiter || null,
  prefixPatterns: Array.isArray(parsed?.fallback?.prefixPatterns) ? parsed.fallback.prefixPatterns : [],
  sampleTokens: Array.isArray(parsed?.fallback?.sampleTokens) ? parsed.fallback.sampleTokens : [],
  rawPreview: normalizeText(raw)?.slice(0, 120) || '',
  confidence: parsed?.fallback?.confidence || 'low',
})

export const evaluateParsedStatus = (parsed, options = {}) => {
  const issues = [...(Array.isArray(parsed?.errors) ? parsed.errors : [])]
  const warnings = [...(Array.isArray(parsed?.warnings) ? parsed.warnings : [])]

  if (!normalizeText(parsed?.itemCode)) {
    issues.push('itemCode is required')
  }

  if (normalizeNumber(parsed?.grossWeight) === null && normalizeNumber(parsed?.netWeight) === null) {
    issues.push('At least one of grossWeight or netWeight is required')
  }

  if (warnings.length > 0 && options.warningsRequireReview) {
    issues.push(...warnings.map((warning) => `warning: ${warning}`))
  }

  return {
    status: issues.length > 0 ? 'needs_review' : 'approved',
    issues,
  }
}

export const validateFinalData = (final) => {
  const errors = []

  if (!normalizeText(final?.itemCode)) {
    errors.push('itemCode is required')
  }

  if (normalizeNumber(final?.grossWeight) === null && normalizeNumber(final?.netWeight) === null) {
    errors.push('At least one of grossWeight or netWeight is required')
  }

  return errors
}
