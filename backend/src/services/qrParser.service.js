const FIELD_KEYS = ['supplierCode', 'category', 'grossWeight', 'stoneWeight', 'netWeight']
const TEXT_FIELDS = new Set(['supplierCode', 'category'])
const SUPPORTED_STRATEGIES = new Set(['delimiter', 'key_value', 'venzora'])

const createEmptyFields = () => ({
  supplierCode: { value: null, parsed: false },
  category: { value: null, parsed: false },
  grossWeight: { value: null, parsed: false },
  stoneWeight: { value: null, parsed: false },
  netWeight: { value: null, parsed: false },
  purity: { value: null, parsed: false },
  diamondWeight: { value: null, parsed: false },
  designCode: { value: null, parsed: false },
  meta: {
    itemCode: { value: null, parsed: false },
  },
})

const normalizeRaw = (raw) => (typeof raw === 'string' ? raw.trim() : '')

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (value === null || value === undefined) return null
  const cleaned = String(value).trim().replace(/,/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const toText = (value) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

const createResult = ({ success, strategy, fields, errors, raw }) => ({
  success,
  strategy,
  fields,
  errors,
  raw,
})

const cloneValue = (value) => {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Fall through to JSON cloning.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return Array.isArray(value) ? [...value] : { ...value }
  }
}

const getPathValue = (source, path) => {
  if (!source || typeof source !== 'object') {
    return null
  }

  let current = source
  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null
    }

    current = current[segment]
  }

  return current
}

const unwrapParsedValue = (value) => {
  if (value && typeof value === 'object' && 'parsed' in value && 'value' in value) {
    return value.parsed ? value.value ?? null : null
  }

  return value ?? null
}

const readParsedValue = (parsedResult, paths) => {
  for (const path of paths) {
    const fromFields = unwrapParsedValue(getPathValue(parsedResult?.fields, path))
    if (fromFields !== null && fromFields !== undefined) {
      return fromFields
    }

    const fromTopLevel = unwrapParsedValue(getPathValue(parsedResult, path))
    if (fromTopLevel !== null && fromTopLevel !== undefined) {
      return fromTopLevel
    }
  }

  return null
}

const asErrorList = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      field: toText(item.field) || 'unknown',
      reason: toText(item.reason) || 'Unknown parse error',
    }))
}

// ── Field config resolution ───────────────────────────────────────────────────
//
// fieldMap values can be:
//   3                               legacy integer index
//   { index: 3 }                    single index
//   { index: 1, stripPrefix: 'GWT-' }   single index with label stripping (Utsav)
//   { sumIndices: [1, 2] }          sum multiple indices into one value (Aadinath, YUG)
//
// Returns { indices: number[], stripPrefix: string|null } or null if invalid.

const resolveFieldConfig = (value) => {
  // Legacy: plain integer
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return { indices: [value], stripPrefix: null }
  }

  // Legacy: numeric string
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isInteger(n) && n >= 0) return { indices: [n], stripPrefix: null }
  }

  // Object form
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const stripPrefix = typeof value.stripPrefix === 'string' ? value.stripPrefix : null

    // sumIndices form
    if (Array.isArray(value.sumIndices)) {
      const indices = value.sumIndices.filter((i) => Number.isInteger(i) && i >= 0)
      if (indices.length > 0) return { indices, stripPrefix }
    }

    // Single index form
    if (Number.isInteger(value.index) && value.index >= 0) {
      return { indices: [value.index], stripPrefix }
    }
  }

  return null
}

const applyStripPrefix = (str, prefix) => {
  if (!prefix) return str
  if (str.toUpperCase().startsWith(prefix.toUpperCase())) {
    return str.slice(prefix.length).trim()
  }
  return str
}

const YUG_LABELS = ['GW', 'SS', 'MS', 'OW', 'NW', 'KT']
const YUG_LINE_PATTERN = new RegExp(`^\\s*(?:${YUG_LABELS.join('|')})\\b`, 'i')
const ADINATH_PATTERN = /\/\/\/\/\//
const ADINATH_ITEM_CODE_PATTERN = /(?:TM|BG|LR)-\d+/i
const VENZORA_PATTERN = /CH-[A-Z0-9]+/i
const VENZORA_TOKEN_PATTERNS = {
  grossWeight: /^G\d+(\.\d+)?$/,
  netWeight: /^N\d+(\.\d+)?$/,
  diamondWeight: /^L\d+(\.\d+)?$/,
  designCode: /^CH-[A-Z0-9]+$/,
}

const normalizeStrategy = (strategy) => {
  const value = toText(strategy)?.toLowerCase()

  if (value === 'labeled') {
    return 'key_value'
  }

  if (SUPPORTED_STRATEGIES.has(value)) {
    return value
  }

  return 'delimiter'
}

const normalizeYugRaw = (raw) => {
  const text = normalizeRaw(raw)
  if (!text) return ''

  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\s+(?=(?:GW|SS|MS|OW|NW|KT)\b)/gi, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

const isLikelyYugRaw = (raw) => {
  const text = normalizeYugRaw(raw)
  if (!text) return false

  const labelHits = YUG_LABELS.reduce((count, label) => {
    const matchCount = (text.match(new RegExp(`\\b${label}\\b`, 'gi')) || []).length
    return count + matchCount
  }, 0)

  return labelHits >= 2 && /(?:[:\-]|\s)\s*\d/.test(text)
}

const isLikelyAdinathRaw = (raw) => {
  const text = normalizeRaw(raw)
  return ADINATH_PATTERN.test(text) && ADINATH_ITEM_CODE_PATTERN.test(text)
}

const isLikelyUtsavRaw = (raw) => {
  const text = normalizeRaw(raw)
  return /^[A-Z]+-\d+/i.test(text) && /GWT-/i.test(text) && /NWT-/i.test(text) && /SWT-/i.test(text)
}

const isLikelyVenzoraRaw = (raw) => {
  const text = normalizeRaw(raw)
  const tokens = text.split('/').map((part) => part.trim()).filter(Boolean)
  const hasItemCode = tokens.length > 0 && /^[A-Za-z0-9]+$/.test(tokens[0])
  const hasPurity = tokens.some((token) => token.toUpperCase() === '18KT')
  const hasGrossPrefix = tokens.some((token) => token.toUpperCase().startsWith('G'))
  const hasNetPrefix = tokens.some((token) => token.toUpperCase().startsWith('N'))
  const hasDiamondPrefix = tokens.some((token) => token.toUpperCase().startsWith('L'))

  return hasItemCode && hasPurity && hasGrossPrefix && hasNetPrefix && hasDiamondPrefix
}

// ── Delimiter strategy ────────────────────────────────────────────────────────

const parseDelimiterStrategy = (raw, supplierQRMappingConfig) => {
  const strategy = 'delimiter'
  const errors = []
  const fields = createEmptyFields()

  if (!raw) {
    errors.push({ field: 'raw', reason: 'Empty QR' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  if (!supplierQRMappingConfig || supplierQRMappingConfig.strategy !== 'delimiter') {
    errors.push({ field: 'qrMapping', reason: 'No delimiter mapping config for supplier' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  const delimiter = toText(supplierQRMappingConfig.delimiter) || '|'
  const parts = raw.split(delimiter)
  const fieldMap = supplierQRMappingConfig.fieldMap || {}
  let parsedCount = 0

  if (delimiter === '/' && isLikelyUtsavRaw(raw)) {
    const tokens = parts.map((part) => String(part).trim()).filter((part) => part)
    const getTokenValue = (prefix) => {
      const token = tokens.find((part) => part.toUpperCase().startsWith(prefix))
      if (!token) return null
      const value = token.slice(prefix.length).trim()
      return toText(value)
    }

    const grossRaw = getTokenValue('GWT-')
    const netRaw = getTokenValue('NWT-')
    const stoneRaw = getTokenValue('SWT-')
    const categoryRaw = tokens.find((part) => /^[A-Z]+-\d+/i.test(part)) || null
    const supplierCodeRaw = tokens.find((part) => part.toUpperCase() === 'USV') || null

    if (grossRaw === null) {
      errors.push({ field: 'grossWeight', reason: 'GWT is missing' })
    } else {
      const parsed = toNumber(grossRaw)
      if (parsed === null) {
        errors.push({ field: 'grossWeight', reason: `Expected number for GWT, got '${grossRaw}'` })
      } else {
        fields.grossWeight = { value: parsed, parsed: true }
      }
    }

    const stoneParsed = stoneRaw === null ? 0 : toNumber(stoneRaw)
    if (stoneRaw !== null && stoneParsed === null) {
      errors.push({ field: 'stoneWeight', reason: `Expected number for SWT, got '${stoneRaw}'` })
    } else {
      fields.stoneWeight = { value: stoneParsed ?? 0, parsed: true }
    }

    if (netRaw !== null) {
      const parsed = toNumber(netRaw)
      if (parsed === null) {
        errors.push({ field: 'netWeight', reason: `Expected number for NWT, got '${netRaw}'` })
      } else {
        fields.netWeight = { value: parsed, parsed: true }
      }
    }

    if (categoryRaw) {
      fields.category = { value: categoryRaw, parsed: true }
    } else {
      errors.push({ field: 'category', reason: 'TM- item code is missing' })
    }

    if (supplierCodeRaw) {
      fields.supplierCode = { value: supplierCodeRaw, parsed: true }
    }

    const parsedCountUtsav = ['grossWeight', 'stoneWeight', 'netWeight', 'category'].reduce(
      (count, field) => count + (fields[field].parsed ? 1 : 0),
      0
    )

    return createResult({
      success: parsedCountUtsav > 0,
      strategy,
      fields,
      errors,
      raw,
    })
  }

  for (const field of FIELD_KEYS) {
    const config = resolveFieldConfig(fieldMap[field])

    if (config === null) {
      if (field === 'supplierCode') {
        continue
      }
      errors.push({ field, reason: 'Invalid or missing field mapping' })
      continue
    }

    const { indices, stripPrefix } = config
    const isText = TEXT_FIELDS.has(field)

    if (indices.length === 1) {
      // ── Single index ────────────────────────────────────────────────────────
      const rawVal = parts[indices[0]]

      if (rawVal === undefined || String(rawVal).trim() === '') {
        errors.push({ field, reason: `Missing value at index ${indices[0]}` })
        continue
      }

      const val = applyStripPrefix(String(rawVal).trim(), stripPrefix)

      if (isText) {
        const parsed = toText(val)
        if (parsed === null) {
          errors.push({ field, reason: `Expected text at index ${indices[0]}` })
          continue
        }
        fields[field] = { value: parsed, parsed: true }
      } else {
        const parsed = toNumber(val)
        if (parsed === null) {
          errors.push({ field, reason: `Expected number at index ${indices[0]}, got '${val}'` })
          continue
        }
        fields[field] = { value: parsed, parsed: true }
      }
    } else {
      // ── sumIndices — numeric fields only ────────────────────────────────────
      if (isText) {
        errors.push({ field, reason: 'sumIndices is not valid for text fields' })
        continue
      }

      let total = 0
      let atLeastOne = false
      let broken = false

      for (const idx of indices) {
        const rawVal = parts[idx]
        // Empty slot in a sum = treat as 0 (e.g. B field empty when no big stones)
        if (rawVal === undefined || String(rawVal).trim() === '') continue

        const val = applyStripPrefix(String(rawVal).trim(), stripPrefix)
        const n = toNumber(val)

        if (n === null) {
          errors.push({ field, reason: `Expected number at index ${idx}, got '${val}'` })
          broken = true
          break
        }

        total += n
        atLeastOne = true
      }

      if (!broken) {
        // Even if all slots were empty (total=0, atLeastOne=false), record 0 as parsed
        fields[field] = {
          value: Math.round(total * 1000) / 1000,
          parsed: true,
        }
      }
    }

    if (fields[field].parsed) parsedCount += 1
  }

  return createResult({
    success: parsedCount > 0,
    strategy,
    fields,
    errors,
    raw,
  })
}

const parseVenzoraStrategy = (raw) => {
  const strategy = 'venzora'
  const errors = []
  const fields = createEmptyFields()

  if (!raw) {
    errors.push('Empty QR')
    return { data: createResult({ success: false, strategy, fields, errors: [{ field: 'raw', reason: 'Empty QR' }], raw }), errors }
  }

  const tokens = raw
    .split('/')
    .map((part) => String(part).trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    errors.push('Empty QR')
    return { data: createResult({ success: false, strategy, fields, errors: [{ field: 'raw', reason: 'Empty QR' }], raw }), errors }
  }

  const itemCode = tokens[0] ? toText(tokens[0].toUpperCase()) : null
  if (itemCode) {
    fields.meta.itemCode = { value: itemCode, parsed: true }
  } else {
    errors.push('Item code is missing')
  }

  let purity = null
  let grossWeight = null
  let netWeight = null
  let diamondWeight = null
  let designCode = null
  const parseErrors = []

  const addTokenError = (field, token, reason) => {
    const message = `${field}: ${reason}`
    errors.push(message)
    parseErrors.push({ field, reason: `${reason} (${token})` })
  }

  const parseStrictNumber = (token, field, pattern) => {
    if (!pattern.test(token)) {
      addTokenError(field, token, `Invalid ${field === 'diamondWeight' ? 'L' : field === 'netWeight' ? 'N' : 'G'} token`)
      return null
    }

    const numericPart = token.slice(1)
    const parsed = Number.parseFloat(numericPart)
    if (!Number.isFinite(parsed)) {
      addTokenError(field, token, `Invalid ${field} numeric value`)
      return null
    }

    return parsed
  }

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const normalizedToken = token.toUpperCase()

    if (normalizedToken === '18KT') {
      purity = '18KT'
      continue
    }

    if (normalizedToken.startsWith('RS')) {
      continue
    }

    if (normalizedToken.startsWith('CH-')) {
      if (!VENZORA_TOKEN_PATTERNS.designCode.test(normalizedToken)) {
        addTokenError('designCode', token, 'Invalid CH token')
      } else {
        designCode = normalizedToken
      }
      continue
    }

    if (normalizedToken.startsWith('G')) {
      const parsed = parseStrictNumber(normalizedToken, 'grossWeight', VENZORA_TOKEN_PATTERNS.grossWeight)
      if (parsed !== null) {
        grossWeight = parsed
      }
      continue
    }

    if (normalizedToken.startsWith('N')) {
      const parsed = parseStrictNumber(normalizedToken, 'netWeight', VENZORA_TOKEN_PATTERNS.netWeight)
      if (parsed !== null) {
        netWeight = parsed
      }
      continue
    }

    if (normalizedToken.startsWith('L')) {
      const parsed = parseStrictNumber(normalizedToken, 'diamondWeight', VENZORA_TOKEN_PATTERNS.diamondWeight)
      if (parsed !== null) {
        diamondWeight = parsed
      }
      continue
    }
  }

  if (grossWeight !== null) {
    fields.grossWeight = { value: grossWeight, parsed: true }
  }
  if (netWeight !== null) {
    fields.netWeight = { value: netWeight, parsed: true }
  }
  if (diamondWeight !== null) {
    fields.diamondWeight = { value: diamondWeight, parsed: true }
    fields.stoneWeight = { value: diamondWeight, parsed: true }
  }
  if (purity !== null) {
    fields.purity = { value: purity, parsed: true }
  }
  if (designCode !== null) {
    fields.designCode = { value: designCode, parsed: true }
  }

  if (grossWeight === null) {
    errors.push('Gross weight is missing')
    parseErrors.push({ field: 'grossWeight', reason: 'G is missing' })
  }

  if (!designCode) {
    errors.push('Design code is missing')
    parseErrors.push({ field: 'designCode', reason: 'CH is missing' })
  }

  const data = createResult({
    success:
      Boolean(itemCode) &&
      grossWeight !== null &&
      netWeight !== null &&
      diamondWeight !== null &&
      designCode !== null,
    strategy,
    fields,
    errors: parseErrors,
    raw,
  })

  return { data, errors }
}

// â”€â”€ Key-value strategy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Supports label-style QR text like:
// GW : 3.750
// SS:0.000
// MS - 0.197
// KT - 18K
//
// category is mapped to the first non-label line / item code.

const parseKeyValueStrategy = (raw) => {
  const strategy = 'key_value'
  const errors = []
  const fields = createEmptyFields()

  if (!raw) {
    errors.push({ field: 'raw', reason: 'Empty QR' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  const normalized = normalizeYugRaw(raw)
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    errors.push({ field: 'raw', reason: 'Empty QR' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  const itemCodeLine = lines.find((line) => !YUG_LINE_PATTERN.test(line))
  const itemCode = itemCodeLine ? toText(itemCodeLine.replace(/[\s:\-]+$/, '')) : null

  if (itemCode) {
    fields.meta.itemCode = { value: itemCode, parsed: true }
  } else {
    errors.push({ field: 'meta.itemCode', reason: 'Item code is missing' })
  }

  const extractValue = (key) => {
    for (const line of lines) {
      const pattern = new RegExp(
        `^\\s*${key}\\s*(?:[:\\-]?\\s*)?(.+?)\\s*$`,
        'i'
      )
      const match = line.match(pattern)
      if (match) {
        return toText(match[1])
      }
    }

    return null
  }

  const parseRequiredNumber = (key, fieldName) => {
    const rawValue = extractValue(key)

    if (rawValue === null) {
      errors.push({ field: fieldName, reason: `${key} is missing` })
      return null
    }

    const parsed = toNumber(rawValue)
    if (parsed === null) {
      errors.push({ field: fieldName, reason: `${key} is not a valid number` })
      return null
    }

    return parsed
  }

  const parseOptionalNumber = (key, fieldName) => {
    const rawValue = extractValue(key)

    if (rawValue === null) {
      return null
    }

    const parsed = toNumber(rawValue)
    if (parsed === null) {
      errors.push({ field: fieldName, reason: `${key} is not a valid number` })
      return null
    }

    return parsed
  }

  const grossWeight = parseRequiredNumber('GW', 'grossWeight')
  const smallStoneWeight = parseOptionalNumber('SS', 'SS')
  const mainStoneWeight = parseOptionalNumber('MS', 'MS')
  const otherWeight = parseOptionalNumber('OW', 'OW')

  if (grossWeight !== null) {
    fields.grossWeight = { value: grossWeight, parsed: true }
  }

  const stoneParts = [smallStoneWeight, mainStoneWeight].filter((value) => typeof value === 'number')
  if (stoneParts.length > 0) {
    fields.stoneWeight = {
      value: Math.round(stoneParts.reduce((sum, value) => sum + value, 0) * 1000) / 1000,
      parsed: true,
    }
  }

  const nwRaw = extractValue('NW')
  if (nwRaw !== null) {
    const parsed = toNumber(nwRaw)
    if (parsed === null) {
      errors.push({ field: 'netWeight', reason: 'NW is not a valid number' })
    } else {
      fields.netWeight = { value: parsed, parsed: true }
    }
  } else if (
    grossWeight !== null &&
    (smallStoneWeight !== null || mainStoneWeight !== null || otherWeight !== null)
  ) {
    const computedNetWeight =
      grossWeight -
      (smallStoneWeight ?? 0) -
      (mainStoneWeight ?? 0) -
      (otherWeight ?? 0)

    fields.netWeight = {
      value: Math.round(computedNetWeight * 1000) / 1000,
      parsed: true,
    }
  } else {
    errors.push({
      field: 'netWeight',
      reason: 'NW is missing and cannot be calculated from GW, SS, MS, OW',
    })
  }

  const ktRaw = extractValue('KT')
  if (ktRaw !== null) {
    const parsed = toText(ktRaw)
    if (parsed === null) {
      errors.push({ field: 'karat', reason: 'KT is missing' })
    }
  } else {
    errors.push({ field: 'karat', reason: 'KT is missing' })
  }

  const parsedCount = FIELD_KEYS.reduce(
    (count, field) => count + (fields[field].parsed ? 1 : 0),
    0
  )

  return createResult({
    success: parsedCount > 0,
    strategy,
    fields,
    errors,
    raw,
  })
}

// ── Supplier auto-detection ───────────────────────────────────────────────────

const getDetectionToken = (supplier, mode) => {
  const detectionPattern = supplier?.detectionPattern || {}
  const pattern = toText(detectionPattern.pattern)
  const code = toText(supplier?.code)

  if (detectionPattern.type === mode && pattern) {
    return pattern
  }

  return code
}

const matchesRegex = (raw, supplier) => {
  const detectionPattern = supplier?.detectionPattern || {}
  if (detectionPattern.type !== 'regex') return false

  const pattern = toText(detectionPattern.pattern)
  if (!pattern) return false

  try {
    return new RegExp(pattern, 'i').test(raw)
  } catch {
    return false
  }
}

const matchesContains = (raw, supplier) => {
  const token = getDetectionToken(supplier, 'contains')
  if (!token) return false
  return raw.toLowerCase().includes(token.toLowerCase())
}

const matchesPrefix = (raw, supplier) => {
  const token = getDetectionToken(supplier, 'prefix')
  if (!token) return false
  return raw.toLowerCase().startsWith(token.toLowerCase())
}

export const detectSupplier = (rawQRString, suppliers = []) => {
  const raw = normalizeRaw(rawQRString)
  if (!raw || !Array.isArray(suppliers) || suppliers.length === 0) return null

  const venzoraMatch = suppliers.find((supplier) => {
    if (!isLikelyVenzoraRaw(raw)) return false

    const supplierName = toText(supplier?.name)?.toLowerCase()
    const supplierCode = toText(supplier?.code)?.toLowerCase()
    const strategy = toText(supplier?.qrMapping?.strategy)?.toLowerCase()

    return supplierName === 'venzora' || supplierCode === 'venzora' || strategy === 'venzora'
  })
  if (venzoraMatch) return { supplier: venzoraMatch, matchType: 'contains' }

  const utsavMatch = suppliers.find(
    (supplier) => supplier?.name?.toLowerCase() === 'utsav' && isLikelyUtsavRaw(raw)
  )
  if (utsavMatch) return { supplier: utsavMatch, matchType: 'contains' }

  const adinathMatch = suppliers.find((supplier) => {
    if (!isLikelyAdinathRaw(raw)) return false

    const supplierName = toText(supplier?.name)?.toLowerCase()
    const supplierCode = toText(supplier?.code)?.toLowerCase()

    return supplierName === 'adinath' ||
      supplierName === 'aadinath' ||
      supplierCode === 'adinath' ||
      supplierCode === 'aadinath'
  })
  if (adinathMatch) return { supplier: adinathMatch, matchType: 'contains' }

  const regexMatch = suppliers.find((supplier) => matchesRegex(raw, supplier))
  if (regexMatch) return { supplier: regexMatch, matchType: 'regex' }

  const containsMatch = suppliers.find((supplier) => matchesContains(raw, supplier))
  if (containsMatch) return { supplier: containsMatch, matchType: 'contains' }

  const prefixMatch = suppliers.find((supplier) => matchesPrefix(raw, supplier))
  if (prefixMatch) return { supplier: prefixMatch, matchType: 'prefix' }

  return null
}

export const parseQR = (rawQRString, supplierQRMappingConfig) => {
  const strategy = isLikelyYugRaw(rawQRString)
    ? 'key_value'
    : isLikelyVenzoraRaw(rawQRString)
      ? 'venzora'
    : normalizeStrategy(supplierQRMappingConfig?.strategy)

  try {
    if (strategy === 'key_value') {
      return parseKeyValueStrategy(normalizeRaw(rawQRString))
    }

    if (strategy === 'venzora') {
      return parseVenzoraStrategy(normalizeRaw(rawQRString)).data
    }

    return parseDelimiterStrategy(normalizeRaw(rawQRString), supplierQRMappingConfig)
  } catch (error) {
    return createResult({
      success: false,
      strategy,
      fields: createEmptyFields(),
      errors: [{ field: 'parser', reason: error?.message || 'Failed to parse QR' }],
      raw: normalizeRaw(rawQRString),
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
    netWeight,
    purity,
    diamondWeight: normalizedDiamondWeight,
    designCode,
    karat,
    raw,
    meta: {
      strategy: toText(parsedResult?.strategy) || null,
      parseErrors,
      originalFields: cloneValue(parsedResult?.fields ?? parsedResult ?? {}),
    },
    errors,
  }
}
