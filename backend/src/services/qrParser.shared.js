const FIELD_KEYS = ['supplierCode', 'category', 'grossWeight', 'stoneWeight', 'netWeight']
const TEXT_FIELDS = new Set(['supplierCode', 'category'])
const SUPPORTED_STRATEGIES = new Set(['delimiter', 'key_value', 'venzora'])

const createEmptyFields = () => ({
  supplierCode: { value: null, parsed: false },
  category: { value: null, parsed: false },
  grossWeight: { value: null, parsed: false },
  stoneWeight: { value: null, parsed: false },
  netWeight: { value: null, parsed: false },
  otherWeight: { value: null, parsed: false },
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

const createResult = ({ success, strategy, fields, errors, raw, pattern = null, confidence = null }) => ({
  success,
  strategy,
  fields,
  errors,
  raw,
  pattern,
  confidence,
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

const normalizeSupplierKey = (supplier) =>
  toText(supplier?.code) || toText(supplier?.name) || ''

export {
  FIELD_KEYS,
  TEXT_FIELDS,
  SUPPORTED_STRATEGIES,
  asErrorList,
  cloneValue,
  createEmptyFields,
  createResult,
  getPathValue,
  normalizeRaw,
  normalizeSupplierKey,
  readParsedValue,
  toNumber,
  toText,
  unwrapParsedValue,
}
