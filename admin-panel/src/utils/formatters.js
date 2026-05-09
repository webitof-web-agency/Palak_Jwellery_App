import {
  formatConfidence as formatConfidencePrecision,
  formatPercentage as formatPercentagePrecision,
  formatWeight as formatWeightPrecision,
} from './precision'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
})

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export const formatCurrency = (value) => currencyFormatter.format(toNumber(value))

export const formatNumber = (value) => numberFormatter.format(toNumber(value))

export const formatWeight = (value) => `${formatWeightPrecision(value)} g`

export const formatPercentage = (value) => `${formatPercentagePrecision(value)}%`

export const formatConfidence = (value) => formatConfidencePrecision(value)

export const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const parts = dateFormatter.formatToParts(date)
  const getPart = (type) => parts.find((part) => part.type === type)?.value || ''
  const dayPeriod = getPart('dayPeriod').toUpperCase()

  return `${getPart('day')} ${getPart('month')} ${getPart('year')}, ${getPart('hour')}:${getPart('minute')} ${dayPeriod}`
}
