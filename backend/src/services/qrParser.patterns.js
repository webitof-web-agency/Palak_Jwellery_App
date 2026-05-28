import { SUPPORTED_STRATEGIES, normalizeRaw, toText } from './qrParser.shared.js'

const YUG_LABELS = ['GW', 'SS', 'MS', 'OW', 'NW', 'KT']
const YUG_LINE_PATTERN = new RegExp(`^\\s*(?:${YUG_LABELS.join('|')})\\b`, 'i')
const YUG_ITEM_PREFIXES = ['SWMS', 'SWNK', 'TGGR', 'YNGR', 'TCCBJ', 'SWJ', 'SWPS', 'HBN']
const YUG_ITEM_PATTERN = new RegExp(`\\b(?:${YUG_ITEM_PREFIXES.join('|')})\\s*-\\s*[A-Z0-9]+\\b`, 'i')
const YUG_KARAT_PATTERN = /^(?:9|14|18|20|22|24)K$/i
const YUG_METAL_PATTERN = /(?:^|\b)(?:[YR]\+W|Y\+W|R\+W)(?:\b|$)/i
const YUG_COLOR_PATTERN = /^(?:WHITE|GREEN|PURPAL|PURPLE|ORANGE|SKYBLUE)$/i
const YUG_FALLBACK_MAPPING = {
  strategy: 'delimiter',
  delimiter: '/',
  fieldMap: {
    grossWeight: 3,
    stoneWeight: { sumIndices: [4, 14] },
    netWeight: 5,
    category: 7,
  },
}
const ADINATH_SEGMENT_MIN = 7
const ADINATH_TOLERANCE = 0.02
const ADINATH_NUMERIC_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/i
const ADINATH_PATTERN = /\//
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

const scoreAdinathStructuralSignature = (raw) => {
  const parts = normalizeRaw(raw)
    .split('/')
    .map((part) => String(part).trim())

  if (parts.length === 0) {
    return { score: 0, matches: 0, parts }
  }

  const meaningful = parts.filter((part) => part.length > 0)
  if (meaningful.length < 4 || meaningful.length > 6) {
    return { score: 0, matches: 0, parts, stoneComponents: [] }
  }
  const isNumeric = (value) => {
    const text = toText(value)
    return text !== null && ADINATH_NUMERIC_PATTERN.test(text)
  }
  const first = meaningful[0] || ''
  const netCandidate = meaningful[meaningful.length - 2] || ''
  const itemCandidate = meaningful[meaningful.length - 1] || ''
  const stoneComponents = meaningful.slice(1, -2).filter((value) => isNumeric(value)).map((value) => Number.parseFloat(value))
  const computedNetWeight =
    isNumeric(first) && isNumeric(netCandidate) && stoneComponents.length > 0
      ? Math.round((Number.parseFloat(first) - stoneComponents.reduce((sum, value) => sum + value, 0)) * 1000) / 1000
      : null
  const qrNetWeight = isNumeric(netCandidate) ? Math.round(Number.parseFloat(netCandidate) * 1000) / 1000 : null
  const mismatch =
    computedNetWeight !== null && qrNetWeight !== null
      ? Math.abs(Number((computedNetWeight - qrNetWeight).toFixed(3)))
      : null
  const matches = [
    parts.length >= ADINATH_SEGMENT_MIN,
    isNumeric(first),
    Boolean(itemCandidate),
    isNumeric(netCandidate),
    stoneComponents.length >= 1,
    computedNetWeight !== null && qrNetWeight !== null && mismatch !== null && mismatch <= ADINATH_TOLERANCE,
    !YUG_KARAT_PATTERN.test(meaningful[2] || ''),
  ].filter(Boolean).length

  return {
    score: matches,
    matches,
    parts,
    stoneComponents,
    grossWeight: isNumeric(first) ? Number.parseFloat(first) : null,
    qrNetWeight,
    itemCode: itemCandidate || null,
    computedNetWeight,
    mismatch,
    tolerance: ADINATH_TOLERANCE,
  }
}

const splitYugPositionalRaw = (raw) => {
  const text = normalizeRaw(raw)
  if (!text) return []

  return text
    .split('/')
    .map((part) => String(part).trim())
}

const scoreYugStructuralSignature = (raw) => {
  const parts = splitYugPositionalRaw(raw)
  if (parts.length === 0) {
    return { score: 0, matches: 0, parts }
  }

  let score = 0
  let matches = 0

  const isNumeric = (value) => {
    if (value === null || value === undefined || value === '') return false
    return Number.isFinite(Number(value))
  }

  const checks = [
    parts.length >= 15,
    isNumeric(parts[0]),
    isNumeric(parts[1]),
    YUG_KARAT_PATTERN.test(parts[2] || ''),
    isNumeric(parts[3]),
    isNumeric(parts[4]),
    isNumeric(parts[5]),
    Boolean(parts[7]),
    YUG_METAL_PATTERN.test(parts[9] || ''),
    isNumeric(parts[10]),
    isNumeric(parts[11]),
    Boolean(parts[13]) && YUG_COLOR_PATTERN.test((parts[13] || '').toUpperCase()),
    isNumeric(parts[14]),
  ]

  checks.forEach((matched, index) => {
    if (matched) {
      matches += 1
      score += index < 3 ? 2 : 1
    }
  })

  return { score, matches, parts }
}

const isLikelyYugStructuralRaw = (raw) => scoreYugStructuralSignature(raw).score >= 8

const isLikelyYugRaw = (raw) => {
  const text = normalizeYugRaw(raw)
  if (!text) return false

  const labelHits = YUG_LABELS.reduce((count, label) => {
    const matchCount = (text.match(new RegExp(`\\b${label}\\b`, 'gi')) || []).length
    return count + matchCount
  }, 0)

  return labelHits >= 2 && /(?:[:\-]|\s)\s*\d/.test(text)
}

const isLikelyYugDelimiterRaw = (raw) => {
  const text = normalizeRaw(raw)
  if (!text || !text.includes('/')) return false

  return YUG_ITEM_PATTERN.test(text) || isLikelyYugStructuralRaw(text)
}

const isLikelyAdinathStructuralRaw = (raw) => scoreAdinathStructuralSignature(raw).score >= 6

const isLikelyAdinathRaw = (raw) => {
  const text = normalizeRaw(raw)
  if (!ADINATH_PATTERN.test(text)) {
    return false
  }

  return isLikelyAdinathStructuralRaw(text)
}

const isLikelyUtsavRaw = (raw) => {
  const text = normalizeRaw(raw)
  return /^[A-Z]+-\d+/i.test(text) && /GWT-/i.test(text) && /NWT-/i.test(text) && /SWT-/i.test(text)
}

const isLikelyVenzoraRaw = (raw) => {
  const text = normalizeRaw(raw)
  const tokens = text.split('/').map((part) => part.trim()).filter(Boolean)
  if (tokens.length < 6) {
    return false
  }

  const hasInternalId = tokens.length > 0 && /^[A-Za-z0-9]+$/.test(tokens[0])
  const hasKarat = tokens.some((token) => /^\d{1,2}KT$/i.test(token))
  const hasGrossPrefix = tokens.some((token) => /^G\d+(?:\.\d+)?$/i.test(token))
  const hasLessPrefix = tokens.some((token) => /^L\d+(?:\.\d+)?$/i.test(token))
  const hasNetPrefix = tokens.some((token) => /^N\d+(?:\.\d+)?$/i.test(token))
  const hasStoneAmount = tokens.some((token) => /^RS(?:\.?\d+(?:\.\d+)?)?$/i.test(token))
  const hasDesignCode = tokens.some((token) => /^CH-[A-Z0-9]+$/i.test(token))

  return hasInternalId && hasKarat && hasGrossPrefix && hasLessPrefix && hasNetPrefix && hasStoneAmount && hasDesignCode
}

export {
  ADINATH_PATTERN,
  VENZORA_PATTERN,
  VENZORA_TOKEN_PATTERNS,
  YUG_FALLBACK_MAPPING,
  YUG_ITEM_PATTERN,
  YUG_LABELS,
  YUG_LINE_PATTERN,
  YUG_COLOR_PATTERN,
  YUG_KARAT_PATTERN,
  YUG_METAL_PATTERN,
  isLikelyAdinathStructuralRaw,
  isLikelyAdinathRaw,
  isLikelyUtsavRaw,
  isLikelyVenzoraRaw,
  isLikelyYugDelimiterRaw,
  isLikelyYugRaw,
  isLikelyYugStructuralRaw,
  normalizeStrategy,
  normalizeYugRaw,
  scoreAdinathStructuralSignature,
  scoreYugStructuralSignature,
  splitYugPositionalRaw,
}
