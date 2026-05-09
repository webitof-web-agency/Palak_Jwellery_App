import { config } from '../config/env.js'
import { compareWeight } from './precision.service.js'
import { toNumber } from './qrNormalization.shared.js'
import { calculateDerivedFineWeight, calculateFineWeight } from './qrValuation.fine.js'
import { resolveStoneAmount } from './qrValuation.stone.js'

const toSafeTotal = (value) => {
  const numeric = toNumber(value)
  return numeric === null ? 0 : numeric
}

const normalizeWarnings = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))]
}

const determineValuationStatus = (validatedData, fineWeightResult, stoneAmountResult) => {
  const netWeight = toNumber(validatedData?.net_weight)
  const purityPercent = toNumber(validatedData?.purity_percent)
  const wastagePercent = toNumber(validatedData?.wastage_percent)
  const stoneWeight = toNumber(validatedData?.stone_weight)
  const suppliedFine = fineWeightResult.fine_weight_source === 'supplier'
  const suppliedStone = stoneAmountResult.stone_amount_source === 'supplier'
  const canDeriveFine = netWeight !== null && purityPercent !== null && wastagePercent !== null
  const canDeriveStone = stoneWeight !== null

  if (suppliedFine && suppliedStone && !canDeriveFine && !canDeriveStone) {
    return 'supplier_only'
  }

  if (canDeriveFine && (canDeriveStone || suppliedStone)) {
    return 'complete'
  }

  if (suppliedFine || suppliedStone || canDeriveFine || canDeriveStone) {
    return 'partial'
  }

  return 'partial'
}

const valuate = (validatedData = {}, options = {}) => {
  const fineWeightResult = calculateFineWeight(validatedData, options)
  const stoneAmountResult = resolveStoneAmount(validatedData, {
    defaultStoneRate: options.defaultStoneRate ?? config.defaultStoneRate,
    stoneType: options.stoneType,
  })
  const derivedFineWeight = calculateDerivedFineWeight(validatedData, options)
  const warnings = normalizeWarnings(validatedData?.warnings)
  const supplierFineWeight = toNumber(validatedData?.fine_weight)

  if (
    supplierFineWeight !== null &&
    derivedFineWeight !== null &&
    !compareWeight(supplierFineWeight, derivedFineWeight, 0.02)
  ) {
    warnings.push('FINE: Supplier fine differs from derived fine')
  }

  const fineWeight = fineWeightResult.fine_weight
  const stoneAmount = stoneAmountResult.stone_amount

  return {
    fine_weight: fineWeight,
    fine_weight_source: fineWeightResult.fine_weight_source,
    stone_amount: stoneAmount,
    stone_amount_source: stoneAmountResult.stone_amount_source,
    valuation_status: determineValuationStatus(validatedData, fineWeightResult, stoneAmountResult),
    warnings: [...new Set(warnings)],
    totals: {
      gross_weight: toSafeTotal(validatedData?.gross_weight),
      stone_weight: toSafeTotal(validatedData?.stone_weight),
      other_weight: toSafeTotal(validatedData?.other_weight),
      net_weight: toSafeTotal(validatedData?.net_weight),
      fine_weight: toSafeTotal(fineWeight),
      stone_amount: toSafeTotal(stoneAmount),
      other_amount: 0,
    },
  }
}

export { valuate }
