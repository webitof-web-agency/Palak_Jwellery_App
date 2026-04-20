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
  categories: '',
  isActive: true,
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
  categories: Array.isArray(supplier?.categories) ? supplier.categories.join(', ') : '',
  isActive: supplier?.isActive ?? true,
  delimiter: supplier?.qrMapping?.delimiter || '|',
  fieldMap: {
    supplierCode: toFieldValue(supplier?.qrMapping?.fieldMap?.supplierCode, defaultFieldMap.supplierCode),
    category: toFieldValue(supplier?.qrMapping?.fieldMap?.category, defaultFieldMap.category),
    grossWeight: toFieldValue(supplier?.qrMapping?.fieldMap?.grossWeight, defaultFieldMap.grossWeight),
    stoneWeight: toFieldValue(supplier?.qrMapping?.fieldMap?.stoneWeight, defaultFieldMap.stoneWeight),
    netWeight: toFieldValue(supplier?.qrMapping?.fieldMap?.netWeight, defaultFieldMap.netWeight),
  },
})

const parseCategories = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const parseInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export default function SupplierFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const supplier = useMemo(() => location.state?.supplier ?? null, [location.state])
  const isEditing = Boolean(supplier?._id)
  const [form, setForm] = useState(() => (isEditing ? supplierToForm(supplier) : createEmptyForm()))
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
      categories: parseCategories(form.categories),
      isActive: form.isActive,
      qrMapping: {
        strategy: 'delimiter',
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
      const message = err instanceof ApiError ? err.error : err?.message || 'Failed to save supplier.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-shell space-y-8">
      {/* Page header */}
      <PageHeader
        eyebrow="Supplier Setup"
        title={isEditing ? `Edit ${supplier?.name || 'Supplier'}` : 'Add Supplier'}
        description="Create or update supplier profiles, settlement mode, and QR mappings in one dedicated page."
          actions={(
          <button
            type="button"
            onClick={() => navigate('/suppliers')}
            className="luxury-button bg-white/5 text-muted hover:text-heading hover:bg-gold-600/10 border border-white/10 hover:border-gold-500/30 hover:-translate-x-0.5 transition-all duration-300"
            aria-label="Back to suppliers list"
          >
            Back to Suppliers
          </button>
        )}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-8 items-start">
        {/* Overview rail */}
        <aside className="space-y-6 xl:sticky xl:top-6">
          <SectionCard eyebrow="Snapshot" title="Supplier summary" className="!mb-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase text-muted font-bold mb-1">Mode</div>
                <div className="text-lg font-bold text-heading capitalize">{form.paymentMode || 'cash'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase text-muted font-bold mb-1">Active</div>
                <div className="text-lg font-bold text-primary">{form.isActive ? 'Yes' : 'No'}</div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
              <div className="text-[10px] uppercase text-muted font-bold mb-1">QR delimiter</div>
              <div className="text-2xl font-bold font-mono text-primary">{form.delimiter || '|'}</div>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Checklist" title="Before saving" className="!mb-0">
            <ul className="space-y-3 text-sm text-muted leading-relaxed">
              <li>• Use a short unique supplier code.</li>
              <li>• Settlement mode can be cash or credit.</li>
              <li>• Keep QR mapping only for delimiter-based suppliers.</li>
            </ul>
          </SectionCard>
        </aside>

        {/* Supplier form */}
        <SectionCard
          eyebrow="Supplier Details"
          title="Supplier Profile"
          description="Keep the profile clean and configure QR mapping only if the supplier uses delimiter parsing."
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
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
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
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Active Categories</div>
                  <p className="mt-2 text-sm text-muted">Add one or more store categories for quick filtering.</p>
                </div>
                <input
                  className="input"
                  value={form.categories}
                  onChange={(event) => handleFormChange('categories', event.target.value)}
                  placeholder="Ring, Necklace, Bracelet"
                  aria-label="Active categories"
                />
              </div>
            </div>

            <div className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-6">
              <div className="flex justify-between items-center border-b panel-border pb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-heading">QR Delimiter Mapping</h3>
                <span className="text-[10px] text-muted font-bold tracking-widest bg-white/5 px-2 py-1 rounded">
                  Legacy Mode
                </span>
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
                    />
                  </label>
                ))}
              </div>
            </div>

            {error ? (
              <p className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-xl font-bold" role="alert">
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
