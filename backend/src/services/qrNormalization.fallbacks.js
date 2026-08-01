import { parseWeight, toText } from './qrNormalization.shared.js'

const extractDesignCodeFromRaw = (raw) => {
  const text = toText(raw)
  if (!text) {
    return null
  }

  const slashTokens = text.split('/').map((part) => part.trim()).filter(Boolean)
  const candidate =
    slashTokens.find((token) => /\b(?:SWMS|SWNK|TM|BG|LR)-?\s*\d+/i.test(token)) ||
    slashTokens.find((token) => /[A-Z]{2,}-?\s*\d+/i.test(token)) ||
    slashTokens[7] ||
    slashTokens[0] ||
    null

  return toText(candidate)
}

const extractSlashTokens = (raw) => {
  const text = toText(raw)
  if (!text) {
    return []
  }

  return text.split('/').map((part) => part.trim())
}

const extractAadinathFallback = (raw) => {
  const tokens = extractSlashTokens(raw)
  const meaningful = tokens.map((part) => part.trim()).filter(Boolean)
  if (meaningful.length < 4) {
    return {}
  }

  const grossWeight = parseWeight(meaningful[0])
  const stoneComponents = meaningful.slice(1, -2).map((part) => parseWeight(part)).filter((value) => value !== null)
  const netWeight = parseWeight(meaningful[meaningful.length - 2])

  return {
    grossWeight,
    stoneWeight: stoneComponents.length === 0
      ? null
      : stoneComponents.reduce((sum, value) => sum + value, 0),
    stoneComponents,
    netWeight,
    qrNetWeight: netWeight,
  }
}

const extractUtsavFallback = (raw) => {
  const text = toText(raw)
  if (!text) {
    return {}
  }

  const tokens = text.split('/').map((part) => part.trim()).filter(Boolean)
  const buildPrefixMatcher = (prefix) => new RegExp(`^${prefix.replace(/-/g, '\\s*-\\s*')}\\s*([+-]?\\d+(?:\\.\\d+)?)$`, 'i')
  const getTokenValue = (prefix) => {
    const matcher = buildPrefixMatcher(prefix)
    const token = tokens.find((part) => matcher.test(part))
    if (!token) return null
    const match = token.match(matcher)
    if (!match) return null
    const parsed = parseWeight(match[1])
    return parsed === null ? null : Math.abs(parsed)
  }

  const stoneComponent1 = getTokenValue('SWT-')
  const stoneComponent2 = getTokenValue('CL-')
  const otherComponent1 = getTokenValue('MZ-')

  return {
    stoneComponent1,
    stoneComponent2,
    stoneWeight: stoneComponent1,
    otherWeight:
      stoneComponent2 === null && otherComponent1 === null
        ? null
        : (stoneComponent2 ?? 0) + (otherComponent1 ?? 0),
  }
}
export { extractAadinathFallback, extractDesignCodeFromRaw, extractSlashTokens, extractUtsavFallback }
