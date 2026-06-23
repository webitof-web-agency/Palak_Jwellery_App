import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  if (params.q) query.set('q', params.q)
  if (params.hasSessions) query.set('hasSessions', params.hasSessions)
  if (params.archived) query.set('archived', params.archived)
  if (params.page !== undefined && params.page !== null && params.page !== '') query.set('page', String(params.page))
  if (params.limit !== undefined && params.limit !== null && params.limit !== '') query.set('limit', String(params.limit))

  const text = query.toString()
  return text ? `?${text}` : ''
}

export const customersApi = {
  listCustomers: (params = {}) => request(`/api/v1/customers${toQueryString(params)}`),
  getCustomer: (id) => request(`/api/v1/customers/${id}`),
  createCustomer: (data) => request('/api/v1/customers', {
    method: 'POST',
    body: data,
  }),
  updateCustomer: (id, data) => request(`/api/v1/customers/${id}`, {
    method: 'PATCH',
    body: data,
  }),
  archiveCustomer: (id, data = {}) => request(`/api/v1/customers/${id}`, {
    method: 'DELETE',
    body: data,
  }),
}
