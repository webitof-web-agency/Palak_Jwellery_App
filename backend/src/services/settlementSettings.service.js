import { config } from '../config/env.js'
import { SettlementSetting } from '../models/SettlementSetting.js'

const DEFAULT_SETTINGS = {
  default_wastage_percent: null,
  default_stone_rate: config.defaultStoneRate,
  fine_precision: 3,
  settlement_calculation_mode: 'strict',
}

let cachedSettings = null
let cachedAt = 0
const CACHE_TTL_MS = 30_000

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const loadSettlementSettings = async ({ force = false } = {}) => {
  const now = Date.now()
  if (!force && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings
  }

  const settings = { ...DEFAULT_SETTINGS }
  const rows = await SettlementSetting.find({ isActive: true }).lean()

  for (const row of rows) {
    if (!row?.key) continue
    settings[row.key] = row.value
  }

  settings.default_stone_rate = toNumberOrNull(settings.default_stone_rate) ?? config.defaultStoneRate
  settings.default_wastage_percent = toNumberOrNull(settings.default_wastage_percent)
  settings.fine_precision = Math.max(0, Math.min(6, Math.trunc(toNumberOrNull(settings.fine_precision) ?? 3)))
  settings.settlement_calculation_mode = String(settings.settlement_calculation_mode || 'strict').trim() || 'strict'

  cachedSettings = settings
  cachedAt = now
  return settings
}

const invalidateSettlementSettingsCache = () => {
  cachedSettings = null
  cachedAt = 0
}

export { DEFAULT_SETTINGS, invalidateSettlementSettingsCache, loadSettlementSettings }
