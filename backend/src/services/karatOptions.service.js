import { BusinessOption } from '../models/BusinessOption.js'

const DEFAULT_KARAT_OPTIONS = [
  { name: '9K', purityPercent: 37.5, sortOrder: 100 },
  { name: '14K', purityPercent: 58.5, sortOrder: 110 },
  { name: '18K', purityPercent: 75, sortOrder: 120 },
  { name: '20K', purityPercent: 83.3, sortOrder: 130 },
  { name: '22K', purityPercent: 91.6, sortOrder: 140 },
  { name: '24K', purityPercent: 99.9, sortOrder: 150 },
]

const normalizeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const normalizeKarat = (value) => normalizeText(value).replace(/\s+/g, '').toUpperCase()

const normalizePurityPercent = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeOption = (item, index = 0) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const name = normalizeKarat(item.name || item.code)
  if (!name) {
    return null
  }

  return {
    _id: item._id?.toString?.() || item.id?.toString?.() || null,
    id: item._id?.toString?.() || item.id?.toString?.() || null,
    kind: 'karat',
    name,
    code: normalizeText(item.code) || name,
    purityPercent: normalizePurityPercent(item.purityPercent),
    isActive: item.isActive !== false,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : (index + 100),
  }
}

export const getDefaultKaratOptions = () => DEFAULT_KARAT_OPTIONS.map((item, index) => ({
  _id: null,
  id: null,
  kind: 'karat',
  name: item.name,
  code: item.name,
  purityPercent: item.purityPercent,
  isActive: true,
  sortOrder: item.sortOrder ?? (index + 100),
}))

export const loadKaratOptions = async ({ includeInactive = false } = {}) => {
  const query = { kind: 'karat' }
  if (!includeInactive) {
    query.isActive = true
  }

  const rows = await BusinessOption.find(query).sort({ sortOrder: 1, name: 1 }).lean()
  const normalized = rows.map((item, index) => normalizeOption(item, index)).filter(Boolean)
  return normalized.length > 0 ? normalized : getDefaultKaratOptions()
}

export const loadKaratPurityMap = async ({ includeInactive = false } = {}) => {
  const options = await loadKaratOptions({ includeInactive })
  const map = {}

  for (const option of options) {
    if (!option?.name || option.purityPercent === null || option.purityPercent === undefined) {
      continue
    }

    map[normalizeKarat(option.name)] = Number(option.purityPercent)
  }

  return map
}

export { DEFAULT_KARAT_OPTIONS }
