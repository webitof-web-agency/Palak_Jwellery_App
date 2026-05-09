import {
  FIELD_KEYS,
  TEXT_FIELDS,
  createEmptyFields,
  createResult,
  normalizeRaw,
  toNumber,
  toText,
} from './qrParser.shared.js'
import {
  VENZORA_TOKEN_PATTERNS,
  YUG_LINE_PATTERN,
  isLikelyUtsavRaw,
  normalizeYugRaw,
} from './qrParser.patterns.js'

const resolveFieldConfig = (value) => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return { indices: [value], stripPrefix: null }
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isInteger(n) && n >= 0) return { indices: [n], stripPrefix: null }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const stripPrefix = typeof value.stripPrefix === 'string' ? value.stripPrefix : null

    if (Array.isArray(value.sumIndices)) {
      const indices = value.sumIndices.filter((i) => Number.isInteger(i) && i >= 0)
      if (indices.length > 0) return { indices, stripPrefix }
    }

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
      if (isText) {
        errors.push({ field, reason: 'sumIndices is not valid for text fields' })
        continue
      }

      let total = 0
      let broken = false

      for (const idx of indices) {
        const rawVal = parts[idx]
        if (rawVal === undefined || String(rawVal).trim() === '') continue

        const val = applyStripPrefix(String(rawVal).trim(), stripPrefix)
        const n = toNumber(val)

        if (n === null) {
          errors.push({ field, reason: `Expected number at index ${idx}, got '${val}'` })
          broken = true
          break
        }

        total += n
      }

      if (!broken) {
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

  if (otherWeight !== null) {
    fields.otherWeight = { value: otherWeight, parsed: true }
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

const runParserByStrategy = (strategy, raw, parserConfig) => {
  if (strategy === 'key_value') {
    return parseKeyValueStrategy(raw)
  }

  if (strategy === 'venzora') {
    return parseVenzoraStrategy(raw).data
  }

  return parseDelimiterStrategy(raw, parserConfig)
}

export {
  applyStripPrefix,
  parseDelimiterStrategy,
  parseKeyValueStrategy,
  parseVenzoraStrategy,
  resolveFieldConfig,
  runParserByStrategy,
}
