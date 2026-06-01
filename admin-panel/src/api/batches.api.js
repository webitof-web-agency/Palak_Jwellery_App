import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 10))

  if (params.supplier) query.set('supplier', params.supplier)
  if (params.assignedSalesman) query.set('assignedSalesman', params.assignedSalesman)
  if (params.status) query.set('status', params.status)
  if (params.entryMode) query.set('entryMode', params.entryMode)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  if (params.q) query.set('q', params.q)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)

  return `?${query.toString()}`
}

export const batchesApi = {
  getBatches: async (params = {}) => {
    return request(`/api/v1/batches${toQueryString(params)}`)
  },

  getBatchDetail: async (id) => {
    return request(`/api/v1/batches/${id}`)
  },

  getBatchRevisions: async (id) => {
    return request(`/api/v1/batches/${id}/revisions`)
  },

  createBatch: async (payload = {}) => {
    return request('/api/v1/batches', {
      method: 'POST',
      body: payload,
    })
  },

  addBatchItems: async (id, payload = {}) => {
    return request(`/api/v1/batches/${id}/items`, {
      method: 'POST',
      body: payload,
    })
  },

  submitBatch: async (id) => {
    return request(`/api/v1/batches/${id}/submit`, {
      method: 'POST',
    })
  },

  finalizeBatch: async (id) => {
    return request(`/api/v1/batches/${id}/finalize`, {
      method: 'POST',
    })
  },

  reopenBatch: async (id, reason) => {
    return request(`/api/v1/batches/${id}/reopen`, {
      method: 'POST',
      body: { reason },
    })
  },

  reassignBatch: async (id, assignedSalesmanId) => {
    return request(`/api/v1/batches/${id}/assignment`, {
      method: 'PATCH',
      body: { assignedSalesmanId },
    })
  },
}

export default batchesApi
