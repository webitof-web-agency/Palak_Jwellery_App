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
  { key: 'supplierCode', label: 'Supplier code index' },
  { key: 'category', label: 'Category index' },
  { key: 'grossWeight', label: 'Gross weight index' },
  { key: 'stoneWeight', label: 'Stone weight index' },
  { key: 'netWeight', label: 'Net weight index' },
]

const defaultFieldMap = {
  supplierCode: '0',
  category: '1',
  grossWeight: '2',
  stoneWeight: '3',
  netWeight: '4',
}

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

const toFieldValue = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  return String(value)
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
    supplierCode: toFieldValue(
      supplier?.qrMapping?.fieldMap?.supplierCode,
      defaultFieldMap.supplierCode
    ),
    category: toFieldValue(
      supplier?.qrMapping?.fieldMap?.category,
      defaultFieldMap.category
    ),
    grossWeight: toFieldValue(
      supplier?.qrMapping?.fieldMap?.grossWeight,
      defaultFieldMap.grossWeight
    ),
    stoneWeight: toFieldValue(
      supplier?.qrMapping?.fieldMap?.stoneWeight,
      defaultFieldMap.stoneWeight
    ),
    netWeight: toFieldValue(
      supplier?.qrMapping?.fieldMap?.netWeight,
      defaultFieldMap.netWeight
    ),
  },
})

const parseInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const helperTextByStrategy = {
  delimiter:
    'Use this for positional QR strings split by a symbol like / or |. Best for Adinath and Utsav-like inputs.',
  key_value:
    'Use this when QR text has labels like GW, SS, NW, KT. Category may still need manual business input.',
  venzora:
    'Use this for Venzora tokenized strings like G16.970 / N16.654 / CH-435A.',
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

  useEffect(() => {
    setForm(isEditing ? supplierToForm(supplier) : createEmptyForm())
    setError('')
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
          supplierCode: parseInteger(form.fieldMap.supplierCode, 0),
          category: parseInteger(form.fieldMap.category, 1),
          grossWeight: parseInteger(form.fieldMap.grossWeight, 2),
          stoneWeight: parseInteger(form.fieldMap.stoneWeight, 3),
          netWeight: parseInteger(form.fieldMap.netWeight, 4),
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
        description="Create supplier profiles, choose the parser strategy, and keep business categories separate from design codes."
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
              <div className="text-[10px] uppercase text-muted font-bold mb-1">Parser</div>
              <div className="text-lg font-bold text-primary capitalize">
                {form.strategy.replace('_', ' ')}
              </div>
            </div>
            <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
              <div className="text-[10px] uppercase text-muted font-bold mb-1">Category policy</div>
              <div className="text-sm text-muted">
                Salesman gets suggestions from supplier categories, but category remains a required business field.
              </div>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Checklist" title="Before saving" className="!mb-0">
            <ul className="space-y-3 text-sm text-muted leading-relaxed">
              <li>• Use a short unique supplier code.</li>
              <li>• Settlement mode can be cash or credit.</li>
              <li>• Some suppliers provide only item/design code, not business category.</li>
              <li>• Unknown or partial QR formats should still allow manual sale completion.</li>
            </ul>
          </SectionCard>
        </aside>

        <SectionCard
          eyebrow="Supplier Details"
          title="Supplier Profile"
          description="Configure parsing behavior, supplier detection, and category suggestions in one place."
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
                <span className="field-label">Parser Strategy</span>
                <select
                  className="input"
                  value={form.strategy}
                  onChange={(event) => handleFormChange('strategy', event.target.value)}
                  aria-label="QR parser strategy"
                >
                  {strategyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Detection Type</span>
                <select
                  className="input"
                  value={form.detectionType}
                  onChange={(event) => handleFormChange('detectionType', event.target.value)}
                  aria-label="Supplier detection type"
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
              <span className="field-label">Detection Pattern</span>
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
                aria-label="Supplier detection pattern"
              />
            </label>

            <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted">
              <strong className="text-heading">Strategy note:</strong>{' '}
              {helperTextByStrategy[form.strategy]}
            </div>

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
                    Maintain business categories here. Salesman will get a dropdown with manual fallback.
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
                    <span className="text-sm text-muted">
                      No categories configured yet.
                    </span>
                  ) : (
                    form.categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleRemoveCategory(category)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-on-accent hover:border-gold-500/30 hover:bg-gold-600/10"
                        aria-label={`Remove category ${category}`}
                      >
                        {category} ×
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-6">
              <div className="flex justify-between items-center border-b panel-border pb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-heading">
                  Delimiter Mapping
                </h3>
                <span className="text-[10px] text-muted font-bold tracking-widest bg-white/5 px-2 py-1 rounded">
                  {form.strategy === 'delimiter' ? 'Editable' : 'Disabled for current strategy'}
                </span>
              </div>

              <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted">
                Use these index fields only for delimiter-style suppliers. For suppliers that do not provide category in QR, keep business category suggestions above and let salesman choose during sale entry.
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <label className="field mb-0">
                  <span className="field-label">Symbol</span>
                  <input
                    className="input"
                    value={form.delimiter}
                    onChange={(event) => handleFormChange('delimiter', event.target.value)}
                    placeholder="|"
                    aria-label="QR delimiter"
                    disabled={form.strategy !== 'delimiter'}
                  />
                </label>

                {mappingFields.map((item) => (
                  <label className="field mb-0" key={item.key}>
                    <span className="field-label">{item.label}</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={form.fieldMap[item.key]}
                      onChange={(event) => handleFieldMapChange(item.key, event.target.value)}
                      placeholder={defaultFieldMap[item.key]}
                      aria-label={item.label}
                      disabled={form.strategy !== 'delimiter'}
                    />
                  </label>
                ))}
              </div>
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
