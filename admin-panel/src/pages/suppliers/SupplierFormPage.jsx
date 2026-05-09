import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { createSupplier, updateSupplier } from '../../api/suppliers.api'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import SupplierFormActions from './components/SupplierFormActions'
import SupplierFormBasicsSection from './components/SupplierFormBasicsSection'
import SupplierFormQrSetupSection from './components/SupplierFormQrSetupSection'
import SupplierFormSidebar from './components/SupplierFormSidebar'

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
        <SupplierFormSidebar form={form} />

        <SectionCard
          eyebrow="Supplier Details"
          title="Supplier Profile"
          description="Use a preset first, then fine-tune supplier matching, split characters, and field positions only if needed."
          className="!mb-0"
        >
          <form className="space-y-8" onSubmit={handleSubmit} noValidate>
            <SupplierFormBasicsSection
              form={form}
              paymentModes={paymentModes}
              onFormChange={handleFormChange}
              onAddCategory={handleAddCategory}
              onRemoveCategory={handleRemoveCategory}
            />

            <SupplierFormQrSetupSection
              form={form}
              showAdvancedQr={showAdvancedQr}
              setShowAdvancedQr={setShowAdvancedQr}
              helperTextByStrategy={helperTextByStrategy}
              qrTemplates={qrTemplates}
              getTemplateKey={getTemplateKey}
              strategyOptions={strategyOptions}
              detectionTypeOptions={detectionTypeOptions}
              mappingFields={mappingFields}
              defaultFieldMap={defaultFieldMap}
              onFormChange={handleFormChange}
              onFieldMapChange={handleFieldMapChange}
              applyQrTemplate={applyQrTemplate}
            />

            <SupplierFormActions
              error={error}
              onCancel={() => navigate('/suppliers')}
              isSaving={isSaving}
              submitLabel={isEditing ? 'Save Changes' : 'Create Supplier'}
            />
          </form>
        </SectionCard>
      </div>
    </div>
  )
}


