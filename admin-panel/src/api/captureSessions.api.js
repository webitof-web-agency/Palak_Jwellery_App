import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 10))

  if (params.status) query.set('status', params.status)
  if (params.assignedSalesman) query.set('assignedSalesman', params.assignedSalesman)
  if (params.q) query.set('q', params.q)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)

  return `?${query.toString()}`
}

export const captureSessionsApi = {
  listSessions: async (params = {}) => {
    return request(`/api/v1/capture-sessions${toQueryString(params)}`)
  },

  getSessionDetail: async (id) => {
    return request(`/api/v1/capture-sessions/${id}`)
  },

  createSession: async (payload = {}) => {
    return request('/api/v1/capture-sessions', {
      method: 'POST',
      body: payload,
    })
  },

  refreshSession: async (id) => {
    return request(`/api/v1/capture-sessions/${id}/refresh`, {
      method: 'POST',
    })
  },

  createSupplierBatch: async (id, payload = {}) => {
    return request(`/api/v1/capture-sessions/${id}/batches`, {
      method: 'POST',
      body: payload,
    })
  },

  attachBatch: async (id, batchId) => {
    return request(`/api/v1/capture-sessions/${id}/batches/attach`, {
      method: 'POST',
      body: { batchId },
    })
  },

  submitSession: async (id) => {
    return request(`/api/v1/capture-sessions/${id}/submit`, {
      method: 'POST',
    })
  },

  finalizeSession: async (id) => {
    return request(`/api/v1/capture-sessions/${id}/finalize`, {
      method: 'POST',
    })
  },

  cancelSession: async (id, reason) => {
    return request(`/api/v1/capture-sessions/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    })
  },
}

export default captureSessionsApi
