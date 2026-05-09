const PRECISION = {
  weight: 3,
  percentage: 2,
  currency: 2,
  confidence: 0,
}

const toNumeric = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const parsed = Number.parseFloat(String(value).trim().replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

const roundTo = (value, decimals) => {
  const numeric = toNumeric(value)
  if (numeric === null) {
    return null
  }

  const factor = 10 ** decimals
  return Math.round((numeric + Number.EPSILON) * factor) / factor
}

const formatPrecision = (value, decimals) => {
  const rounded = roundTo(value, decimals)
  if (rounded === null) {
    return '-'
  }

  return rounded.toFixed(decimals)
}

export const roundWeight = (value) => roundTo(value, PRECISION.weight)

export const roundPercentage = (value) => roundTo(value, PRECISION.percentage)

export const roundCurrency = (value) => roundTo(value, PRECISION.currency)

export const normalizePrecisionInput = (value, decimals) => {
  const rounded = roundTo(value, decimals)
  return rounded === null ? '' : String(rounded)
}

export const formatWeight = (value) => formatPrecision(value, PRECISION.weight)

export const formatPercentage = (value) => formatPrecision(value, PRECISION.percentage)

export const formatCurrency = (value) => formatPrecision(value, PRECISION.currency)

export const formatConfidence = (value) => {
  const rounded = Math.round(toNumeric(value) ?? 0)
  return String(Math.max(0, Math.min(100, rounded)))
}
