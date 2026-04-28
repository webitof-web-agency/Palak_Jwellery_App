import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 10))

  if (params.salesman) query.set('salesman', params.salesman)
  if (params.supplier) query.set('supplier', params.supplier)
  if (params.q) query.set('q', params.q)
  if (params.searchScope) query.set('searchScope', params.searchScope)
  if (params.duplicatesOnly) query.set('duplicatesOnly', String(params.duplicatesOnly))
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  if (params.scope) query.set('scope', params.scope)

  return `?${query.toString()}`
}

export const salesApi = {
  getSummary: async () => {
    return request('/api/v1/sales/summary/today')
  },

  listSales: async (params = {}) => {
    return request(`/api/v1/sales${toQueryString(params)}`)
  },

  exportSales: async (params = {}) => {
    return request(`/api/v1/sales/export${toQueryString(params)}`)
  },

  getSaleDetail: async (id) => {
    return request(`/api/v1/sales/${id}`)
  },
}
