import mongoose from 'mongoose'
import { BusinessOption } from '../models/BusinessOption.js'
import { SettlementSetting } from '../models/SettlementSetting.js'
import { invalidateSettlementSettingsCache, loadSettlementSettings } from '../services/settlementSettings.service.js'

const sendSuccess = (res, data, message, status = 200) => {
  const payload = { success: true, data }
  if (message) payload.message = message
  return res.status(status).json(payload)
}

const sendError = (res, status, error, code) => res.status(status).json({ success: false, error, code })

const normalizeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const toSafeOption = (option) => {
  if (!option) return null
  const plain = typeof option.toObject === 'function' ? option.toObject() : { ...option }
  delete plain.__v
  return plain
}

const toSafeSetting = (setting) => {
  if (!setting) return null
  const plain = typeof setting.toObject === 'function' ? setting.toObject() : { ...setting }
  delete plain.__v
  return plain
}

const normalizeKind = (value) => {
  const kind = normalizeText(value).toLowerCase()
  return ['category', 'metal_type'].includes(kind) ? kind : ''
}

export const listBusinessOptions = async (req, res) => {
  try {
    const kind = normalizeKind(req.query.kind)
    const query = req.user?.role === 'admin' ? {} : { isActive: true }
    if (kind) {
      query.kind = kind
    }

    const options = await BusinessOption.find(query).sort({ sortOrder: 1, name: 1 }).lean()
    return sendSuccess(res, options.map((option) => {
      delete option.__v
      return option
    }))
  } catch (error) {
    return sendError(res, 500, 'Failed to load business options', 'SERVER_ERROR')
  }
}

export const createBusinessOption = async (req, res) => {
  try {
    const kind = normalizeKind(req.body.kind)
    const name = normalizeText(req.body.name)
    const code = normalizeText(req.body.code)

    if (!kind) {
      return sendError(res, 400, 'kind is required', 'MISSING_FIELDS')
    }
    if (!name) {
      return sendError(res, 400, 'name is required', 'MISSING_FIELDS')
    }

    const payload = {
      kind,
      name,
      code: code || null,
      isActive: req.body.isActive !== false,
      sortOrder: Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 100,
    }

    const existing = await BusinessOption.findOne({ kind, name }).lean()
    if (existing) {
      return sendError(res, 409, `${kind} already exists`, 'DUPLICATE_OPTION')
    }

    const created = await BusinessOption.create(payload)
    return sendSuccess(res, toSafeOption(created), 'Business option created', 201)
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'Option already exists', 'DUPLICATE_OPTION')
    }
    return sendError(res, 500, 'Failed to create business option', 'SERVER_ERROR')
  }
}

export const updateBusinessOption = async (req, res) => {
  try {
    const id = req.params.id
    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid option id', 'INVALID_ID')
    }

    const option = await BusinessOption.findById(id)
    if (!option) {
      return sendError(res, 404, 'Option not found', 'NOT_FOUND')
    }

    const kind = normalizeKind(req.body.kind || option.kind)
    const name = normalizeText(req.body.name ?? option.name)
    const code = normalizeText(req.body.code ?? option.code)
    const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : option.sortOrder

    option.kind = kind || option.kind
    option.name = name
    option.code = code || null
    if (req.body.isActive !== undefined) {
      option.isActive = Boolean(req.body.isActive)
    }
    option.sortOrder = sortOrder

    await option.save()
    return sendSuccess(res, toSafeOption(option), 'Business option updated')
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'Option already exists', 'DUPLICATE_OPTION')
    }
    return sendError(res, 500, 'Failed to update business option', 'SERVER_ERROR')
  }
}

export const deleteBusinessOption = async (req, res) => {
  try {
    const id = req.params.id
    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid option id', 'INVALID_ID')
    }

    const deleted = await BusinessOption.findByIdAndDelete(id)
    if (!deleted) {
      return sendError(res, 404, 'Option not found', 'NOT_FOUND')
    }

    return sendSuccess(res, null, 'Business option deleted')
  } catch (error) {
    return sendError(res, 500, 'Failed to delete business option', 'SERVER_ERROR')
  }
}

export const listSettlementSettings = async (req, res) => {
  try {
    const settings = await loadSettlementSettings()
    const rows = await SettlementSetting.find({}).sort({ key: 1 }).lean()
    const data = rows.length > 0
      ? rows.map((row) => {
          delete row.__v
          return row
        })
      : Object.entries(settings).map(([key, value]) => ({
          key,
          label: key.replaceAll('_', ' '),
          value,
          description: '',
          isActive: true,
        }))
    return sendSuccess(res, data)
  } catch (error) {
    return sendError(res, 500, 'Failed to load settlement settings', 'SERVER_ERROR')
  }
}

export const upsertSettlementSettings = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.settings) ? req.body.settings : Array.isArray(req.body) ? req.body : [req.body]
    const safeItems = items.filter((item) => item && typeof item === 'object')

    if (safeItems.length === 0) {
      return sendError(res, 400, 'settings array is required', 'MISSING_FIELDS')
    }

    const results = []
    for (const item of safeItems) {
      const key = normalizeText(item.key)
      const label = normalizeText(item.label || key)
      if (!key || !label) {
        continue
      }

      const payload = {
        key,
        label,
        value: item.value ?? null,
        description: normalizeText(item.description),
        isActive: item.isActive !== false,
      }

      const updated = await SettlementSetting.findOneAndUpdate(
        { key },
        payload,
        { upsert: true, new: true, runValidators: true }
      ).lean()

      results.push(updated)
    }

    invalidateSettlementSettingsCache()
    return sendSuccess(res, results.map((row) => {
      delete row.__v
      return row
    }), 'Settlement settings saved')
  } catch (error) {
    return sendError(res, 500, 'Failed to save settlement settings', 'SERVER_ERROR')
  }
}

export const getBusinessOverview = async (req, res) => {
  try {
    const [categories, metalTypes, settings] = await Promise.all([
      BusinessOption.find({ kind: 'category', isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      BusinessOption.find({ kind: 'metal_type', isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      loadSettlementSettings(),
    ])

    return sendSuccess(res, {
      categories: categories.map((item) => {
        delete item.__v
        return item
      }),
      metalTypes: metalTypes.map((item) => {
        delete item.__v
        return item
      }),
      settings,
    })
  } catch (error) {
    return sendError(res, 500, 'Failed to load business overview', 'SERVER_ERROR')
  }
}
