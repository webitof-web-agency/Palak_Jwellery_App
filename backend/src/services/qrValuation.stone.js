import { toNumber } from './qrNormalization.shared.js'

const getStoneRate = (stoneType, options = {}) => {
  void stoneType
  const fallbackRate = toNumber(options?.defaultStoneRate)
  return fallbackRate === null ? 0 : fallbackRate
}

const resolveStoneAmount = (validatedData = {}, options = {}) => {
  const suppliedStoneAmount = toNumber(validatedData?.stone_amount)
  if (suppliedStoneAmount !== null) {
    return {
      stone_amount: suppliedStoneAmount,
      stone_amount_source: 'supplier',
    }
  }

  const stoneWeight = toNumber(validatedData?.stone_weight)
  if (stoneWeight !== null) {
    return {
      stone_amount: stoneWeight * getStoneRate(options?.stoneType, options),
      stone_amount_source: 'fallback_rate',
    }
  }

  return {
    stone_amount: 0,
    stone_amount_source: 'missing',
  }
}

export { getStoneRate, resolveStoneAmount }
