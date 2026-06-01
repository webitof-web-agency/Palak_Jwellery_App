import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { createSupplier, updateSupplier } from '../../api/suppliers.api'
import PageHeader from '../../components/ui/PageHeader'
import SupplierFormActions from './components/SupplierFormActions'
import SupplierFormBasicsSection from './components/SupplierFormBasicsSection'
import SupplierFormCategoriesSection from './components/SupplierFormCategoriesSection'
import SupplierFormKaratPuritySection from './components/SupplierFormKaratPuritySection'
import SupplierFormQrSetupSection from './components/SupplierFormQrSetupSection'
import SupplierFormDeveloperSection from './components/SupplierFormDeveloperSection'
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
    summary: 'Keeps the setup simple and lets the supplier rules stay hidden unless needed.',
    strategy: 'delimiter',
    delimiter: '|',
    detectionType: 'contains',
    detectionPattern: '',
    fieldMap: { ...defaultFieldMap },
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
    fieldMap: { ...defaultFieldMap },
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
  },
]

const sectionTabs = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'categories', label: 'Categories & Wastage' },
  { id: 'karat', label: 'Karat & Purity' },
  { id: 'qr', label: 'QR Template' },
  { id: 'advanced', label: 'Advanced' },
]

const createEmptyBusinessSettings = () => ({
  categories: [],
  purityOverrides: [],
  defaultWastagePercent: '',
  defaultStoneRate: '',
  netWeightRule: 'computed',
  stoneWeightRule: 'single',
  otherWeightRule: {
    deductOtherWeight: false,
    defaultOtherWeight: '',
  },
  qrNetTolerance: '',
})

const createEmptyQrProfile = () => ({
  profileKey: '',
  version: '',
  description: '',
})

const createEmptyForm = () => ({
  name: '',
  code: '',
  gst: '',
  address: '',
  paymentMode: 'cash',
  categories: [],
  categoryDraft: '',
  businessSettings: createEmptyBusinessSettings(),
  businessSettingsRaw: null,
  qrProfile: createEmptyQrProfile(),
  qrProfileRaw: null,
  isActive: true,
  strategy: 'delimiter',
  detectionType: 'contains',
  detectionPattern: '',
  delimiter: '|',
  fieldMap: { ...defaultFieldMap },
})

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const toNullableNumber = (value) => {
  const text = normalizeText(value)
  if (!text) {
    return null
  }

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

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

const toBusinessCategoryForm = (item) => ({
  name: item?.name || '',
  code: item?.code || '',
  colorLabel: item?.colorLabel || '',
  wastagePercent: item?.wastagePercent ?? '',
  isActive: item?.isActive ?? true,
  sortOrder: item?.sortOrder ?? '',
})

const toPurityOverrideForm = (item) => ({
  karat: item?.karat || '',
  purityPercent: item?.purityPercent ?? '',
  isActive: item?.isActive ?? true,
})

const supplierToForm = (supplier) => {
  const businessSettings = supplier?.businessSettings && typeof supplier.businessSettings === 'object'
    ? supplier.businessSettings
    : createEmptyBusinessSettings()
  const qrProfile = supplier?.qrProfile && typeof supplier.qrProfile === 'object'
    ? supplier.qrProfile
    : createEmptyQrProfile()

  return {
    name: supplier?.name || '',
    code: supplier?.code || '',
    gst: supplier?.gst || '',
    address: supplier?.address || '',
    paymentMode: supplier?.paymentMode || 'cash',
    categories: Array.isArray(supplier?.categories) ? supplier.categories : [],
    categoryDraft: '',
    businessSettings: {
      categories: Array.isArray(businessSettings.categories)
        ? businessSettings.categories.map(toBusinessCategoryForm)
        : [],
      purityOverrides: Array.isArray(businessSettings.purityOverrides)
        ? businessSettings.purityOverrides.map(toPurityOverrideForm)
        : [],
      defaultWastagePercent: businessSettings.defaultWastagePercent ?? '',
      defaultStoneRate: businessSettings.defaultStoneRate ?? '',
      netWeightRule: businessSettings.netWeightRule || 'computed',
      stoneWeightRule: businessSettings.stoneWeightRule || 'single',
      otherWeightRule: {
        deductOtherWeight: businessSettings.otherWeightRule?.deductOtherWeight ?? false,
        defaultOtherWeight: businessSettings.otherWeightRule?.defaultOtherWeight ?? '',
      },
      qrNetTolerance: businessSettings.qrNetTolerance ?? '',
    },
    businessSettingsRaw: supplier?.businessSettings && typeof supplier.businessSettings === 'object'
      ? supplier.businessSettings
      : null,
    qrProfile: {
      profileKey: qrProfile.profileKey || '',
      version: qrProfile.version || '',
      description: qrProfile.description || '',
    },
    qrProfileRaw: supplier?.qrProfile && typeof supplier.qrProfile === 'object' ? supplier.qrProfile : null,
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
  }
}

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

const buildBusinessCategoryPayload = (row) => {
  const name = normalizeText(row?.name)
  if (!name) {
    return null
  }

  const payload = {
    name,
    isActive: row?.isActive !== false,
  }

  const code = normalizeText(row?.code)
  if (code) {
    payload.code = code
  }

  const colorLabel = normalizeText(row?.colorLabel)
  if (colorLabel) {
    payload.colorLabel = colorLabel
  }

  const wastagePercent = toNullableNumber(row?.wastagePercent)
  if (wastagePercent !== null) {
    payload.wastagePercent = wastagePercent
  }

  const sortOrderText = normalizeText(row?.sortOrder)
  if (sortOrderText) {
    const sortOrder = Number(sortOrderText)
    if (Number.isFinite(sortOrder)) {
      payload.sortOrder = sortOrder
    }
  }

  return payload
}

const buildPurityOverridePayload = (row) => {
  const karat = normalizeText(row?.karat).replace(/\s+/g, '').toUpperCase()
  if (!karat) {
    return null
  }

  const payload = {
    karat,
    isActive: row?.isActive !== false,
  }

  const purityPercent = toNullableNumber(row?.purityPercent)
  if (purityPercent !== null) {
    payload.purityPercent = purityPercent
  }

  return payload
}

const buildBusinessSettingsPayload = (businessSettings = {}, existingBusinessSettings = null) => {
  const categories = Array.isArray(businessSettings.categories)
    ? businessSettings.categories
        .map(buildBusinessCategoryPayload)
        .filter(Boolean)
    : []
  const purityOverrides = Array.isArray(businessSettings.purityOverrides)
    ? businessSettings.purityOverrides
        .map(buildPurityOverridePayload)
        .filter(Boolean)
    : []

  const payload = {
    ...(existingBusinessSettings && typeof existingBusinessSettings === 'object' ? existingBusinessSettings : {}),
    categories,
    purityOverrides,
    defaultWastagePercent: toNullableNumber(businessSettings.defaultWastagePercent),
    defaultStoneRate: toNullableNumber(businessSettings.defaultStoneRate),
    netWeightRule: businessSettings.netWeightRule || 'computed',
    stoneWeightRule: businessSettings.stoneWeightRule || 'single',
    otherWeightRule: {
      ...((existingBusinessSettings && typeof existingBusinessSettings.otherWeightRule === 'object')
        ? existingBusinessSettings.otherWeightRule
        : {}),
      deductOtherWeight: businessSettings.otherWeightRule?.deductOtherWeight === true,
      defaultOtherWeight: toNullableNumber(businessSettings.otherWeightRule?.defaultOtherWeight),
    },
    qrNetTolerance: toNullableNumber(businessSettings.qrNetTolerance),
  }

  return payload
}

const buildQrProfilePayload = (qrProfile = {}, existingQrProfile = null) => ({
  ...(existingQrProfile && typeof existingQrProfile === 'object' ? existingQrProfile : {}),
  profileKey: normalizeText(qrProfile.profileKey),
  version: normalizeText(qrProfile.version),
  description: normalizeText(qrProfile.description),
})

const getSupplierSaveErrorMessage = (err) => {
  if (!(err instanceof ApiError)) {
    return err?.message || 'Failed to save supplier.'
  }

  const validationDetails = Array.isArray(err.details?.details) ? err.details.details : []
  if (validationDetails.length > 0) {
    return validationDetails
      .map((item) => {
        const path = normalizeText(item?.path)
        const message = normalizeText(item?.message)
        if (path && message) {
          return `${path}: ${message}`
        }
        return message || path
      })
      .filter(Boolean)
      .join('; ')
  }

  return err.error || 'Failed to save supplier.'
}

export default function SupplierFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const supplier = useMemo(() => location.state?.supplier ?? null, [location.state])
  const isEditing = Boolean(supplier?._id)
  const [form, setForm] = useState(() => (isEditing ? supplierToForm(supplier) : createEmptyForm()))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [activeSection, setActiveSection] = useState('basic')

  useEffect(() => {
    setForm(isEditing ? supplierToForm(supplier) : createEmptyForm())
    setError('')
    setShowAdvancedSettings(false)
    setActiveSection('basic')
  }, [isEditing, supplier])

  const handleFormChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleBusinessSettingsChange = (field, value) => {
    setForm((current) => ({
      ...current,
      businessSettings: {
        ...current.businessSettings,
        [field]: value,
      },
    }))
  }

  const handleBusinessCategoryChange = (index, field, value) => {
    setForm((current) => {
      const categories = Array.isArray(current.businessSettings.categories)
        ? [...current.businessSettings.categories]
        : []

      categories[index] = {
        ...(categories[index] || {}),
        [field]: value,
      }

      return {
        ...current,
        businessSettings: {
          ...current.businessSettings,
          categories,
        },
      }
    })
  }

  const handleAddStructuredCategory = () => {
    setForm((current) => ({
      ...current,
      businessSettings: {
        ...current.businessSettings,
        categories: [
          ...(Array.isArray(current.businessSettings.categories) ? current.businessSettings.categories : []),
          {
            name: '',
            code: '',
            colorLabel: '',
            wastagePercent: '',
            isActive: true,
            sortOrder: '',
          },
        ],
      },
    }))
  }

  const handleRemoveStructuredCategory = (index) => {
    setForm((current) => ({
      ...current,
      businessSettings: {
        ...current.businessSettings,
        categories: (Array.isArray(current.businessSettings.categories)
          ? current.businessSettings.categories
          : []
        ).filter((_, currentIndex) => currentIndex !== index),
      },
    }))
  }

  const handlePurityOverrideChange = (index, field, value) => {
    setForm((current) => {
      const purityOverrides = Array.isArray(current.businessSettings.purityOverrides)
        ? [...current.businessSettings.purityOverrides]
        : []

      purityOverrides[index] = {
        ...(purityOverrides[index] || {}),
        [field]: value,
      }

      return {
        ...current,
        businessSettings: {
          ...current.businessSettings,
          purityOverrides,
        },
      }
    })
  }

  const handleAddPurityOverride = () => {
    setForm((current) => ({
      ...current,
      businessSettings: {
        ...current.businessSettings,
        purityOverrides: [
          ...(Array.isArray(current.businessSettings.purityOverrides) ? current.businessSettings.purityOverrides : []),
          {
            karat: '',
            purityPercent: '',
            isActive: true,
          },
        ],
      },
    }))
  }

  const handleRemovePurityOverride = (index) => {
    setForm((current) => ({
      ...current,
      businessSettings: {
        ...current.businessSettings,
        purityOverrides: (Array.isArray(current.businessSettings.purityOverrides)
          ? current.businessSettings.purityOverrides
          : []
        ).filter((_, currentIndex) => currentIndex !== index),
      },
    }))
  }

  const handleAddCategory = () => {
    const nextCategory = normalizeText(form.categoryDraft)
    if (!nextCategory) {
      return
    }

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

  const handleQrProfileChange = (field, value) => {
    setForm((current) => ({
      ...current,
      qrProfile: {
        ...current.qrProfile,
        [field]: value,
      },
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

    setShowAdvancedSettings(template.key === 'custom')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedName = normalizeText(form.name)
    const trimmedCode = normalizeText(form.code)

    if (!trimmedName || !trimmedCode) {
      setError('Name and code are required.')
      return
    }

    setIsSaving(true)
    setError('')

    const payload = {
      name: trimmedName,
      code: trimmedCode,
      gst: normalizeText(form.gst),
      address: normalizeText(form.address),
      paymentMode: form.paymentMode,
      categories: Array.isArray(form.categories)
        ? form.categories.map((item) => normalizeText(item)).filter(Boolean)
        : [],
      businessSettings: buildBusinessSettingsPayload(form.businessSettings, form.businessSettingsRaw),
      qrProfile: buildQrProfilePayload(form.qrProfile, form.qrProfileRaw),
      isActive: Boolean(form.isActive),
      detectionPattern: normalizeText(form.detectionPattern)
        ? {
            type: form.detectionType,
            pattern: normalizeText(form.detectionPattern),
          }
        : null,
      qrMapping: {
        strategy: form.strategy,
        delimiter: normalizeText(form.delimiter) || '|',
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
      const message = getSupplierSaveErrorMessage(err)
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
        description="Create supplier profiles with business-friendly sections first, then fine-tune parsing only when needed."
        actions={
          <button
            type="button"
            onClick={() => navigate('/suppliers')}
            className="luxury-button surface-panel-soft text-heading border panel-border hover:bg-gold-500/10 hover:border-gold-500/30 hover:-translate-x-0.5 transition-all duration-300"
            aria-label="Back to suppliers list"
          >
            Back to Suppliers
          </button>
        }
      />

      <div className="mx-auto w-full max-w-6xl space-y-5">
        <SupplierFormSidebar form={form} defaultFieldMap={defaultFieldMap} />

        <div>
          <div className="surface-panel-soft panel-border rounded-2xl p-2 md:p-3">
            <div className="flex flex-wrap gap-2">
              {sectionTabs.map((tab) => {
                const active = activeSection === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSection(tab.id)}
                    aria-pressed={active}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all border ${
                      active
                        ? 'bg-gold-500/15 border-gold-500/40 text-heading shadow-sm'
                        : 'surface-panel-faint panel-border text-muted hover:text-heading hover:border-gold-500/25 hover:bg-gold-500/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          {activeSection === 'basic' ? (
            <SupplierFormBasicsSection
              form={form}
              paymentModes={paymentModes}
              onFormChange={handleFormChange}
            />
          ) : null}

          {activeSection === 'categories' ? (
            <SupplierFormCategoriesSection
              form={form}
              onFormChange={handleFormChange}
              onAddLegacyCategory={handleAddCategory}
              onRemoveLegacyCategory={handleRemoveCategory}
              onAddStructuredCategory={handleAddStructuredCategory}
              onStructuredCategoryChange={handleBusinessCategoryChange}
              onRemoveStructuredCategory={handleRemoveStructuredCategory}
              onBusinessSettingsChange={handleBusinessSettingsChange}
            />
          ) : null}

          {activeSection === 'karat' ? (
            <SupplierFormKaratPuritySection
              form={form}
              onAddPurityOverride={handleAddPurityOverride}
              onPurityOverrideChange={handlePurityOverrideChange}
              onRemovePurityOverride={handleRemovePurityOverride}
            />
          ) : null}

          {activeSection === 'qr' ? (
            <SupplierFormQrSetupSection
              form={form}
              qrTemplates={qrTemplates}
              getTemplateKey={getTemplateKey}
              applyQrTemplate={applyQrTemplate}
              onQrProfileChange={handleQrProfileChange}
            />
          ) : null}

          {activeSection === 'advanced' ? (
            <SupplierFormDeveloperSection
              form={form}
              showAdvancedSettings={showAdvancedSettings}
              setShowAdvancedSettings={setShowAdvancedSettings}
              helperTextByStrategy={helperTextByStrategy}
              strategyOptions={strategyOptions}
              detectionTypeOptions={detectionTypeOptions}
              mappingFields={mappingFields}
              defaultFieldMap={defaultFieldMap}
              onFormChange={handleFormChange}
              onFieldMapChange={handleFieldMapChange}
            />
          ) : null}

          <SupplierFormActions
            error={error}
            onCancel={() => navigate('/suppliers')}
            isSaving={isSaving}
            submitLabel={isEditing ? 'Save Changes' : 'Create Supplier'}
            className="pt-2"
          />
        </form>
      </div>
    </div>
  )
}
