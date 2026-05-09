import {
  normalizeRaw,
  normalizeSupplierKey,
  toText,
} from './qrParser.shared.js'
import {
  isLikelyAdinathRaw,
  isLikelyUtsavRaw,
  isLikelyVenzoraRaw,
  isLikelyYugDelimiterRaw,
  isLikelyYugRaw,
  normalizeStrategy,
  YUG_FALLBACK_MAPPING,
} from './qrParser.patterns.js'

const normalizeParserPatternType = (value) => {
  const text = toText(value)?.toLowerCase()
  return ['regex', 'contains', 'prefix'].includes(text) ? text : null
}

const normalizeParserPatternMatcher = (input) => {
  if (!input) {
    return null
  }

  if (typeof input === 'function') {
    return input
  }

  if (typeof input === 'string') {
    return { type: 'regex', pattern: input }
  }

  if (typeof input !== 'object') {
    return null
  }

  const type = normalizeParserPatternType(input.type || input.matchType || input.mode)
  const pattern = toText(input.pattern || input.value || input.regex)

  if (!type || !pattern) {
    return null
  }

  if (type === 'regex') {
    try {
      const regex = new RegExp(pattern, 'i')
      return (raw) => regex.test(raw)
    } catch {
      return null
    }
  }

  if (type === 'contains') {
    return (raw) => raw.toLowerCase().includes(pattern.toLowerCase())
  }

  if (type === 'prefix') {
    return (raw) => raw.toLowerCase().startsWith(pattern.toLowerCase())
  }

  return null
}

const buildParserConfig = (strategy, source = {}, supplier = null) => {
  const normalizedStrategy = normalizeStrategy(strategy)

  if (normalizedStrategy === 'key_value') {
    return { strategy: 'key_value' }
  }

  if (normalizedStrategy === 'venzora') {
    return { strategy: 'venzora' }
  }

  const fallbackMapping = supplier?.code ? getDefaultParserConfig(normalizeSupplierKey(supplier)) : null
  const delimiter = toText(source.delimiter) || toText(source.symbol) || source.delimiter || fallbackMapping?.delimiter || '|'
  const fieldMap = source.fieldMap || fallbackMapping?.fieldMap || {}

  return {
    strategy: 'delimiter',
    delimiter,
    fieldMap,
  }
}

const normalizeParserVariant = (variant, index, supplier = null) => {
  if (!variant || typeof variant !== 'object') {
    return null
  }

  const name = toText(variant.name) || `variant_${index + 1}`
  const matcher = normalizeParserPatternMatcher(
    variant.detectionPattern ||
      variant.match ||
      variant.matcher ||
      variant.pattern ||
      variant.regex
  )
  const strategy = normalizeStrategy(variant.strategy || variant.parsingStrategy || supplier?.qrMapping?.strategy)
  const priority = Number.isInteger(variant.priority) ? variant.priority : index + 1

  if (!matcher) {
    return null
  }

  return {
    name,
    strategy,
    priority,
    matcher,
    source: 'config',
    parserConfig: buildParserConfig(strategy, variant, supplier),
  }
}

const getDefaultParserConfig = (supplierKey) => {
  switch (supplierKey) {
    case 'yug':
      return YUG_FALLBACK_MAPPING
    case 'adinath':
    case 'aadinath':
      return {
        strategy: 'delimiter',
        delimiter: '/',
        fieldMap: {
          grossWeight: 0,
          stoneWeight: 1,
          netWeight: 6,
          category: 7,
        },
      }
    case 'utsav':
      return {
        strategy: 'delimiter',
        delimiter: '/',
        fieldMap: {
          supplierCode: { index: 8, stripPrefix: '' },
          category: 0,
          grossWeight: { index: 1, stripPrefix: 'GWT-' },
          stoneWeight: { index: 3, stripPrefix: 'SWT-' },
          netWeight: { index: 2, stripPrefix: 'NWT-' },
        },
      }
    case 'venzora':
      return {
        strategy: 'venzora',
        delimiter: '/',
        fieldMap: {
          category: 0,
          grossWeight: 2,
          stoneWeight: 3,
          netWeight: 4,
        },
      }
    default:
      return null
  }
}

const getBuiltInPatternVariants = (supplierKey) => {
  switch (supplierKey) {
    case 'yug':
      return [
        {
          name: 'default_slash_format',
          priority: 1,
          strategy: 'delimiter',
          matcher: (raw) => isLikelyYugDelimiterRaw(raw),
          parserConfig: YUG_FALLBACK_MAPPING,
          source: 'builtin',
        },
        {
          name: 'extended_label_format',
          priority: 2,
          strategy: 'key_value',
          matcher: (raw) => isLikelyYugRaw(raw),
          parserConfig: { strategy: 'key_value' },
          source: 'builtin',
        },
      ]
    case 'adinath':
    case 'aadinath':
      return [
        {
          name: 'sparse_delimiter_format',
          priority: 1,
          strategy: 'delimiter',
          matcher: (raw) => isLikelyAdinathRaw(raw),
          parserConfig: getDefaultParserConfig('adinath'),
          source: 'builtin',
        },
      ]
    case 'utsav':
      return [
        {
          name: 'labelled_delimiter_format',
          priority: 1,
          strategy: 'delimiter',
          matcher: (raw) => isLikelyUtsavRaw(raw),
          parserConfig: getDefaultParserConfig('utsav'),
          source: 'builtin',
        },
      ]
    case 'venzora':
      return [
        {
          name: 'tokenized_venzora_format',
          priority: 1,
          strategy: 'venzora',
          matcher: (raw) => isLikelyVenzoraRaw(raw),
          parserConfig: getDefaultParserConfig('venzora'),
          source: 'builtin',
        },
      ]
    default:
      return [
        ...getBuiltInPatternVariants('yug'),
        ...getBuiltInPatternVariants('adinath'),
        ...getBuiltInPatternVariants('utsav'),
        ...getBuiltInPatternVariants('venzora'),
      ]
  }
}

const getConfigPatternVariants = (supplier) => {
  const variants = supplier?.qrMapping?.patternVariants
  if (!Array.isArray(variants) || variants.length === 0) {
    return []
  }

  return variants
    .map((variant, index) => normalizeParserVariant(variant, index, supplier))
    .filter(Boolean)
}

const getFallbackParserConfig = (supplier) => {
  const supplierKey = normalizeSupplierKey(supplier)
  return supplier?.qrMapping && Object.keys(supplier.qrMapping).length > 0
    ? buildParserConfig(supplier?.qrMapping?.strategy, supplier?.qrMapping, supplier)
    : getDefaultParserConfig(supplierKey) || {
        strategy: 'delimiter',
        delimiter: '|',
        fieldMap: {},
      }
}

const buildParserCandidates = (raw, supplier = null) => {
  const rawText = normalizeRaw(raw)
  const supplierKey = normalizeSupplierKey(supplier).toLowerCase()

  const configCandidates = [
    ...getConfigPatternVariants(supplier),
    ...getBuiltInPatternVariants(supplierKey || null),
  ]

  const unique = new Map()
  for (const candidate of configCandidates) {
    if (!candidate?.name || unique.has(candidate.name)) {
      continue
    }

    unique.set(candidate.name, candidate)
  }

  const sourceRank = (candidate) => {
    if (candidate?.source === 'config') return 0
    if (candidate?.source === 'builtin') return 1
    return 2
  }

  const candidates = [...unique.values()].sort((a, b) => {
    const sourceA = sourceRank(a)
    const sourceB = sourceRank(b)
    if (sourceA !== sourceB) {
      return sourceA - sourceB
    }

    const priorityA = Number.isInteger(a.priority) ? a.priority : 100
    const priorityB = Number.isInteger(b.priority) ? b.priority : 100
    return priorityA - priorityB
  })

  const matched = candidates.find((candidate) => {
    if (typeof candidate.matcher !== 'function') {
      return false
    }

    try {
      return candidate.matcher(rawText)
    } catch {
      return false
    }
  })

  if (matched) {
    return {
      candidate: matched,
      parserConfig: matched.parserConfig,
      source: matched.source || 'builtin',
    }
  }

  const fallbackConfig = getFallbackParserConfig(supplier)
  return {
    candidate: {
      name: fallbackConfig.strategy,
      strategy: fallbackConfig.strategy,
      priority: 999,
      source: 'fallback',
      parserConfig: fallbackConfig,
    },
    parserConfig: fallbackConfig,
    source: 'fallback',
  }
}

const scoreConfidence = (candidate, parsedResult) => {
  const base = candidate?.source === 'config'
    ? 88
    : candidate?.source === 'builtin'
      ? 84
      : 60

  const errorCount = Array.isArray(parsedResult?.errors) ? parsedResult.errors.length : 0
  const parsedFields = parsedResult?.fields && typeof parsedResult.fields === 'object'
    ? Object.values(parsedResult.fields).filter((entry) => entry && entry.parsed).length
    : 0

  const confidence = base + (parsedFields > 0 ? Math.min(parsedFields * 2, 8) : 0) - (errorCount * 6)
  return Math.max(0, Math.min(100, confidence))
}

export {
  buildParserCandidates,
  buildParserConfig,
  getBuiltInPatternVariants,
  getConfigPatternVariants,
  getDefaultParserConfig,
  getFallbackParserConfig,
  normalizeParserPatternMatcher,
  normalizeParserPatternType,
  normalizeParserVariant,
  scoreConfidence,
}
