import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  testSupplierParse,
  updateSupplier,
} from '../../api/suppliers.api'
import { useAuthStore } from '../../store/authStore'

const paymentModes = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

const mappingFields = [
  { key: 'supplierCode', label: 'Supplier code index', help: 'Usually 0 for delimiter QR strings.' },
  { key: 'category', label: 'Category index', help: 'Where the category lives in the QR split.' },
  { key: 'grossWeight', label: 'Gross weight index', help: 'Delimiter position for gross weight.' },
  { key: 'stoneWeight', label: 'Stone weight index', help: 'Delimiter position for stone weight.' },
  { key: 'netWeight', label: 'Net weight index', help: 'Delimiter position for net weight.' },
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

const statusText = (isActive) => (isActive ? 'Active' : 'Inactive')

const formatFieldValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'Not parsed'
  }

  if (typeof value === 'object' && 'parsed' in value) {
    return value.parsed ? String(value.value) : 'Not parsed'
  }

  return String(value)
}

const getCombinedQrErrors = (result) => [
  ...((Array.isArray(result?.errors) ? result.errors : []) || []),
  ...((Array.isArray(result?.meta?.parseErrors) ? result.meta.parseErrors : []) || []),
]

const getQrDebugField = (result, key) => {
  if (!result) {
    return { value: null, parsed: false }
  }

  if (result.fields?.[key]) {
    return result.fields[key]
  }

  if (key === 'supplier') {
    const value = result.supplier || result.supplierCode || result.supplierName
    return value ? { value, parsed: true } : { value: null, parsed: false }
  }

  if (key === 'itemCode') {
    const value = result.itemCode ?? result.category ?? result.meta?.itemCode?.value ?? null
    return value ? { value, parsed: true } : { value: null, parsed: false }
  }

  if (key === 'grossWeight' || key === 'stoneWeight' || key === 'netWeight') {
    const value = result[key]
    return value === null || value === undefined
      ? { value: null, parsed: false }
      : { value, parsed: true }
  }

  if (key === 'karat') {
    const value = result.karat
    return value ? { value, parsed: true } : { value: null, parsed: false }
  }

  return { value: null, parsed: false }
}

const SupplierCard = ({ supplier, onEdit, onDelete, deletingId }) => {
  return (
    <article className={`p-6 bg-dark-900 border border-white/5 rounded-2xl premium-shadow hover:border-gold-600/30 transition-all group ${supplier.isActive ? '' : 'opacity-60 grayscale'}`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="eyebrow">Supplier</span>
          <h3 className="text-xl font-bold font-display">{supplier.name}</h3>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${supplier.isActive ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-white/30'}`}>
          {statusText(supplier.isActive)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-dark-950/50 p-3 rounded-xl border border-white/5">
          <div className="text-[10px] uppercase text-white/20 font-bold mb-1">Code</div>
          <div className="text-white/80 font-mono">{supplier.code || '-'}</div>
        </div>
        <div className="bg-dark-950/50 p-3 rounded-xl border border-white/5">
          <div className="text-[10px] uppercase text-white/20 font-bold mb-1">Payment</div>
          <div className="text-white/80 font-mono capitalize">{supplier.paymentMode || 'cash'}</div>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div>
          <div className="text-[10px] uppercase text-white/20 font-bold mb-1">Categories</div>
          <div className="text-xs text-white/60 line-clamp-2 italic">
            {supplier.categories?.length ? supplier.categories.join(', ') : 'None configured'}
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/5">
          {Object.entries(supplier.qrMapping?.fieldMap || {}).filter(([k]) => k !== 'supplierCode').map(([key, val]) => (
            <div key={key} className="text-center">
              <div className="text-[8px] uppercase text-white/20 font-bold mb-1">{key.replace('Weight', '')}</div>
              <div className="text-xs font-bold text-gold-500">{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-white/5">
        <button type="button" className="flex-1 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 rounded-xl transition-all" onClick={() => onEdit(supplier)}>
          Edit
        </button>
        <button
          type="button"
          className="px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
          onClick={() => onDelete(supplier)}
          disabled={deletingId === supplier._id}
        >
          {deletingId === supplier._id ? '...' : 'Delete'}
        </button>
      </div>
    </article>
  )
}

const SuppliersPage = () => {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [form, setForm] = useState(createEmptyForm)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [qrSupplierId, setQrSupplierId] = useState('')
  const [rawQR, setRawQR] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [qrError, setQrError] = useState('')
  const [qrResult, setQrResult] = useState(null)

  useEffect(() => {
    let active = true

    const loadSuppliers = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await getSuppliers()
        if (!active) {
          return
        }

        const nextSuppliers = Array.isArray(response) ? response : []
        setSuppliers(nextSuppliers)
      } catch (error) {
        if (!active) {
          return
        }

        const message = error instanceof ApiError ? error.error : error?.message || 'Failed to load suppliers.'
        setErrorMessage(message)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      active = false
    }
  }, [reloadTick])

  const resetForm = () => {
    setEditingSupplier(null)
    setForm(createEmptyForm())
    setFormError('')
  }

  const beginEdit = (supplier) => {
    setEditingSupplier(supplier)
    setForm(supplierToForm(supplier))
    setFormError('')
    setSuccessMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
      setFormError('Name and code are required.')
      return
    }

    setIsSaving(true)
    setFormError('')
    setSuccessMessage('')

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
      if (editingSupplier?._id) {
        await updateSupplier(editingSupplier._id, payload)
        setSuccessMessage(`Updated ${trimmedName}.`)
      } else {
        await createSupplier(payload)
        setSuccessMessage(`Created ${trimmedName}.`)
      }

      resetForm()
      setReloadTick((value) => value + 1)
    } catch (error) {
      const message = error instanceof ApiError ? error.error : error?.message || 'Failed to save supplier.'
      setFormError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (supplier) => {
    const confirmed = window.confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)

    if (!confirmed) {
      return
    }

    setDeletingId(supplier._id)
    setSuccessMessage('')
    setFormError('')

    try {
      const response = await deleteSupplier(supplier._id)
      setSuccessMessage(response?.message || `Deleted ${supplier.name}.`)

      if (editingSupplier?._id === supplier._id) {
        resetForm()
      }

      setReloadTick((value) => value + 1)
    } catch (error) {
      const message = error instanceof ApiError ? error.error : error?.message || 'Failed to delete supplier.'
      setFormError(message)
    } finally {
      setDeletingId('')
    }
  }

  const handleParseTest = async (event) => {
    event.preventDefault()

    const trimmedRaw = rawQR.trim()

    if (!trimmedRaw) {
      setQrError('Paste a raw QR string before testing.')
      return
    }

    setIsTesting(true)
    setQrError('')
    setSuccessMessage('')

    try {
      const payload = { raw: trimmedRaw }

      if (qrSupplierId) {
        payload.supplierId = qrSupplierId
      }

      const result = await testSupplierParse(payload)
      setQrResult(result)
    } catch (error) {
      const message = error instanceof ApiError ? error.error : error?.message || 'QR parsing failed.'
      setQrError(message)
      setQrResult(null)
    } finally {
      setIsTesting(false)
    }
  }

  const selectedSupplier = suppliers.find((supplier) => supplier._id === qrSupplierId) || null

  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Inventory Management</span>
          <h1 className="text-4xl font-bold font-display gold-gradient-text tracking-tight uppercase">Suppliers List</h1>
          <p className="text-white/40 mt-2 max-w-xl">
            Manage your suppliers, configure delimiter mappings, and test QR parsing to ensure scanning accuracy on the mobile app.
          </p>
        </div>
      </section>

      {successMessage && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-2xl animate-fade-in duration-300">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex justify-between items-center transition-all">
          <p>{errorMessage}</p>
          <button type="button" className="text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white" onClick={() => setReloadTick((value) => value + 1)}>
            Retry Logic
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <section className="xl:col-span-5">
            <div className="surface-card">
              <div className="surface-card__header">
                <div>
                  <span className="eyebrow">Supplier Setup</span>
                  <h2 className="text-xl font-bold font-display">{editingSupplier ? `Edit ${editingSupplier.name}` : 'Add New Supplier'}</h2>
                </div>
                {editingSupplier && (
                  <button type="button" className="text-xs font-bold text-gold-500 hover:text-gold-400" onClick={resetForm}>
                    Discard Changes
                  </button>
                )}
              </div>

              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">Legal Name</span>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(event) => handleFormChange('name', event.target.value)}
                      placeholder="e.g. Ashok Jewellers"
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Unique Code</span>
                    <input
                      className="input"
                      value={form.code}
                      onChange={(event) => handleFormChange('code', event.target.value)}
                      placeholder="e.g. ASH01"
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">GST Number</span>
                    <input
                      className="input"
                      value={form.gst}
                      onChange={(event) => handleFormChange('gst', event.target.value)}
                      placeholder="e.g. 29ABCDE..."
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Settlement Mode</span>
                    <select
                      className="input"
                      value={form.paymentMode}
                      onChange={(event) => handleFormChange('paymentMode', event.target.value)}
                    >
                      {paymentModes.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">Registered Address</span>
                  <textarea
                    className="input input--textarea"
                    rows="2"
                    value={form.address}
                    onChange={(event) => handleFormChange('address', event.target.value)}
                    placeholder="Physical storage or billing address"
                  />
                </label>

                <label className="field">
                    <span className="field-label">Active Categories</span>
                    <input
                      className="input"
                      value={form.categories}
                      onChange={(event) => handleFormChange('categories', event.target.value)}
                      placeholder="Ring, Necklace, Bracelet"
                    />
                </label>

                <div className="bg-dark-950/50 rounded-2xl p-6 border border-white/5 space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gold-500">QR Delimiter Mapping</h3>
                    <span className="text-[10px] text-white/20 font-bold">LEGACY MODE</span>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span className="field-label">Symbol</span>
                      <input
                        className="input"
                        value={form.delimiter}
                        onChange={(event) => handleFormChange('delimiter', event.target.value)}
                        placeholder="|"
                      />
                    </label>

                    {mappingFields.map((item) => (
                      <label className="field" key={item.key}>
                        <span className="field-label">{item.label}</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={form.fieldMap[item.key]}
                          onChange={(event) => handleFieldMapChange(item.key, event.target.value)}
                          placeholder={defaultFieldMap[item.key]}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white/90">Status</span>
                        <span className="text-[10px] text-white/30 font-bold uppercase">Enable for mobile app</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(event) => handleFormChange('isActive', event.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-dark-950 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold-500 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-600/20 border border-white/10"></div>
                    </label>
                </div>

                {formError && (
                  <p className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-xl font-bold" role="alert">
                    {formError}
                  </p>
                )}

                <button type="submit" className="primary-luxury-button w-full" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Add Supplier'}
                </button>
              </form>
            </div>
        </section>

        <section className="xl:col-span-7 space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold font-display">Active Suppliers</h2>
              <p className="text-xs text-white/30 uppercase tracking-widest font-bold mt-1">
                {isLoading ? 'Loading...' : `${suppliers.length} Records Found`}
              </p>
            </div>
            <button type="button" className="text-xs font-bold text-white/40 hover:text-white transition-colors" onClick={() => setReloadTick((value) => value + 1)}>
              Refresh Data
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-40">
              <div className="h-64 bg-dark-900 rounded-2xl animate-pulse" />
              <div className="h-64 bg-dark-900 rounded-2xl animate-pulse" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="glass-panel p-20 text-center border-dashed border-white/10">
              <div className="text-3xl mb-4">＋</div>
              <h3 className="text-lg font-bold mb-2">No Suppliers Found</h3>
              <p className="text-sm text-white/30">Add a supplier to configure QR parsing rules.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier._id}
                  supplier={supplier}
                  onEdit={beginEdit}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              ))}
            </div>
          )}

          {/* QR Debug Tool Integrated Below */}
          <div className="bg-gradient-to-br from-dark-900 to-dark-950 p-8 rounded-2xl border border-white/5 premium-shadow">
            <div className="flex justify-between items-center mb-10">
              <div>
                <span className="eyebrow bg-blue-500/10 text-blue-400">TOOLS</span>
                <h2 className="text-xl font-bold font-display">QR Test Tool</h2>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">
                    {selectedSupplier ? `Testing with: ${selectedSupplier.name}` : 'Select a supplier to begin testing'}
                </p>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleParseTest} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <label className="field">
                  <span className="field-label">Target Config</span>
                  <select
                    className="input"
                    value={qrSupplierId}
                    onChange={(event) => setQrSupplierId(event.target.value)}
                    disabled={suppliers.length === 0}
                  >
                    <option value="">Auto-detect Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier._id} value={supplier._id}>
                        {supplier.name} ({supplier.code})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field md:col-span-2">
                  <span className="field-label">Raw QR Capture</span>
                  <div className="relative">
                    <input
                      className="input font-mono text-xs pr-20"
                      value={rawQR}
                      onChange={(event) => setRawQR(event.target.value)}
                      placeholder="Paste QR string here..."
                    />
                    <button type="submit" disabled={isTesting} className="absolute right-1 top-1 bottom-1 px-4 bg-gold-600/10 text-gold-500 text-[10px] font-bold rounded-lg hover:bg-gold-600/20 transition-all">
                      {isTesting ? 'BUSY' : 'PARSE'}
                    </button>
                  </div>
                </label>
              </div>

              {qrError && (
                <p className="text-red-400 text-xs font-bold p-3 bg-red-400/5 rounded-xl border border-red-400/10">
                  {qrError}
                </p>
              )}
            </form>

            {qrResult && (
              <div className="mt-10 p-6 bg-dark-950/50 rounded-2xl border border-white/5 animate-zoom-in duration-200">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h3 className="font-bold text-white/80">
                    {getCombinedQrErrors(qrResult.parseResult).length === 0 ? 'Parse Successful' : 'Validation Warn'}
                  </h3>
                  <div
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                      getCombinedQrErrors(qrResult.parseResult).length === 0
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-gold-500/10 text-gold-500'
                    }`}
                  >
                    {getCombinedQrErrors(qrResult.parseResult).length === 0 ? 'TRUSTED' : 'PARTIAL'}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  {[
                    ['supplier', 'Supplier'],
                    ['itemCode', 'Item Code'],
                    ['grossWeight', 'Gross'],
                    ['stoneWeight', 'Stone'],
                    ['netWeight', 'Net'],
                  ].map(([key, label]) => {
                    const fieldValue = getQrDebugField(qrResult?.parseResult, key)
                    return (
                      <div key={key}>
                        <div className="text-[8px] uppercase text-white/20 font-bold mb-1">{label}</div>
                        <div className={`text-sm font-bold ${fieldValue?.parsed ? 'text-white' : 'text-white/20'}`}>
                          {formatFieldValue(fieldValue)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {getCombinedQrErrors(qrResult.parseResult).length > 0 && (
                  <div className="bg-gold-500/5 border border-gold-500/10 p-4 rounded-xl">
                    <div className="text-[10px] text-gold-600 font-bold uppercase mb-2">Logic Inconsistencies:</div>
                    <ul className="space-y-1">
                      {getCombinedQrErrors(qrResult.parseResult).map((item, idx) => (
                        <li key={idx} className="text-xs text-gold-500/80">• <strong className="uppercase">{item.field}:</strong> {item.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default SuppliersPage
