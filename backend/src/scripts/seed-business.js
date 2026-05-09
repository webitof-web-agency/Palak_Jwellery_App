import { connectDB } from '../config/db.js'
import { BusinessOption } from '../models/BusinessOption.js'
import { SettlementSetting } from '../models/SettlementSetting.js'

const DEFAULT_CATEGORIES = [
  { kind: 'category', name: 'Ring', code: 'RING', sortOrder: 10 },
  { kind: 'category', name: 'Pendant', code: 'PENDANT', sortOrder: 20 },
  { kind: 'category', name: 'Necklace', code: 'NECKLACE', sortOrder: 30 },
  { kind: 'category', name: 'Bracelet', code: 'BRACELET', sortOrder: 40 },
]

const DEFAULT_METAL_TYPES = [
  { kind: 'metal_type', name: 'Gold', code: 'GOLD', sortOrder: 10 },
  { kind: 'metal_type', name: 'Silver', code: 'SILVER', sortOrder: 20 },
  { kind: 'metal_type', name: 'Platinum', code: 'PLATINUM', sortOrder: 30 },
]

const DEFAULT_SETTINGS = [
  {
    key: 'default_wastage_percent',
    label: 'Default wastage percent',
    value: 10,
    description: 'Fallback wastage percent used when a record does not provide wastage.',
  },
  {
    key: 'default_stone_rate',
    label: 'Default stone rate',
    value: 0,
    description: 'Fallback stone rate used when no supplier rate is available.',
  },
  {
    key: 'fine_precision',
    label: 'Fine precision',
    value: 3,
    description: 'Decimal precision for fine-weight display and calculations.',
  },
  {
    key: 'settlement_calculation_mode',
    label: 'Settlement calculation mode',
    value: 'strict',
    description: 'Use strict or default-wastage settlement math.',
  },
]

const upsertOptions = async (items) => {
  for (const item of items) {
    await BusinessOption.updateOne(
      { kind: item.kind, name: item.name },
      { $set: item },
      { upsert: true }
    )
  }
}

const upsertSettings = async (items) => {
  for (const item of items) {
    await SettlementSetting.updateOne(
      { key: item.key },
      { $set: item },
      { upsert: true }
    )
  }
}

const main = async () => {
  await connectDB()
  await upsertOptions([...DEFAULT_CATEGORIES, ...DEFAULT_METAL_TYPES])
  await upsertSettings(DEFAULT_SETTINGS)
  console.log('Business metadata seeded successfully')
  process.exit(0)
}

main().catch((error) => {
  console.error('Business seed failed:', error)
  process.exit(1)
})
