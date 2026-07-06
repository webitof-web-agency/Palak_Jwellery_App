import { toNumber, toText } from './qrParser.shared.js'

const STONE_KEYWORDS = [
  'BS', 'BIGSTONE', 'BIG STONE', 'MS', 'MICROSTONE', 'MICRO STONE',
  'SS', 'SMALLSTONE', 'SMALL STONE', 'STONE', 'SWT', 'CL', 'L', 'LESS'
]

const OTHER_KEYWORDS = [
  'OW', 'OT', 'OTHER', 'OTHERWEIGHT', 'OTHER WT', 'OTH', 'OTHER W'
]

const createRegexFromKeywords = (keywords) => {
  const joined = keywords.map(k => k.replace(/\s+/g, '\\s*')).join('|')
  return new RegExp(`\\b(?:${joined})\\b\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)`, 'gi')
}

const STONE_PATTERN = createRegexFromKeywords(STONE_KEYWORDS)
const OTHER_PATTERN = createRegexFromKeywords(OTHER_KEYWORDS)

const extractKeywords = (raw, pattern) => {
  const matches = []
  let match
  const regex = new RegExp(pattern) // clone to reset state
  while ((match = regex.exec(raw)) !== null) {
    const val = toNumber(match[1])
    if (val !== null) {
      matches.push(val)
    }
  }
  return matches
}

export const applyExplicitKeywordMapping = (raw) => {
  const stones = extractKeywords(raw, STONE_PATTERN)
  const others = extractKeywords(raw, OTHER_PATTERN)
  
  const stoneWeight = stones.length > 0 ? stones.reduce((a, b) => a + b, 0) : null
  const otherWeight = others.length > 0 ? others.reduce((a, b) => a + b, 0) : null

  return { stoneWeight, otherWeight, stoneComponents: stones, otherComponents: others }
}

export const extractPlausibleWeights = (raw) => {
  // Extract all numbers that look like weights.
  // We exclude very large numbers (e.g. > 1000 without decimal), dates, etc.
  // Actually, weights in jewelry are typically decimal, or small integers.
  // Let's just find numbers matching \d+\.\d+ or \d{1,4}
  
  // To avoid catching Karat (18K, 14K), dates (2026), percentages (75.0%), we need to be careful.
  // But a simple regex for floating point numbers:
  const numRegex = /(?:^|\s|[:\-\/|])(\d+\.\d+)(?:\s|$|[:\-\/|])/g
  const matches = []
  let match
  while ((match = numRegex.exec(raw)) !== null) {
    const val = toNumber(match[1])
    // Plausible weights for a single jewelry item are generally under 3000g.
    // This prevents large decimal amounts (e.g., 5000.00 Rs) from being chosen as gross weight.
    if (val !== null && val > 0 && val < 3000) matches.push(val)
  }
  return matches
}

export const applyNumericFallback = (raw, existingGross) => {
  const weights = extractPlausibleWeights(raw)
  if (weights.length === 0) return null

  // Sort descending
  weights.sort((a, b) => b - a)

  if (weights.length === 1) {
    return {
      grossWeight: weights[0],
      netWeight: weights[0],
      stoneWeight: 0,
      otherWeight: 0,
      qrNetWeight: null,
      warnings: ['Fallback parser used: only gross weight detected'],
      requiresReview: false
    }
  }

  // Multiple weights
  const grossWeight = weights[0]
  // Find a candidate for net weight (usually the closest value <= grossWeight)
  // Let's just take the second largest as netCandidate if it's strictly <= grossWeight and logical
  const netCandidate = weights.find(w => w <= grossWeight && w > 0 && w !== grossWeight) || weights[1]
  
  // if explicit mapping found stones/others, use them, else try to deduce
  const explicit = applyExplicitKeywordMapping(raw)
  let stoneWeight = explicit.stoneWeight ?? 0
  let otherWeight = explicit.otherWeight ?? 0
  let netWeight = grossWeight - stoneWeight - otherWeight
  let qrNetWeight = null
  let warnings = []

  if (explicit.stoneWeight === null && explicit.otherWeight === null) {
    // deduce stone weight if netCandidate is reasonable
    if (netCandidate <= grossWeight) {
      qrNetWeight = netCandidate
      const diff = grossWeight - netCandidate
      if (diff > 0 && diff < grossWeight * 0.5) { // reasonable diff
        stoneWeight = diff
        netWeight = netCandidate
      } else {
        warnings.push('Fallback parser used: incomplete QR weight mapping')
        netWeight = grossWeight
      }
    } else {
      warnings.push('Fallback parser used: incomplete QR weight mapping')
    }
  } else {
    qrNetWeight = netCandidate <= grossWeight ? netCandidate : null
  }

  // ensure no negative
  if (netWeight < 0) netWeight = 0
  // ensure limits
  if (stoneWeight + otherWeight > grossWeight) {
    stoneWeight = 0
    otherWeight = 0
    netWeight = grossWeight
  }

  return {
    grossWeight,
    stoneWeight,
    otherWeight,
    netWeight,
    qrNetWeight,
    warnings
  }
}
