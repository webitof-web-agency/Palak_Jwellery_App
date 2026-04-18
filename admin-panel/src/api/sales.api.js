import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 20))

  if (params.salesman) query.set('salesman', params.salesman)
  if (params.supplier) query.set('supplier', params.supplier)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)

  return `?${query.toString()}`
}

export const salesApi = {
  getSummary: async () => {
    return request('/api/v1/sales/summary/today')
  },

  listSales: async (params = {}) => {
    return request(`/api/v1/sales${toQueryString(params)}`)
  },

  getSaleDetail: async (id) => {
    return request(`/api/v1/sales/${id}`)
  },
}
