import { calculateSettlementSnapshot } from './settlementCalculation.service.js'
import { getSupplierBusinessSettings, DEFAULT_QR_NET_TOLERANCE } from './supplierBusinessSettings.service.js'
import { normalizeRaw, toNumber, toText, cloneValue } from './qrParser.shared.js'
import { parsePurity } from './qrNormalization.shared.js'

const DEFAULT_KARAT_PURITY_FALLBACK = {
  '9K': 37.5,
  '14K': 58.5,
  '18K': 75,
  '20K': 83.3,
  '22K': 91.6,
  '24K': 99.9,
}

const normalizeNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeString = (value) => {
  const text = toText(value)
  return text || null
}

const resolveKaratHint = (source = {}, parsedSnapshot = null) => {
  const candidates = [
    source?.karat,
    source?.purityKarat,
    parsedSnapshot?.item?.karat,
    parsedSnapshot?.display?.item?.karat,
    parsedSnapshot?.karat,
  ]

  for (const candidate of candidates) {
    const text = normalizeString(candidate)
    if (!text) continue
    if (/\d{1,2}\s*K/i.test(text)) {
      return text.replace(/\s+/g, '').toUpperCase()
    }
  }

  return null
}

const resolveParsedPurityPercent = (parsedSnapshot = null) => {
  const candidates = [
    parsedSnapshot?.display?.item?.purityPercent,
    parsedSnapshot?.display?.purityPercent,
    parsedSnapshot?.purityPercent,
    parsedSnapshot?.purity_percent,
    parsedSnapshot?.item?.purityPercent,
    parsedSnapshot?.item?.purity_percent,
  ]

  for (const candidate of candidates) {
    const parsed = normalizeNumber(candidate, null)
    if (parsed !== null) {
      return parsed
    }

    const text = normalizeString(candidate)
    if (text) {
      const numeric = normalizeNumber(text, null)
      if (numeric !== null) {
        return numeric
      }
      const percentParsed = parsePurity(text)
      if (percentParsed !== null) {
        return percentParsed
      }
    }
  }

  return null
}

const resolveBasePurityInfo = (supplier, karatHint, globalFallback = null) => {
  const normalizedKarat = normalizeString(karatHint)?.replace(/\s+/g, '').toUpperCase() || null
  if (!normalizedKarat) {
    return {
      purityPercent: null,
      puritySource: 'unknown',
    }
  }

  const supplierSettings = getSupplierBusinessSettings(supplier)
  const override = Array.isArray(supplierSettings?.purityOverrides)
    ? supplierSettings.purityOverrides.find((item) => {
        const itemKarat = normalizeString(item?.karat)?.replace(/\s+/g, '').toUpperCase()
        return item?.isActive !== false && itemKarat === normalizedKarat
      })
    : null

  if (override && override.purityPercent !== null && override.purityPercent !== undefined) {
    return {
      purityPercent: normalizeNumber(override.purityPercent, null),
      puritySource: 'supplier_override',
    }
  }

  let fallbackValue = null
  if (Array.isArray(globalFallback)) {
    const match = globalFallback.find((item) => {
      const itemKarat = normalizeString(item?.name || item?.code)?.replace(/\s+/g, '').toUpperCase()
      return item?.isActive !== false && itemKarat === normalizedKarat
    })
    fallbackValue = match?.purityPercent ?? null
  } else if (globalFallback && typeof globalFallback === 'object') {
    fallbackValue = globalFallback[normalizedKarat] ?? globalFallback[karatHint] ?? globalFallback[normalizeString(karatHint)]
  } else {
    fallbackValue = DEFAULT_KARAT_PURITY_FALLBACK[normalizedKarat]
  }
  if (fallbackValue !== undefined) {
    return {
      purityPercent: normalizeNumber(fallbackValue, null),
      puritySource: 'global_default',
    }
  }

  return {
    purityPercent: null,
    puritySource: 'unknown',
  }
}

const resolveBaseWastageInfo = ({ supplier, source = {}, parsedSnapshot = null, settlementSettings = {} }) => {
  const category = normalizeString(source?.category) || normalizeString(parsedSnapshot?.item?.category) || normalizeString(parsedSnapshot?.display?.item?.category)
  const supplierSettings = getSupplierBusinessSettings(supplier)

  if (category) {
    const matched = Array.isArray(supplierSettings?.categories)
      ? supplierSettings.categories.find((item) => {
          const name = normalizeString(item?.name)?.toLowerCase()
          const code = normalizeString(item?.code)?.toLowerCase()
          const normalized = category.toLowerCase()
          return item?.isActive !== false && (name === normalized || code === normalized)
        })
      : null

    if (matched && matched.wastagePercent !== null && matched.wastagePercent !== undefined) {
      return {
        wastagePercent: normalizeNumber(matched.wastagePercent, null),
        wastageSource: 'supplier_category',
      }
    }
  }

  if (supplierSettings?.defaultWastagePercent !== null && supplierSettings?.defaultWastagePercent !== undefined) {
    return {
      wastagePercent: normalizeNumber(supplierSettings.defaultWastagePercent, null),
      wastageSource: 'supplier_default',
    }
  }

  const globalDefault = normalizeNumber(settlementSettings?.default_wastage_percent, null)
  if (globalDefault !== null) {
    return {
      wastagePercent: globalDefault,
      wastageSource: 'global_default',
    }
  }

  return {
    wastagePercent: null,
    wastageSource: 'unknown',
  }
}

const resolveExplicitSettlementPercent = (source = {}, key, fallbackKeys = []) => {
  const primary = normalizeNumber(source?.[key], null)
  if (primary !== null) {
    return primary
  }

  const primaryText = normalizeString(source?.[key])
  if (primaryText) {
    const primaryPercent = primaryText.match(/^(\d{1,3}(?:\.\d+)?)\s*%$/)
    if (primaryPercent) {
      return normalizeNumber(primaryPercent[1], null)
    }
  }

  for (const fallbackKey of fallbackKeys) {
    const value = source?.[fallbackKey]
    if (value === null || value === undefined || value === '') {
      continue
    }

    const numeric = normalizeNumber(value, null)
    if (numeric !== null) {
      return numeric
    }

    const text = normalizeString(value)
    if (text) {
      const percentMatch = text.match(/^(\d{1,3}(?:\.\d+)?)\s*%$/)
      if (percentMatch) {
        return normalizeNumber(percentMatch[1], null)
      }
    }
  }

  return null
}

const resolveExplicitPurityPercent = (source = {}) => {
  const percentValue = resolveExplicitSettlementPercent(source, 'purityPercent', ['purity_percent'])
  if (percentValue !== null) {
    return percentValue
  }

  return resolveExplicitSettlementPercent(source, 'purity', ['purity_percent'])
}

const resolveExplicitWastagePercent = (source = {}) => {
  const percentValue = resolveExplicitSettlementPercent(source, 'wastagePercent', ['wastage_percent'])
  if (percentValue !== null) {
    return percentValue
  }

  const wastageText = normalizeString(source?.wastage)
  if (!wastageText) {
    return null
  }

  const numeric = normalizeNumber(wastageText, null)
  if (numeric !== null) {
    return numeric
  }

  const percentMatch = wastageText.match(/^(\d{1,3}(?:\.\d+)?)\s*%$/)
  if (percentMatch) {
    return normalizeNumber(percentMatch[1], null)
  }

  return null
}

const resolveWastagePercent = ({ supplier, source = {}, parsedSnapshot = null, settlementSettings = {} }) => {
  return buildSaleSettlementInputs({ supplier, source, parsedSnapshot, settlementSettings }).wastagePercent
}

const buildSaleSettlementInputs = ({
  source = {},
  supplier = null,
  parsedSnapshot = null,
  settlementSettings = {},
  karatDefaults = null,
}) => {
  const safeSource = source && typeof source === 'object' ? source : {}
  const safeParsedSnapshot = normalizeParsedSnapshot(parsedSnapshot)
  const karat = resolveKaratHint(safeSource, safeParsedSnapshot)
  const parsedPurityPercent = resolveParsedPurityPercent(safeParsedSnapshot)
  const basePurityInfo = resolveBasePurityInfo(supplier, karat, karatDefaults)
  const explicitPurityPercent = resolveExplicitPurityPercent(safeSource)
  const finalPurityPercent = explicitPurityPercent !== null
    ? explicitPurityPercent
    : (parsedPurityPercent !== null ? parsedPurityPercent : basePurityInfo.purityPercent)
  const purityOverridden = explicitPurityPercent !== null &&
    basePurityInfo.purityPercent !== null &&
    Math.abs(explicitPurityPercent - basePurityInfo.purityPercent) > 0.0005

  const baseWastageInfo = resolveBaseWastageInfo({
    supplier,
    source: safeSource,
    parsedSnapshot: safeParsedSnapshot,
    settlementSettings,
  })
  const explicitWastagePercent = resolveExplicitWastagePercent(safeSource)
  const finalWastagePercent = explicitWastagePercent !== null
    ? explicitWastagePercent
    : baseWastageInfo.wastagePercent
  const wastageOverridden = explicitWastagePercent !== null &&
    baseWastageInfo.wastagePercent !== null &&
    Math.abs(explicitWastagePercent - baseWastageInfo.wastagePercent) > 0.0005

  return {
    karat: karat || null,
    category: normalizeString(safeSource.category) || normalizeString(safeParsedSnapshot?.item?.category) || normalizeString(safeParsedSnapshot?.display?.item?.category),
    purityPercent: finalPurityPercent,
    originalPurityPercent: basePurityInfo.purityPercent,
    puritySource: explicitPurityPercent !== null
      ? (purityOverridden ? 'manual_override' : 'request')
      : (parsedPurityPercent !== null ? 'parsed_qr' : basePurityInfo.puritySource),
    purityOverridden,
    wastagePercent: finalWastagePercent,
    originalWastagePercent: baseWastageInfo.wastagePercent,
    wastageSource: explicitWastagePercent !== null
      ? (wastageOverridden ? 'manual_override' : 'request')
      : baseWastageInfo.wastageSource,
    wastageOverridden,
    supplierId: supplier?._id?.toString?.() || supplier?.id?.toString?.() || safeSource.supplierId?.toString?.() || null,
    supplierCode: normalizeString(supplier?.code) || null,
    resolvedAt: new Date(),
  }
}

const resolvePurityPercent = ({ supplier, source = {}, parsedSnapshot = null }) => {
  return buildSaleSettlementInputs({ source, supplier, parsedSnapshot }).purityPercent
}

const normalizeParsedSnapshot = (parsedSnapshot) => {
  if (parsedSnapshot && typeof parsedSnapshot === 'object') {
    const safe = cloneValue(parsedSnapshot)
    return safe && typeof safe === 'object' ? safe : null
  }

  if (typeof parsedSnapshot !== 'string') {
    return null
  }

  const trimmed = parsedSnapshot.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const safe = cloneValue(parsed)
    return safe && typeof safe === 'object' ? safe : null
  } catch {
    return null
  }
}

const buildSaleCalculationSnapshot = ({
  source = {},
  supplier = null,
  parsedSnapshot = null,
  settlementSettings = {},
  settlementInputs = null,
  karatDefaults = null,
}) => {
  const safeSource = source && typeof source === 'object' ? source : {}
  const safeParsedSnapshot = normalizeParsedSnapshot(parsedSnapshot)
  const grossWeight = normalizeNumber(safeSource.grossWeight ?? safeSource.gross_weight, null)
  const stoneWeight = normalizeNumber(safeSource.stoneWeight ?? safeSource.stone_weight, 0) ?? 0
  const otherWeight = normalizeNumber(safeSource.otherWeight ?? safeSource.other_weight, 0) ?? 0
  const qrNetWeight = normalizeNumber(
    safeSource.qrNetWeight ??
      safeSource.qr_net_weight ??
      (safeSource.qrRaw ? (safeSource.netWeight ?? safeSource.net_weight) : null),
    null
  )
  const resolvedSettlementInputs = settlementInputs && typeof settlementInputs === 'object'
    ? settlementInputs
    : buildSaleSettlementInputs({
        source: safeSource,
        supplier,
        parsedSnapshot: safeParsedSnapshot,
      settlementSettings,
      karatDefaults,
    })
  const purityPercent = normalizeNumber(resolvedSettlementInputs?.purityPercent, null)
  const wastagePercent = normalizeNumber(resolvedSettlementInputs?.wastagePercent, null)
  const tolerance = normalizeNumber(
    safeSource.tolerance ??
      safeSource.qrNetTolerance ??
      getSupplierBusinessSettings(supplier)?.qrNetTolerance ??
      settlementSettings?.qr_net_tolerance ??
      DEFAULT_QR_NET_TOLERANCE,
    DEFAULT_QR_NET_TOLERANCE
  )

  const snapshot = calculateSettlementSnapshot({
    grossWeight,
    stoneWeight,
    otherWeight,
    qrNetWeight,
    purityPercent,
    wastagePercent,
    tolerance,
  })

  return {
    ...snapshot,
    netFormula: snapshot.calculationExplanation?.netFormula ?? null,
    fineFormula: snapshot.calculationExplanation?.fineFormula ?? null,
    explanation: snapshot.calculationExplanation
      ? `${snapshot.calculationExplanation.netFormula}; ${snapshot.calculationExplanation.fineFormula}`
      : null,
    settlementInputs: cloneValue(resolvedSettlementInputs),
  }
}

const buildSaleParsedSnapshot = (parsedSnapshot = null) => normalizeParsedSnapshot(parsedSnapshot)

export {
  buildSaleCalculationSnapshot,
  buildSaleSettlementInputs,
  buildSaleParsedSnapshot,
  resolveExplicitPurityPercent,
  resolveExplicitWastagePercent,
  resolveKaratHint,
  resolvePurityPercent,
  resolveWastagePercent,
}
