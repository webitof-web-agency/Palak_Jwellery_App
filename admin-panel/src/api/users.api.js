import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.role) query.set('role', params.role)
  if (params.page !== undefined && params.page !== null && params.page !== '') query.set('page', String(params.page))
  if (params.limit !== undefined && params.limit !== null && params.limit !== '') query.set('limit', String(params.limit))
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const usersApi = {
  listUsers: (params = {}) => request(`/api/v1/users${toQueryString(params)}`),
  createUser: (data) => request('/api/v1/users', {
    method: 'POST',
    body: data,
  }),
  updateUser: (id, data) => request(`/api/v1/users/${id}`, {
    method: 'PATCH',
    body: data,
  }),
  deleteUser: (id) => request(`/api/v1/users/${id}`, {
    method: 'DELETE',
  }),
  toggleStatus: (id) => request(`/api/v1/users/${id}/toggle-status`, {
    method: 'PATCH',
  }),
}
