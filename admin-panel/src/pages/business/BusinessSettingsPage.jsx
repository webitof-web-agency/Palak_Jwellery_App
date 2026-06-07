import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import {
  createBusinessOption,
  deleteBusinessOption,
  getBusinessOverview,
  getSettlementSettings,
  saveSettlementSettings,
  updateBusinessOption,
} from '../../api/business.api'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'

const emptySettings = {
  default_wastage_percent: '',
  default_stone_rate: '',
  fine_precision: '',
  settlement_calculation_mode: 'strict',
}

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const toNullableNumber = (value) => {
  const text = normalizeText(value)
  if (!text) return null

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

const kindTitles = {
  category: 'Categories',
  karat: 'Karats',
}

export default function BusinessSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categories, setCategories] = useState([])
  const [karats, setKarats] = useState([])
  const [settings, setSettings] = useState(emptySettings)
  const [newCategory, setNewCategory] = useState('')
  const [newKaratName, setNewKaratName] = useState('')
  const [newKaratPurity, setNewKaratPurity] = useState('')
  const [editingOption, setEditingOption] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const [overviewResponse, settingsResponse] = await Promise.all([
        getBusinessOverview(),
        getSettlementSettings(),
      ])

      const overviewData = overviewResponse?.data ?? overviewResponse
      const settingsData = Array.isArray(settingsResponse?.data)
        ? settingsResponse.data
        : settingsResponse

      setCategories(Array.isArray(overviewData?.categories) ? overviewData.categories : [])
      setKarats(Array.isArray(overviewData?.karats) ? overviewData.karats : [])
      const nextSettings = { ...emptySettings }
      for (const row of Array.isArray(settingsData) ? settingsData : []) {
        if (!row?.key) continue
        nextSettings[row.key] = row.value ?? ''
      }
      setSettings(nextSettings)
    } catch (err) {
      setError(err instanceof ApiError ? err.error : err?.message || 'Failed to load business settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const categoryRows = useMemo(() => categories, [categories])
  const karatRows = useMemo(() => karats, [karats])

  const addKarat = async () => {
    const trimmedName = newKaratName.trim()
    if (!trimmedName) return

    const purityPercent = toNullableNumber(newKaratPurity)
    if (purityPercent === null || purityPercent < 0 || purityPercent > 100) {
      setError('Enter a valid purity percent between 0 and 100.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createBusinessOption({
        kind: 'karat',
        name: trimmedName,
        code: trimmedName,
        purityPercent,
      })
      setNewKaratName('')
      setNewKaratPurity('')
      await loadData()
      setSuccess('Karat added.')
    } catch (err) {
      setError(err instanceof ApiError ? err.error : err?.message || 'Failed to add karat.')
    } finally {
      setSaving(false)
    }
  }

  const addOption = async (kind, name, reset) => {
    const trimmed = name.trim()
    if (!trimmed) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createBusinessOption({ kind, name: trimmed, code: trimmed })
      reset('')
      await loadData()
      setSuccess(`${kindTitles[kind] || 'Option'} added.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.error : err?.message || 'Failed to add option.')
    } finally {
      setSaving(false)
    }
  }

  const removeOption = async (id) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteBusinessOption(id)
      if (editingOption?.id === id) {
        setEditingOption(null)
      }
      await loadData()
      setSuccess('Option deleted.')
    } catch (err) {
      setError(err instanceof ApiError ? err.error : err?.message || 'Failed to delete option.')
    } finally {
      setSaving(false)
    }
  }

  const beginEdit = (item, kind) => {
    setEditingOption({
      id: item._id,
      kind,
      name: item.name || '',
      purityPercent: item.purityPercent ?? '',
    })
  }

  const saveOption = async () => {
    if (!editingOption?.id || !editingOption.name.trim()) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        kind: editingOption.kind,
        name: editingOption.name.trim(),
        code: editingOption.name.trim(),
      }
      if (editingOption.kind === 'karat') {
        const purityPercent = toNullableNumber(editingOption.purityPercent)
        if (purityPercent === null || purityPercent < 0 || purityPercent > 100) {
          setError('Enter a valid purity percent between 0 and 100.')
          setSaving(false)
          return
        }
        payload.purityPercent = purityPercent
      }

      await updateBusinessOption(editingOption.id, payload)
      setEditingOption(null)
      await loadData()
      setSuccess(`${kindTitles[editingOption.kind] || 'Option'} updated.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.error : err?.message || 'Failed to update option.')
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingOption(null)
  }

  const saveSettings = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await saveSettlementSettings([
        { key: 'default_wastage_percent', label: 'Default wastage percent', value: settings.default_wastage_percent },
        { key: 'default_stone_rate', label: 'Default stone rate', value: settings.default_stone_rate },
        { key: 'fine_precision', label: 'Fine precision', value: settings.fine_precision },
        { key: 'settlement_calculation_mode', label: 'Settlement calculation mode', value: settings.settlement_calculation_mode },
      ])
      await loadData()
      setSuccess('Settlement settings saved.')
    } catch (err) {
      setError(err instanceof ApiError ? err.error : err?.message || 'Failed to save settlement settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell space-y-8">
      <PageHeader
        eyebrow="Business Master Data"
        title="Business Settings"
        description="Manage categories, karats, and settlement defaults without changing the core QR workflow."
        actions={
          <button
            type="button"
            className="luxury-button border border-white/10 bg-white/5 hover:bg-white/10"
            onClick={loadData}
            disabled={loading || saving}
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Refreshing...
              </>
            ) : (
              'Refresh'
            )}
          </button>
        }
      />

      {error ? (
        <div className="surface-card border-red-500/20 bg-red-500/10 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{error}</span>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
            disabled={loading || saving}
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Loading...
              </>
            ) : (
              'Retry'
            )}
          </button>
        </div>
      ) : null}

      {success ? (
        <div className="surface-card border-green-500/20 bg-green-500/10 text-green-200">
          {success}
        </div>
      ) : null}

      {loading && categories.length === 0 ? (
        <SectionCard className="flex min-h-[220px] items-center justify-center">
          <div className="flex items-center gap-3 text-muted">
            <LoadingSpinner />
            <span>Loading business settings...</span>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SectionCard className="space-y-4">
          <div>
            <h2 className="text-xl font-bold font-display text-heading">Categories</h2>
            <p className="text-sm text-muted">Used for settlement and mobile quick-select fallback.</p>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="Add category"
            />
            <button
              type="button"
              className="primary-luxury-button"
              disabled={saving || !newCategory.trim()}
              onClick={() => addOption('category', newCategory, setNewCategory)}
            >
              Add
            </button>
          </div>
          <div className="space-y-2">
            {categoryRows.length === 0 ? (
              <div className="text-sm text-muted">No categories configured.</div>
            ) : (
              categoryRows.map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  {editingOption?.id === item._id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        className="input flex-1"
                        value={editingOption.name}
                        onChange={(event) => setEditingOption((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-primary">{item.name}</span>
                  )}
                  <div className="flex items-center gap-2">
                    {editingOption?.id === item._id ? (
                      <>
                        <button type="button" className="text-xs text-gold-500 hover:text-gold-400" disabled={saving} onClick={saveOption}>
                          Save
                        </button>
                        <button type="button" className="text-xs text-muted hover:text-primary" disabled={saving} onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" className="text-xs text-muted hover:text-primary" disabled={saving} onClick={() => beginEdit(item, 'category')}>
                        Edit
                      </button>
                    )}
                    <button type="button" className="text-xs text-muted hover:text-primary" disabled={saving} onClick={() => removeOption(item._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard className="space-y-4">
          <div>
            <h2 className="text-xl font-bold font-display text-heading">Karats</h2>
            <p className="text-sm text-muted">
              Manage the default karat list used by mobile and supplier purity overrides.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_auto] gap-2">
            <input
              className="input flex-1"
              value={newKaratName}
              onChange={(event) => setNewKaratName(event.target.value)}
              placeholder="e.g. 18K"
            />
            <input
              className="input flex-1"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={newKaratPurity}
              onChange={(event) => setNewKaratPurity(event.target.value)}
              placeholder="Purity %"
            />
            <button
              type="button"
              className="primary-luxury-button"
              disabled={saving || !newKaratName.trim() || !String(newKaratPurity).trim()}
              onClick={addKarat}
            >
              Add
            </button>
          </div>
          <div className="space-y-2">
            {karatRows.length === 0 ? (
              <div className="text-sm text-muted">No karats configured.</div>
            ) : (
              karatRows.map((item) => (
                <div key={item._id || item.id || item.name} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  {editingOption?.id === (item._id || item.id) ? (
                    <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-[1fr_0.7fr]">
                      <input
                        className="input flex-1"
                        value={editingOption.name}
                        onChange={(event) => setEditingOption((current) => ({ ...current, name: event.target.value }))}
                      />
                      <input
                        className="input flex-1"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={editingOption.purityPercent}
                        onChange={(event) => setEditingOption((current) => ({ ...current, purityPercent: event.target.value }))}
                        placeholder="Purity %"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-primary">
                      {item.name}
                      <span className="text-xs text-muted ml-2">
                        {item.purityPercent !== null && item.purityPercent !== undefined ? `${item.purityPercent}%` : 'No purity'}
                      </span>
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {editingOption?.id === (item._id || item.id) ? (
                      <>
                        <button type="button" className="text-xs text-gold-500 hover:text-gold-400" disabled={saving} onClick={saveOption}>
                          Save
                        </button>
                        <button type="button" className="text-xs text-muted hover:text-primary" disabled={saving} onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (item._id || item.id) ? (
                      <button type="button" className="text-xs text-muted hover:text-primary" disabled={saving} onClick={() => beginEdit(item, 'karat')}>
                        Edit
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        Default fallback
                      </span>
                    )}
                    <button type="button" className="text-xs text-muted hover:text-primary" disabled={saving || !(item._id || item.id)} onClick={() => removeOption(item._id || item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard className="space-y-4">
          <div>
            <h2 className="text-xl font-bold font-display text-heading">Settlement Settings</h2>
            <p className="text-sm text-muted">Default values used when records are missing business metadata.</p>
          </div>

          <label className="field">
            <span className="field-label">Default wastage %</span>
            <input
              className="input"
              type="number"
              step="0.01"
              value={settings.default_wastage_percent}
              onChange={(event) => setSettings((current) => ({ ...current, default_wastage_percent: event.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field-label">Default stone rate</span>
            <input
              className="input"
              type="number"
              step="0.01"
              value={settings.default_stone_rate}
              onChange={(event) => setSettings((current) => ({ ...current, default_stone_rate: event.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field-label">Fine precision</span>
            <input
              className="input"
              type="number"
              min="0"
              max="6"
              step="1"
              value={settings.fine_precision}
              onChange={(event) => setSettings((current) => ({ ...current, fine_precision: event.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field-label">Calculation mode</span>
            <select
              className="input"
              value={settings.settlement_calculation_mode}
              onChange={(event) => setSettings((current) => ({ ...current, settlement_calculation_mode: event.target.value }))}
            >
              <option value="strict">Strict</option>
              <option value="default_wastage">Default wastage</option>
            </select>
          </label>

          <button
            type="button"
            className="primary-luxury-button w-full"
            disabled={saving}
            onClick={saveSettings}
          >
            {saving ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              'Save Settlement Settings'
            )}
          </button>
        </SectionCard>
      </div>
    </main>
  )
}
