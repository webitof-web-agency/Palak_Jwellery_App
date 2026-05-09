export const confidenceOptions = [
  { value: '', label: 'Any confidence' },
  { value: '50', label: '50+' },
  { value: '60', label: '60+' },
  { value: '70', label: '70+' },
  { value: '80', label: '80+' },
  { value: '90', label: '90+' },
]

export const valuationStatusOptions = [
  { value: '', label: 'All settlement states' },
  { value: 'complete', label: 'Settlement complete' },
  { value: 'partial', label: 'Pending settlement' },
  { value: 'supplier_only', label: 'Supplier only' },
]

export const createInitialWorkflowFilters = () => ({
  search: '',
  supplier: '',
  status: '',
  valuationStatus: '',
  confidenceThreshold: '',
  startDate: '',
  endDate: '',
})

export const buildWorkflowFilterParams = (filters = {}) => ({
  search: normalizeText(filters.search),
  supplier: normalizeText(filters.supplier),
  status: normalizeText(filters.status),
  valuationStatus: normalizeText(filters.valuationStatus),
  confidenceThreshold: filters.confidenceThreshold,
  startDate: filters.startDate,
  endDate: filters.endDate,
})

export const normalizeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export const countWarnings = (row = {}, key) => {
  const warnings = row?.[key]
  return Array.isArray(warnings) ? warnings.length : 0
}

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const getQrStatusTone = (status) => {
  if (status === 'approved') return 'bg-green-500/10 text-green-500 border-green-500/20'
  if (status === 'needs_review') return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
  return 'bg-white/5 text-muted border-white/10'
}

export const getValuationTone = (status) => {
  if (status === 'complete') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (status === 'partial') return 'bg-gold-500/10 text-gold-500 border-gold-500/20'
  if (status === 'supplier_only') return 'bg-purple-500/10 text-purple-300 border-purple-500/20'
  return 'bg-white/5 text-muted border-white/10'
}

export const deriveWorkflowState = (row = {}) => {
  if (row?.approved_at || row?.approvedAt) return 'approved'
  if (row?.corrected_at || row?.correctedAt) return 'corrected'
  if (row?.reviewed_at || row?.reviewedAt) return 'reviewed'
  if (row?.status === 'needs_review') return 'needs_review'
  return row?.status || 'needs_review'
}

export const getWorkflowTone = (state) => {
  if (state === 'approved') return 'bg-green-500/10 text-green-500 border-green-500/20'
  if (state === 'corrected') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
  if (state === 'reviewed') return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
  if (state === 'needs_review') return 'bg-red-500/10 text-red-300 border-red-500/20'
  return 'bg-white/5 text-muted border-white/10'
}
