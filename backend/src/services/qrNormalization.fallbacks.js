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
  if (tokens.length < 7) {
    return {}
  }

  const grossWeight = parseWeight(tokens[0])
  const microStoneWeight = parseWeight(tokens[1])
  const bigStoneWeight = parseWeight(tokens[2])
  const netWeight = parseWeight(tokens[6])

  return {
    grossWeight,
    stoneWeight:
      microStoneWeight === null && bigStoneWeight === null
        ? null
        : (microStoneWeight ?? 0) + (bigStoneWeight ?? 0),
    netWeight,
  }
}

const extractUtsavFallback = (raw) => {
  const text = toText(raw)
  if (!text) {
    return {}
  }

  const tokens = text.split('/').map((part) => part.trim()).filter(Boolean)
  const getTokenValue = (prefix) => {
    const token = tokens.find((part) => part.toUpperCase().startsWith(prefix))
    if (!token) return null
    const value = token.slice(prefix.length).trim()
    return parseWeight(value)
  }

  return {
    otherWeight: getTokenValue('CL-'),
  }
}

export { extractAadinathFallback, extractDesignCodeFromRaw, extractSlashTokens, extractUtsavFallback }
