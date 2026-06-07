import { useAuthStore } from '../store/authStore'
import { ApiError, request } from './client'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

const buildUrl = (path) => {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not defined')
  }

  const normalizedBase = apiBaseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${normalizedBase}${normalizedPath}`
}

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

const parseContentDispositionFilename = (header) => {
  if (!header) return ''

  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/"/g, '').trim())
    } catch {
      return utf8Match[1].replace(/"/g, '').trim()
    }
  }

  const filenameMatch = header.match(/filename\s*=\s*"?([^";]+)"?/i)
  return filenameMatch?.[1]?.trim() || ''
}

const buildFallbackFilename = (prefix, id, extension) => {
  const safeId = String(id || 'report').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'report'
  return `${prefix}-${safeId}.${extension}`
}

const downloadScopedExport = async (path, fallbackFilename) => {
  const token = useAuthStore.getState().token
  const headers = new Headers()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(buildUrl(path), { headers })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    let payload = {}

    try {
      if (contentType.includes('application/json')) {
        payload = await response.json()
      } else {
        const text = await response.text()
        payload = text ? { error: text } : {}
      }
    } catch {
      payload = {}
    }

    if (response.status === 401 && token) {
      useAuthStore.getState().clearAuth()
    }

    throw new ApiError(
      payload?.error || payload?.message || response.statusText || 'Request failed',
      payload?.code || 'API_ERROR',
      response.status,
      payload,
    )
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const filename = parseContentDispositionFilename(contentDisposition) || fallbackFilename
  downloadBlob(blob, filename)
  return filename
}

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  if (params.scope) query.set('scope', params.scope)
  if (params.page !== undefined && params.page !== null) query.set('page', String(params.page))
  if (params.limit !== undefined && params.limit !== null) query.set('limit', String(params.limit))
  if (params.search) query.set('search', params.search)
  if (params.q) query.set('search', params.q)
  if (params.supplier) query.set('supplier', params.supplier)
  if (params.session) query.set('session', params.session)
  if (params.customer) query.set('customer', params.customer)
  if (params.assignedSalesman) query.set('assignedSalesman', params.assignedSalesman)
  if (params.status) query.set('status', params.status)
  if (params.category) query.set('category', params.category)
  if (params.karat) query.set('karat', params.karat)
  else if (params.metalType) query.set('karat', params.metalType)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  if (params.revision !== undefined && params.revision !== null && params.revision !== '') query.set('revision', String(params.revision))

  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export const settlementReportsApi = {
  getSummary: async (params = {}) => {
    return request(`/api/v1/reports/settlement/summary${toQueryString(params)}`)
  },

  listReports: async (params = {}) => {
    return request(`/api/v1/reports/settlement${toQueryString(params)}`)
  },

  exportCsv: async (params = {}) => {
    return request(`/api/v1/reports/settlement/export.csv${toQueryString(params)}`)
  },

  exportPdf: async (params = {}) => {
    return request(`/api/v1/reports/settlement/export.pdf${toQueryString(params)}`)
  },

  downloadSessionSettlementCsv: async (sessionId) => {
    return downloadScopedExport(
      `/api/v1/reports/settlement/sessions/${sessionId}/export.csv`,
      buildFallbackFilename('settlement-session', sessionId, 'csv'),
    )
  },

  downloadSessionSettlementPdf: async (sessionId) => {
    return downloadScopedExport(
      `/api/v1/reports/settlement/sessions/${sessionId}/export.pdf`,
      buildFallbackFilename('settlement-session', sessionId, 'pdf'),
    )
  },

  downloadSupplierSectionCsv: async (batchId, { revision } = {}) => {
    const revisionQuery = revision !== undefined && revision !== null && revision !== '' ? `?revision=${encodeURIComponent(String(revision))}` : ''
    return downloadScopedExport(
      `/api/v1/reports/settlement/supplier-sections/${batchId}/export.csv${revisionQuery}`,
      buildFallbackFilename('settlement-section', batchId, 'csv'),
    )
  },

  downloadSupplierSectionPdf: async (batchId, { revision } = {}) => {
    const revisionQuery = revision !== undefined && revision !== null && revision !== '' ? `?revision=${encodeURIComponent(String(revision))}` : ''
    return downloadScopedExport(
      `/api/v1/reports/settlement/supplier-sections/${batchId}/export.pdf${revisionQuery}`,
      buildFallbackFilename('settlement-section', batchId, 'pdf'),
    )
  },
}

export default settlementReportsApi
