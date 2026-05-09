import { toNumber } from './qrNormalization.shared.js'
import { roundTo } from './precision.service.js'

const normalizePrecision = (value, fallback = 3) => {
  const numeric = toNumber(value)
  if (numeric === null) {
    return fallback
  }

  return Math.max(0, Math.min(6, Math.trunc(numeric)))
}

const resolveWastagePercent = (validatedData = {}, options = {}) => {
  const suppliedWastage = toNumber(validatedData?.wastage_percent)
  if (suppliedWastage !== null) {
    return suppliedWastage
  }

  const defaultWastage = toNumber(options?.defaultWastagePercent)
  const mode = String(options?.settlementCalculationMode || 'strict').trim().toLowerCase()
  if (mode === 'default_wastage' && defaultWastage !== null) {
    return defaultWastage
  }

  return null
}

const calculateFineWeight = (validatedData = {}, options = {}) => {
  const suppliedFine = toNumber(validatedData?.fine_weight)
  if (suppliedFine !== null) {
    return {
      fine_weight: suppliedFine,
      fine_weight_source: 'supplier',
    }
  }

  const netWeight = toNumber(validatedData?.net_weight)
  const purityPercent = toNumber(validatedData?.purity_percent)
  const wastagePercent = resolveWastagePercent(validatedData, options)

  if (netWeight === null || purityPercent === null || wastagePercent === null) {
    return {
      fine_weight: null,
      fine_weight_source: 'missing',
    }
  }

  const precision = normalizePrecision(options?.finePrecision, 3)
  const rawFineWeight = netWeight * ((purityPercent + wastagePercent) / 100)

  return {
    fine_weight: roundTo(rawFineWeight, precision),
    fine_weight_source: 'derived',
  }
}

const calculateDerivedFineWeight = (validatedData = {}, options = {}) => {
  const netWeight = toNumber(validatedData?.net_weight)
  const purityPercent = toNumber(validatedData?.purity_percent)
  const wastagePercent = resolveWastagePercent(validatedData, options)

  if (netWeight === null || purityPercent === null || wastagePercent === null) {
    return null
  }

  const precision = normalizePrecision(options?.finePrecision, 3)
  return roundTo(netWeight * ((purityPercent + wastagePercent) / 100), precision)
}

export { calculateDerivedFineWeight, calculateFineWeight }
