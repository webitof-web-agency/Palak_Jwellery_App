import { normalizeRaw, toText } from './qrParser.shared.js'
import {
  isLikelyAdinathRaw,
  isLikelyUtsavRaw,
  isLikelyVenzoraRaw,
  isLikelyYugDelimiterRaw,
  isLikelyYugRaw,
} from './qrParser.patterns.js'

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

const detectSupplier = (rawQRString, suppliers = []) => {
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

  const yugMatch = suppliers.find((supplier) => {
    if (!isLikelyYugDelimiterRaw(raw) && !isLikelyYugRaw(raw)) return false

    const supplierName = toText(supplier?.name)?.toLowerCase()
    const supplierCode = toText(supplier?.code)?.toLowerCase()

    return supplierName === 'yug' || supplierCode === 'yug'
  })
  if (yugMatch) return { supplier: yugMatch, matchType: 'contains' }

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

export { detectSupplier, getDetectionToken, matchesContains, matchesPrefix, matchesRegex }
