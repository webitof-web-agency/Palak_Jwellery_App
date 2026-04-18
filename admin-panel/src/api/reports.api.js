import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)

  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export const reportsApi = {
  getAdminSummary: async (params = {}) => {
    return request(`/api/v1/reports/summary${toQueryString(params)}`)
  },

  getMySummary: async () => {
    return request('/api/v1/reports/summary/me')
  },
}
