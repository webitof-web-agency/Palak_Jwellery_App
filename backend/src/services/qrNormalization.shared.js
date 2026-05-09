import { roundPercentage } from './precision.service.js'

const toText = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  const text = String(value).trim()
  return text ? text : null
}

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'boolean') {
    return null
  }

  const parsed = Number.parseFloat(String(value).trim().replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

const getPathValue = (source, path) => {
  if (!source || typeof source !== 'object') {
    return null
  }

  const segments = Array.isArray(path)
    ? path
    : String(path)
        .split('.')
        .map((segment) => segment.trim())
        .filter(Boolean)

  let current = source
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null
    }

    current = current[segment]
  }

  return current
}

const readFieldValue = (source, keys = []) => {
  if (!source || typeof source !== 'object') {
    return null
  }

  for (const key of keys) {
    if (key === null || key === undefined) {
      continue
    }

    const value = getPathValue(source, key)
    if (value !== null && value !== undefined) {
      return value
    }
  }

  return null
}

const unwrapParsedValue = (value) => {
  if (value && typeof value === 'object' && 'parsed' in value && 'value' in value) {
    return value.parsed ? value.value ?? null : null
  }

  return value ?? null
}

const readExtractedValue = (parsedResult, keys = []) => {
  const extracted = parsedResult?.extracted
  const fields = parsedResult?.fields
  const meta = parsedResult?.meta

  const sources = [extracted, fields, parsedResult, meta]

  for (const source of sources) {
    const value = readFieldValue(source, keys)
    const unwrapped = unwrapParsedValue(value)
    if (unwrapped !== null && unwrapped !== undefined) {
      return unwrapped
    }
  }

  return null
}

const parsePurity = (value) => {
  const text = toText(value)
  if (!text) {
    return null
  }

  const normalized = text.toUpperCase()
  const karatMatch = normalized.match(/(\d{1,2}(?:\.\d+)?)\s*(?:KT|K)\b/)
  if (karatMatch) {
    const karat = toNumber(karatMatch[1])
    return karat === null ? null : roundPercentage((karat / 24) * 100)
  }

  const percentMatch = normalized.match(/(\d{1,3}(?:\.\d+)?)\s*%/)
  if (percentMatch) {
    return roundPercentage(toNumber(percentMatch[1]))
  }

  return null
}

const parseWeight = (value) => toNumber(value)

const resolveSupplierName = (parsedResult, supplier) => {
  return (
    toText(supplier?.name) ||
    toText(supplier?.code) ||
    toText(parsedResult?.supplier) ||
    toText(parsedResult?.meta?.supplier) ||
    'Unknown'
  )
}

const normalizeNull = (value) => (value === undefined ? null : value)

export {
  getPathValue,
  normalizeNull,
  parsePurity,
  parseWeight,
  readExtractedValue,
  readFieldValue,
  resolveSupplierName,
  toNumber,
  toText,
  unwrapParsedValue,
}
