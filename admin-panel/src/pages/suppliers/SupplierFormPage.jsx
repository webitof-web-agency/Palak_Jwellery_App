import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { createSupplier, updateSupplier } from '../../api/suppliers.api'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'

const paymentModes = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit', label: 'Credit' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

const strategyOptions = [
  { value: 'delimiter', label: 'Delimiter / positional' },
  { value: 'key_value', label: 'Key-value label format' },
  { value: 'venzora', label: 'Venzora token format' },
]

const detectionTypeOptions = [
  { value: 'regex', label: 'Regex' },
  { value: 'contains', label: 'Contains' },
  { value: 'prefix', label: 'Prefix' },
]

const mappingFields = [
  { key: 'supplierCode', label: 'Supplier code position' },
  { key: 'category', label: 'Category position' },
  { key: 'grossWeight', label: 'Gross weight position' },
  { key: 'stoneWeight', label: 'Stone weight position' },
  { key: 'netWeight', label: 'Net weight position' },
]

const defaultFieldMap = {
  supplierCode: '0',
  category: '1',
  grossWeight: '2',
  stoneWeight: '3',
  netWeight: '4',
}

const qrTemplates = [
  {
    key: 'auto',
    title: 'Auto detect',
    subtitle: 'Recommended for most suppliers',
    badge: 'Smart',
    summary:
      'Keeps the setup simple and lets the supplier rules stay hidden unless needed.',
    strategy: 'delimiter',
    delimiter: '|',
    detectionType: 'contains',
    detectionPattern: '',
    fieldMap: { ...defaultFieldMap },
    advancedHint:
      'Use when you want the app to suggest the right QR template based on the sample QR and supplier name.',
  },
  {
    key: 'positional',
    title: 'Positional QR',
    subtitle: 'For / or | separated codes',
    badge: 'Delimiter',
    summary:
      'Best when the QR is split into slots like supplier, category, gross, stone, and net weight.',
    strategy: 'delimiter',
    delimiter: '/',
    detectionType: 'contains',
    detectionPattern: '',
    fieldMap: {
      supplierCode: '0',
      category: '1',
      grossWeight: '2',
      stoneWeight: '3',
      netWeight: '4',
    },
    advancedHint:
      'Use when the supplier QR is positional and each field appears in a fixed slot.',
  },
  {
    key: 'labels',
    title: 'Label-based QR',
    subtitle: 'For GW, NW, OW, KT style strings',
    badge: 'Labels',
    summary:
      'Best when the QR contains visible labels instead of fixed positions. Great for weight-heavy suppliers.',
    strategy: 'key_value',
    delimiter: '|',
    detectionType: 'contains',
    detectionPattern: '',
    fieldMap: { ...defaultFieldMap },
    advancedHint:
      'Use when the QR already says what each piece is, like GW, GSW, NW, OW, KT, or item/design tags.',
  },
  {
    key: 'venzora',
    title: 'Venzora style',
    subtitle: 'For token-based vendor QR',
    badge: 'Tokens',
    summary:
      'Use this for token-separated strings like G16.970, N16.654, L0.316, and CH-435A.',
    strategy: 'venzora',
    delimiter: '/',
    detectionType: 'contains',
    detectionPattern: 'VENZORA',
    fieldMap: { ...defaultFieldMap },
    advancedHint:
      'Use when the supplier follows the Venzora token format with item code, weights, and design code.',
  },
  {
    key: 'custom',
    title: 'Custom advanced',
    subtitle: 'For unusual or mixed supplier formats',
    badge: 'Advanced',
    summary:
      'Keep this for special cases where the QR needs manual tuning or extra validation.',
    strategy: 'delimiter',
    delimiter: '|',
    detectionType: 'regex',
    detectionPattern: '',
    fieldMap: { ...defaultFieldMap },
    advancedHint:
      'Use this when the QR format is unusual, mixed, or not covered by the presets above.',
  },
]

const createEmptyForm = () => ({
  name: '',
  code: '',
  gst: '',
  address: '',
  paymentMode: 'cash',
  categories: [],
  categoryDraft: '',
  isActive: true,
  strategy: 'delimiter',
  detectionType: 'contains',
  detectionPattern: '',
  delimiter: '|',
  fieldMap: { ...defaultFieldMap },
})

const formatFieldMapValue = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(value.sumIndices)) {
      return `sum: ${value.sumIndices.join(' + ')}`
    }

    if (Array.isArray(value.indices)) {
      return `idx: ${value.indices.join(', ')}`
    }

    if (typeof value.index === 'number' && value.stripPrefix) {
      return `idx: ${value.index} | prefix: ${value.stripPrefix}`
    }

    if (typeof value.index === 'number' && value.stripSuffix) {
      return `idx: ${value.index} | suffix: ${value.stripSuffix}`
    }

    if (typeof value.index === 'number' && value.prefix) {
      return `idx: ${value.index} | prefix: ${value.prefix}`
    }

    if (typeof value.index === 'number') {
      return `idx: ${value.index}`
    }

    if ('value' in value) {
      return String(value.value)
    }

    return JSON.stringify(value)
  }

  return String(value)
}

const parseFieldMapValue = (value, fallback) => {
  const text = String(value ?? '').trim()
  if (!text) {
    return fallback
  }

  if (/^\d+$/.test(text)) {
    return Number(text)
  }

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      return JSON.parse(text)
    } catch {
      // Fall through to text parsing.
    }
  }

  const sumMatch = text.match(/^sum\s*:\s*(.+)$/i)
  if (sumMatch) {
    const indices = sumMatch[1]
      .split('+')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((num) => Number.isInteger(num) && num >= 0)

    if (indices.length > 0) {
      return { sumIndices: indices }
    }
  }

  const prefixMatch = text.match(/^idx\s*:\s*(\d+)\s*(?:\||\.|\u00b7)\s*prefix\s*:\s*(.+)$/i)
  if (prefixMatch) {
    return {
      index: Number.parseInt(prefixMatch[1], 10),
      stripPrefix: prefixMatch[2].trim(),
    }
  }

  const suffixMatch = text.match(/^idx\s*:\s*(\d+)\s*(?:\||\.|\u00b7)\s*suffix\s*:\s*(.+)$/i)
  if (suffixMatch) {
    return {
      index: Number.parseInt(suffixMatch[1], 10),
      stripSuffix: suffixMatch[2].trim(),
    }
  }

  const indexMatch = text.match(/^idx\s*:\s*(\d+)$/i)
  if (indexMatch) {
    return Number.parseInt(indexMatch[1], 10)
  }

  return text
}

const supplierToForm = (supplier) => ({
  name: supplier?.name || '',
  code: supplier?.code || '',
  gst: supplier?.gst || '',
  address: supplier?.address || '',
  paymentMode: supplier?.paymentMode || 'cash',
  categories: Array.isArray(supplier?.categories) ? supplier.categories : [],
  categoryDraft: '',
  isActive: supplier?.isActive ?? true,
  strategy: supplier?.qrMapping?.strategy || 'delimiter',
  detectionType: supplier?.detectionPattern?.type || 'contains',
  detectionPattern: supplier?.detectionPattern?.pattern || '',
  delimiter: supplier?.qrMapping?.delimiter || '|',
  fieldMap: {
    supplierCode: formatFieldMapValue(
      supplier?.qrMapping?.fieldMap?.supplierCode,
      defaultFieldMap.supplierCode,
    ),
    category: formatFieldMapValue(
      supplier?.qrMapping?.fieldMap?.category,
      defaultFieldMap.category,
    ),
    grossWeight: formatFieldMapValue(
      supplier?.qrMapping?.fieldMap?.grossWeight,
      defaultFieldMap.grossWeight,
    ),
    stoneWeight: formatFieldMapValue(
      supplier?.qrMapping?.fieldMap?.stoneWeight,
      defaultFieldMap.stoneWeight,
    ),
    netWeight: formatFieldMapValue(
      supplier?.qrMapping?.fieldMap?.netWeight,
      defaultFieldMap.netWeight,
    ),
  },
})

const helperTextByStrategy = {
  delimiter:
    'Use this for QR strings split by a symbol like / or |. The supplier can also use labels such as GW, GSW, NSW, NW, OW, KT, or item/design number tags.',
  key_value:
    'Use this when QR text has labels like GW, GSW, NSW, NW, OW, KT, or item/design tags. Good for suppliers that describe each field in text.',
  venzora:
    'Use this for tokenized strings like G16.970, N16.654, L0.316, and CH-435A, where item code and design code may already be included.',
}

const matchesDefaultFieldMap = (fieldMap = {}) =>
  Object.entries(defaultFieldMap).every(
    ([key, fallback]) => String(fieldMap?.[key] ?? '') === String(fallback),
  )

const getTemplateKey = (form) => {
  if (form.strategy === 'venzora') return 'venzora'
  if (form.strategy === 'key_value') return 'labels'
  if (
    form.strategy === 'delimiter' &&
    form.delimiter === '|' &&
    form.detectionType === 'contains' &&
    form.detectionPattern === '' &&
    matchesDefaultFieldMap(form.fieldMap)
  ) {
    return 'auto'
  }
  if (
    form.strategy === 'delimiter' &&
    form.delimiter === '/' &&
    form.detectionType === 'contains' &&
    form.detectionPattern === ''
  ) {
    return 'positional'
  }

  return 'custom'
}

export default function SupplierFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const supplier = useMemo(() => location.state?.supplier ?? null, [location.state])
  const isEditing = Boolean(supplier?._id)
  const [form, setForm] = useState(() =>
    isEditing ? supplierToForm(supplier) : createEmptyForm()
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdvancedQr, setShowAdvancedQr] = useState(false)

  useEffect(() => {
    setForm(isEditing ? supplierToForm(supplier) : createEmptyForm())
    setError('')
    setShowAdvancedQr(false)
  }, [isEditing, supplier])

  const handleFormChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleFieldMapChange = (field, value) => {
    setForm((current) => ({
      ...current,
      fieldMap: {
        ...current.fieldMap,
        [field]: value,
      },
    }))
  }

  const applyQrTemplate = (template) => {
    setForm((current) => ({
      ...current,
      strategy: template.strategy,
      delimiter: template.delimiter,
      detectionType: template.detectionType,
      detectionPattern: template.detectionPattern,
      fieldMap: {
        ...current.fieldMap,
        ...template.fieldMap,
      },
    }))

    setShowAdvancedQr(template.key === 'custom')
  }

  const handleAddCategory = () => {
    const nextCategory = form.categoryDraft.trim()
    if (!nextCategory) return

    setForm((current) => ({
      ...current,
      categories: current.categories.includes(nextCategory)
        ? current.categories
        : [...current.categories, nextCategory],
      categoryDraft: '',
    }))
  }

  const handleRemoveCategory = (category) => {
    setForm((current) => ({
      ...current,
      categories: current.categories.filter((item) => item !== category),
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedCode = form.code.trim()

    if (!trimmedName || !trimmedCode) {
      setError('Name and code are required.')
      return
    }

    setIsSaving(true)
    setError('')

    const payload = {
      name: trimmedName,
      code: trimmedCode,
      gst: form.gst.trim(),
      address: form.address.trim(),
      paymentMode: form.paymentMode,
      categories: form.categories,
      isActive: form.isActive,
      detectionPattern: form.detectionPattern.trim()
        ? {
            type: form.detectionType,
            pattern: form.detectionPattern.trim(),
          }
        : null,
      qrMapping: {
        strategy: form.strategy,
        delimiter: form.delimiter || '|',
        fieldMap: {
          supplierCode: parseFieldMapValue(form.fieldMap.supplierCode, 0),
          category: parseFieldMapValue(form.fieldMap.category, 1),
          grossWeight: parseFieldMapValue(form.fieldMap.grossWeight, 2),
          stoneWeight: parseFieldMapValue(form.fieldMap.stoneWeight, 3),
          netWeight: parseFieldMapValue(form.fieldMap.netWeight, 4),
        },
      },
    }

    try {
      if (isEditing) {
        await updateSupplier(supplier._id, payload)
        navigate('/suppliers', {
          replace: true,
          state: { successMessage: `Updated ${trimmedName}.` },
        })
        return
      }

      await createSupplier(payload)
      navigate('/suppliers', {
        replace: true,
        state: { successMessage: `Created ${trimmedName}.` },
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.error
          : err?.message || 'Failed to save supplier.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Supplier Setup"
        title={isEditing ? `Edit ${supplier?.name || 'Supplier'}` : 'Add Supplier'}
        description="Create supplier profiles with a simple QR template first, then fine-tune matching and field positions only when needed."
        actions={
          <button
            type="button"
            onClick={() => navigate('/suppliers')}
            className="luxury-button bg-white/5 text-muted hover:text-heading hover:bg-gold-600/10 border border-white/10 hover:border-gold-500/30 hover:-translate-x-0.5 transition-all duration-300"
            aria-label="Back to suppliers list"
          >
            Back to Suppliers
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-8 items-start">
        <aside className="space-y-6 xl:sticky xl:top-6">
          <SectionCard eyebrow="Snapshot" title="Supplier summary" className="!mb-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase text-muted font-bold mb-1">Mode</div>
                <div className="text-lg font-bold text-heading capitalize">
                  {form.paymentMode || 'cash'}
                </div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase text-muted font-bold mb-1">Active</div>
                <div className="text-lg font-bold text-primary">
                  {form.isActive ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
              <div className="text-[10px] uppercase text-muted font-bold mb-1">QR preset</div>
              <div className="text-lg font-bold text-primary capitalize">
                {form.strategy.replace('_', ' ')}
              </div>
            </div>
            <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
              <div className="text-[10px] uppercase text-muted font-bold mb-1">Category rule</div>
              <div className="text-sm text-muted">
                Keep category suggestions ready for the salesman, while still allowing manual category selection on the sale screen.
              </div>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Checklist" title="Before saving" className="!mb-0">
            <ul className="space-y-3 text-sm text-muted leading-relaxed">
              <li>Use a short unique supplier code.</li>
              <li>Settlement mode can be cash or credit.</li>
              <li>Some suppliers provide only item/design code, not business category.</li>
              <li>Unknown or partial QR formats should still allow manual sale completion.</li>
            </ul>
          </SectionCard>
        </aside>

        <SectionCard
          eyebrow="Supplier Details"
          title="Supplier Profile"
          description="Use a preset first, then fine-tune supplier matching, split characters, and field positions only if needed."
          className="!mb-0"
        >
          <form className="space-y-8" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Legal Name</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) => handleFormChange('name', event.target.value)}
                  placeholder="e.g. Ashok Jewellers"
                  aria-label="Legal name"
                />
              </label>

              <label className="field">
                <span className="field-label">Unique Code</span>
                <input
                  className="input"
                  value={form.code}
                  onChange={(event) => handleFormChange('code', event.target.value)}
                  placeholder="e.g. ASH01"
                  aria-label="Unique code"
                />
              </label>

              <label className="field">
                <span className="field-label">GST Number</span>
                <input
                  className="input"
                  value={form.gst}
                  onChange={(event) => handleFormChange('gst', event.target.value)}
                  placeholder="e.g. 29ABCDE..."
                  aria-label="GST number"
                />
              </label>

              <label className="field">
                <span className="field-label">Settlement Mode</span>
                <select
                  className="input"
                  value={form.paymentMode}
                  onChange={(event) => handleFormChange('paymentMode', event.target.value)}
                  aria-label="Settlement mode"
                >
                  {paymentModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">How to read the QR</span>
                <select
                  className="input"
                  value={form.strategy}
                  onChange={(event) => handleFormChange('strategy', event.target.value)}
                  aria-label="How to read the QR"
                >
                  {strategyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">How to match the supplier</span>
                <select
                  className="input"
                  value={form.detectionType}
                  onChange={(event) => handleFormChange('detectionType', event.target.value)}
                  aria-label="How to match the supplier"
                >
                  {detectionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field mb-0">
              <span className="field-label">Supplier name, code, or pattern</span>
              <input
                className="input"
                value={form.detectionPattern}
                onChange={(event) => handleFormChange('detectionPattern', event.target.value)}
                placeholder={
                  form.detectionType === 'regex'
                    ? 'e.g. ^JFC\\d+'
                    : form.detectionType === 'prefix'
                      ? 'e.g. USV'
                      : 'e.g. SWNK'
                }
                aria-label="Supplier name, code, or pattern"
              />
            </label>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
              <label className="field mb-0">
                <span className="field-label">Registered Address</span>
                <textarea
                  className="input input--textarea"
                  rows="5"
                  value={form.address}
                  onChange={(event) => handleFormChange('address', event.target.value)}
                  placeholder="Physical storage or billing address"
                  aria-label="Registered address"
                />
              </label>

              <div className="surface-panel-faint panel-border rounded-2xl p-5 flex flex-col gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
                    Allowed Categories
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Maintain business categories here. Salesman will get a dropdown
                    with manual fallback.
                  </p>
                </div>
                <div className="flex gap-3">
                  <input
                    className="input"
                    value={form.categoryDraft}
                    onChange={(event) => handleFormChange('categoryDraft', event.target.value)}
                    placeholder="Add category"
                    aria-label="Add supplier category"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleAddCategory()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="luxury-button bg-white/5 text-on-accent hover:bg-white/10 border border-white/10"
                    aria-label="Add supplier category"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.categories.length === 0 ? (
                    <span className="text-sm text-muted">No categories configured yet.</span>
                  ) : (
                    form.categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleRemoveCategory(category)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-on-accent hover:border-gold-500/30 hover:bg-gold-600/10"
                        aria-label={`Remove category ${category}`}
                      >
                        {category} Ã—
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b panel-border pb-4">
                <div>
                  <span className="eyebrow">QR Setup</span>
                  <h3 className="text-xl font-bold font-display text-heading mt-2">
                    Choose a template first
                  </h3>
                  <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
                    Start simple. Pick a template that matches the supplier QR,
                    then open advanced fields only if you need to fine-tune split
                    characters, prefixes, suffixes, or field positions.
                  </p>
                </div>
                <span className="text-[10px] text-muted font-bold tracking-widest bg-white/5 px-2 py-1 rounded">
                  {getTemplateKey(form) === 'custom'
                    ? 'Custom'
                    : 'Template applied'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {qrTemplates.map((template) => {
                  const active = getTemplateKey(form) === template.key
                  return (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => applyQrTemplate(template)}
                      className={`text-left rounded-2xl border p-4 transition-all ${
                        active
                          ? 'border-gold-500/50 bg-gold-500/10 shadow-lg shadow-gold-500/10'
                          : 'border-white/10 bg-white/5 hover:border-gold-500/30 hover:bg-white/10'
                      }`}
                      aria-label={`Use ${template.title} template`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
                          {template.badge}
                        </span>
                        {active ? (
                          <span className="text-[10px] uppercase tracking-widest font-bold text-gold-500">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <div className="font-display text-lg font-bold text-heading">
                        {template.title}
                      </div>
                      <div className="mt-1 text-sm font-medium text-muted">
                        {template.subtitle}
                      </div>
                      <p className="mt-3 text-sm text-muted leading-relaxed">
                        {template.summary}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted leading-relaxed">
                <strong className="text-heading">How to think about it:</strong>{' '}
                a supplier may give you a fixed-slot QR, a label-based QR like
                <span className="text-primary font-semibold"> GW / GSW / NSW / NW / OW / KT</span>,
                or a token format where item number and design number are spelled out.
                Choose the closest template first, then fine-tune the advanced
                values only if the sample still does not parse correctly.
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedQr((current) => !current)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-heading hover:bg-white/10 hover:border-gold-500/30 transition-all"
                aria-expanded={showAdvancedQr}
              >
                {showAdvancedQr ? 'Hide advanced QR fields' : 'Show advanced QR fields'}
              </button>

              {showAdvancedQr && (
                <div className="space-y-5">
                  <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted">
                    <strong className="text-heading">Advanced note:</strong>{' '}
                    {helperTextByStrategy[form.strategy]}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <label className="field mb-0">
                      <span className="field-label">How to read the QR</span>
                      <select
                        className="input"
                        value={form.strategy}
                        onChange={(event) =>
                          handleFormChange('strategy', event.target.value)
                        }
                        aria-label="How to read the QR"
                      >
                        {strategyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field mb-0">
                      <span className="field-label">How to match the supplier</span>
                      <select
                        className="input"
                        value={form.detectionType}
                        onChange={(event) =>
                          handleFormChange('detectionType', event.target.value)
                        }
                        aria-label="How to match the supplier"
                      >
                        {detectionTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field mb-0">
                      <span className="field-label">Supplier name, code, or pattern</span>
                      <input
                        className="input"
                        value={form.detectionPattern}
                        onChange={(event) =>
                          handleFormChange('detectionPattern', event.target.value)
                        }
                        placeholder={
                          form.detectionType === 'regex'
                            ? 'e.g. ^JFC\\d+'
                            : form.detectionType === 'prefix'
                              ? 'e.g. USV'
                              : 'e.g. SWNK'
                        }
                        aria-label="Supplier name, code, or pattern"
                      />
                    </label>

                    <label className="field mb-0">
                      <span className="field-label">Split character</span>
                      <input
                        className="input"
                        value={form.delimiter}
                        onChange={(event) => handleFormChange('delimiter', event.target.value)}
                        placeholder="|"
                        aria-label="Split character"
                        disabled={form.strategy !== 'delimiter'}
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted leading-relaxed">
                    Use positions only if the supplier QR is fixed by slot. If
                    the supplier prints labels like GW, GSW, NSW, NW, OW, or KT,
                    keep this section simple and let the template do the heavy
                    lifting.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-5">
                    {mappingFields.map((item) => (
                      <label className="field mb-0" key={item.key}>
                        <span className="field-label">{item.label}</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={form.fieldMap[item.key]}
                          onChange={(event) =>
                            handleFieldMapChange(item.key, event.target.value)
                          }
                          placeholder={defaultFieldMap[item.key]}
                          aria-label={item.label}
                          disabled={form.strategy !== 'delimiter'}
                        />
                        <span className="mt-2 text-[11px] text-muted leading-relaxed">
                          {item.key === 'grossWeight'
                            ? 'Use a field position, or an advanced value like idx: 1 · prefix: GW.'
                            : item.key === 'stoneWeight'
                              ? 'For combined stone fields, you can use sum: 5 + 2.'
                              : item.key === 'netWeight'
                                ? 'For a direct value, use idx: 4. For labelled values, keep the template simple.'
                                : item.key === 'category'
                                  ? 'Business category can still be suggested from the supplier, but the salesman can override it.'
                                  : 'Use the supplier code position or a prefixed value if the supplier prints extra text.'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error ? (
              <p
                className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-xl font-bold"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t panel-border">
              <button
                type="button"
                onClick={() => navigate('/suppliers')}
                className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-muted hover:text-primary transition-all bg-white/5 hover:bg-white/10 rounded-2xl"
                aria-label="Cancel supplier editing"
              >
                Cancel
              </button>
              <button
                disabled={isSaving}
                type="submit"
                className="flex-[2] primary-luxury-button text-sm text-on-accent"
                aria-label={isEditing ? 'Save supplier changes' : 'Create supplier'}
              >
                {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Supplier'}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  )
}


