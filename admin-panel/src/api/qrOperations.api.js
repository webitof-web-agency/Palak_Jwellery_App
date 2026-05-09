import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  if (params.search) query.set('search', params.search)
  if (params.supplier) query.set('supplier', params.supplier)
  if (params.status) query.set('status', params.status)
  if (params.valuationStatus) query.set('valuationStatus', params.valuationStatus)
  if (params.workflowScope) query.set('workflowScope', params.workflowScope)
  if (params.confidenceThreshold !== undefined && params.confidenceThreshold !== null && params.confidenceThreshold !== '') {
    query.set('confidenceThreshold', String(params.confidenceThreshold))
  }
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)

  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export const qrOperationsApi = {
  getSummary: async (params = {}) => {
    return request(`/api/v1/reports/qr/summary${toQueryString(params)}`)
  },

  listIngestions: async (params = {}) => {
    return request(`/api/v1/reports/qr${toQueryString(params)}`)
  },

  getIngestionDetail: async (id) => {
    return request(`/api/v1/qr/${id}`)
  },

  saveCorrections: async (id, corrections = {}, correctionNote = '') => {
    return request(`/api/v1/qr/${id}/corrections`, {
      method: 'PATCH',
      body: { corrections, correction_note: correctionNote },
    })
  },

  approveIngestion: async (id) => {
    return request(`/api/v1/qr/${id}/approve`, {
      method: 'PATCH',
    })
  },

  markReviewed: async (id) => {
    return request(`/api/v1/qr/${id}/reviewed`, {
      method: 'PATCH',
    })
  },

  exportCsv: async (params = {}) => {
    return request(`/api/v1/reports/qr/export.csv${toQueryString(params)}`)
  },

  exportPdf: async (params = {}) => {
    return request(`/api/v1/reports/qr/export.pdf${toQueryString(params)}`)
  },
  getSettlementSummary: async (params = {}) => {
    return request(`/api/v1/reports/settlement/summary${toQueryString(params)}`)
  },
  listSettlementReports: async (params = {}) => {
    return request(`/api/v1/reports/settlement${toQueryString(params)}`)
  },
  exportSettlementCsv: async (params = {}) => {
    return request(`/api/v1/reports/settlement/export.csv${toQueryString(params)}`)
  },
  exportSettlementPdf: async (params = {}) => {
    return request(`/api/v1/reports/settlement/export.pdf${toQueryString(params)}`)
  },
}
