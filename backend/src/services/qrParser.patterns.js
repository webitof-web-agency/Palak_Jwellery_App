import { SUPPORTED_STRATEGIES, normalizeRaw, toText } from './qrParser.shared.js'

const YUG_LABELS = ['GW', 'SS', 'MS', 'OW', 'NW', 'KT']
const YUG_LINE_PATTERN = new RegExp(`^\\s*(?:${YUG_LABELS.join('|')})\\b`, 'i')
const YUG_ITEM_PATTERN = /\b(?:SWMS|SWNK)\s*-\s*[A-Z0-9]+\b/i
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

const isLikelyYugDelimiterRaw = (raw) => {
  const text = normalizeRaw(raw)
  if (!text || !text.includes('/')) return false

  return YUG_ITEM_PATTERN.test(text)
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

export {
  ADINATH_ITEM_CODE_PATTERN,
  ADINATH_PATTERN,
  VENZORA_PATTERN,
  VENZORA_TOKEN_PATTERNS,
  YUG_FALLBACK_MAPPING,
  YUG_ITEM_PATTERN,
  YUG_LABELS,
  YUG_LINE_PATTERN,
  isLikelyAdinathRaw,
  isLikelyUtsavRaw,
  isLikelyVenzoraRaw,
  isLikelyYugDelimiterRaw,
  isLikelyYugRaw,
  normalizeStrategy,
  normalizeYugRaw,
}
