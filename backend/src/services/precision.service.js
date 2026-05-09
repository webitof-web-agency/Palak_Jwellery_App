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

  if (typeof value === 'boolean') {
    return null
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

const roundWeight = (value) => roundTo(value, PRECISION.weight)

const roundPercentage = (value) => roundTo(value, PRECISION.percentage)

const roundCurrency = (value) => roundTo(value, PRECISION.currency)

const normalizeConfidence = (value) => {
  const numeric = toNumeric(value)
  if (numeric === null) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(numeric)))
}

const compareWithTolerance = (a, b, tolerance) => {
  const left = toNumeric(a)
  const right = toNumeric(b)
  if (left === null || right === null) {
    return false
  }

  return Math.abs(left - right) <= tolerance
}

const compareWeight = (a, b, tolerance = 0.001) => compareWithTolerance(a, b, tolerance)

const compareCurrency = (a, b, tolerance = 0.01) => compareWithTolerance(a, b, tolerance)

const comparePercentage = (a, b, tolerance = 0.01) => compareWithTolerance(a, b, tolerance)

const formatPrecision = (value, decimals) => {
  const numeric = toNumeric(value)
  if (numeric === null) {
    return '-'
  }

  return roundTo(numeric, decimals)?.toFixed(decimals) || '-'
}

const formatWeight = (value) => formatPrecision(value, PRECISION.weight)

const formatCurrency = (value) => formatPrecision(value, PRECISION.currency)

const formatPercentage = (value) => formatPrecision(value, PRECISION.percentage)

const preserveNumericPrecision = (value) => {
  const numeric = toNumeric(value)
  if (numeric === null) {
    return ''
  }

  return String(value)
}

export {
  PRECISION,
  compareCurrency,
  comparePercentage,
  compareWeight,
  formatCurrency,
  formatPercentage,
  formatPrecision,
  formatWeight,
  normalizeConfidence,
  preserveNumericPrecision,
  roundCurrency,
  roundPercentage,
  roundTo,
  roundWeight,
  toNumeric,
}
