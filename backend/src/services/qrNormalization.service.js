import {
  normalizeNull,
  parsePurity,
  parseWeight,
  readExtractedValue,
  resolveSupplierName,
  toNumber,
  toText,
} from './qrNormalization.shared.js'
import {
  extractAadinathFallback,
  extractDesignCodeFromRaw,
  extractUtsavFallback,
} from './qrNormalization.fallbacks.js'
import { normalizeConfidence } from './precision.service.js'

const normalize = (parsedResult, supplier) => {
  const confidenceValue = normalizeConfidence(parsedResult?.confidence)
  const rawText = toText(parsedResult?.raw)
  const rawPurity = parsePurity(rawText)
  const supplierName = resolveSupplierName(parsedResult, supplier).toUpperCase()
  const aadinathFallback = supplierName.includes('AADINATH') ? extractAadinathFallback(rawText) : {}
  const utsavFallback = supplierName.includes('UTSAV') ? extractUtsavFallback(rawText) : {}
  const designCode =
    toText(readExtractedValue(parsedResult, ['design_code', 'designCode', 'designCodeValue', 'itemCode', 'category', 'meta.itemCode'])) ||
    extractDesignCodeFromRaw(rawText)

  return {
    supplier: resolveSupplierName(parsedResult, supplier),
    design_code: normalizeNull(designCode),
    gross_weight: normalizeNull(
      parseWeight(readExtractedValue(parsedResult, ['gross_weight', 'grossWeight', 'gw', 'GWT', 'gross', 'metalWeight'])) ??
        aadinathFallback.grossWeight
    ),
    stone_weight: normalizeNull(
      parseWeight(readExtractedValue(parsedResult, ['stone_weight', 'stoneWeight', 'sw', 'SWT', 'diamondWeight'])) ??
        aadinathFallback.stoneWeight
    ),
    other_weight: normalizeNull(
      parseWeight(readExtractedValue(parsedResult, ['other_weight', 'otherWeight', 'ow', 'OW'])) ??
        utsavFallback.otherWeight
    ),
    net_weight: normalizeNull(
      parseWeight(readExtractedValue(parsedResult, ['net_weight', 'netWeight', 'nw', 'NWT'])) ?? aadinathFallback.netWeight
    ),
    purity_percent: normalizeNull(
      toNumber(readExtractedValue(parsedResult, ['purity_percent', 'purityPercent', 'purity', 'karat', 'KT', 'KTValue'])) ??
        rawPurity
    ),
    wastage_percent: normalizeNull(parseWeight(readExtractedValue(parsedResult, ['wastage_percent', 'wastagePercent', 'wastage', 'ws', 'WST']))),
    fine_weight: normalizeNull(parseWeight(readExtractedValue(parsedResult, ['fine_weight', 'fineWeight', 'fine', 'fw']))),
    stone_amount: normalizeNull(parseWeight(readExtractedValue(parsedResult, ['stone_amount', 'stoneAmount', 'stoneValue', 'stoneVal']))),
    confidence: confidenceValue,
    status: 'pending',
  }
}

export { normalize }
