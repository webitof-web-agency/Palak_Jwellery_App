const DEFAULT_QR_NET_TOLERANCE = 0.005

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const normalizeNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeNonNegativeNumber = (value, fallback = null) => {
  const parsed = normalizeNumber(value, fallback)
  if (parsed === null || parsed === undefined) {
    return fallback
  }

  return parsed >= 0 ? parsed : fallback
}

const normalizePurityKey = (value) => normalizeText(value).replace(/\s+/g, '').toUpperCase()

const normalizeCategoryKey = (value) => normalizeText(value).toLowerCase()

const normalizeBusinessCategory = (item, index = 0) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const name = normalizeText(item.name)
  const code = normalizeText(item.code || name || `CATEGORY_${index + 1}`)
  const colorLabel = normalizeText(item.colorLabel)
  const wastagePercentValue = item.wastagePercent === null || item.wastagePercent === undefined || item.wastagePercent === ''
    ? null
    : normalizeNonNegativeNumber(item.wastagePercent, null)

  return {
    name,
    code,
    colorLabel,
    wastagePercent: wastagePercentValue,
    isActive: item.isActive !== false,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : (index + 100),
  }
}

const normalizePurityOverride = (item, index = 0) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const karat = normalizePurityKey(item.karat)
  const purityValue = item.purityPercent === null || item.purityPercent === undefined || item.purityPercent === ''
    ? null
    : normalizeNumber(item.purityPercent, null)

  if (!karat) {
    return null
  }

  return {
    karat,
    purityPercent: purityValue,
    isActive: item.isActive !== false,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : (index + 100),
  }
}

const normalizeBusinessSettings = (input = {}, supplierContext = {}) => {
  const source = input && typeof input === 'object' ? input : {}
  const supplierName = normalizeText(supplierContext?.name).toLowerCase()
  const supplierCode = normalizeText(supplierContext?.code).toLowerCase()
  const isYugSupplier = supplierName === 'yug' || supplierCode === 'yug'
  const hasExplicitKeys = Object.keys(source).some((key) => source[key] !== undefined)

  if (isYugSupplier && !hasExplicitKeys) {
    return getYugDefaultBusinessSettings()
  }

  const categories = Array.isArray(source.categories)
    ? source.categories.map((item, index) => normalizeBusinessCategory(item, index)).filter(Boolean)
    : []
  const purityOverrides = Array.isArray(source.purityOverrides)
    ? source.purityOverrides.map((item, index) => normalizePurityOverride(item, index)).filter(Boolean)
    : []

  const qrNetTolerance = normalizeNonNegativeNumber(source.qrNetTolerance, DEFAULT_QR_NET_TOLERANCE)

  return {
    categories,
    purityOverrides,
    defaultWastagePercent: source.defaultWastagePercent === null || source.defaultWastagePercent === undefined || source.defaultWastagePercent === ''
      ? null
      : normalizeNonNegativeNumber(source.defaultWastagePercent, null),
    defaultStoneRate: source.defaultStoneRate === null || source.defaultStoneRate === undefined || source.defaultStoneRate === ''
      ? null
      : normalizeNonNegativeNumber(source.defaultStoneRate, null),
    netWeightRule: ['computed', 'qr_trusted_with_validation', 'manual'].includes(normalizeText(source.netWeightRule))
      ? normalizeText(source.netWeightRule)
      : 'computed',
    stoneWeightRule: ['single', 'component_sum', 'manual'].includes(normalizeText(source.stoneWeightRule))
      ? normalizeText(source.stoneWeightRule)
      : 'single',
    otherWeightRule: {
      deductOtherWeight: source.otherWeightRule?.deductOtherWeight === true,
      defaultOtherWeight: normalizeNonNegativeNumber(source.otherWeightRule?.defaultOtherWeight, 0) ?? 0,
    },
    qrNetTolerance,
  }
}

const getYugDefaultBusinessSettings = () => ({
  categories: [
    {
      name: 'White',
      code: 'WHITE',
      colorLabel: 'white',
      wastagePercent: null,
      isActive: true,
      sortOrder: 100,
    },
    {
      name: 'Green',
      code: 'GREEN',
      colorLabel: 'green',
      wastagePercent: null,
      isActive: true,
      sortOrder: 110,
    },
    {
      name: 'Purple / Orange',
      code: 'PURPLE_ORANGE',
      colorLabel: 'purple-orange',
      wastagePercent: null,
      isActive: true,
      sortOrder: 120,
    },
    {
      name: 'Skyblue',
      code: 'SKYBLUE',
      colorLabel: 'skyblue',
      wastagePercent: null,
      isActive: true,
      sortOrder: 130,
    },
  ],
  purityOverrides: [],
  defaultWastagePercent: null,
  defaultStoneRate: null,
  netWeightRule: 'computed',
  stoneWeightRule: 'component_sum',
  otherWeightRule: {
    deductOtherWeight: true,
    defaultOtherWeight: 0,
  },
  qrNetTolerance: DEFAULT_QR_NET_TOLERANCE,
})

const getSupplierBusinessSettings = (supplier) => {
  const supplierName = normalizeText(supplier?.name).toLowerCase()
  const supplierCode = normalizeText(supplier?.code).toLowerCase()
  const rawSettings = supplier?.businessSettings && typeof supplier.businessSettings === 'object'
    ? supplier.businessSettings
    : null

  if (!rawSettings && (supplierName === 'yug' || supplierCode === 'yug')) {
    return getYugDefaultBusinessSettings()
  }

  return normalizeBusinessSettings(rawSettings || {}, supplier || {})
}

const getPurityForKarat = (supplier, karat, globalFallback = null) => {
  const normalizedKarat = normalizePurityKey(karat)
  const settings = getSupplierBusinessSettings(supplier)
  const override = settings.purityOverrides.find((item) => normalizePurityKey(item.karat) === normalizedKarat && item.isActive !== false)

  if (override && override.purityPercent !== null && override.purityPercent !== undefined) {
    return normalizeNumber(override.purityPercent, null)
  }

  if (Array.isArray(globalFallback)) {
    const match = globalFallback.find((item) => normalizePurityKey(item?.karat) === normalizedKarat && item?.isActive !== false)
    if (match) {
      return normalizeNumber(match.purityPercent, null)
    }
  } else if (globalFallback && typeof globalFallback === 'object') {
    const fallbackValue = globalFallback[normalizedKarat] ?? globalFallback[karat] ?? globalFallback[normalizeText(karat)]
    if (fallbackValue !== undefined) {
      return normalizeNumber(fallbackValue, null)
    }
  } else if (globalFallback !== null && globalFallback !== undefined && globalFallback !== '') {
    return normalizeNumber(globalFallback, null)
  }

  return null
}

const getWastageForCategory = (supplier, category) => {
  const settings = getSupplierBusinessSettings(supplier)
  const normalizedCategory = normalizeCategoryKey(category)

  const matched = settings.categories.find((item) => {
    const nameMatch = normalizeCategoryKey(item.name) === normalizedCategory
    const codeMatch = normalizeCategoryKey(item.code) === normalizedCategory
    return item.isActive !== false && (nameMatch || codeMatch)
  })

  if (matched && matched.wastagePercent !== null && matched.wastagePercent !== undefined) {
    return normalizeNonNegativeNumber(matched.wastagePercent, 0) ?? 0
  }

  if (settings.defaultWastagePercent !== null && settings.defaultWastagePercent !== undefined) {
    return normalizeNonNegativeNumber(settings.defaultWastagePercent, 0) ?? 0
  }

  return 0
}

const getQrNetTolerance = (supplier) => {
  const settings = getSupplierBusinessSettings(supplier)
  const tolerance = normalizeNonNegativeNumber(settings.qrNetTolerance, DEFAULT_QR_NET_TOLERANCE)
  return tolerance === null || tolerance === undefined ? DEFAULT_QR_NET_TOLERANCE : tolerance
}

export {
  DEFAULT_QR_NET_TOLERANCE,
  getPurityForKarat,
  getQrNetTolerance,
  getSupplierBusinessSettings,
  getWastageForCategory,
  getYugDefaultBusinessSettings,
  normalizeBusinessSettings,
}
