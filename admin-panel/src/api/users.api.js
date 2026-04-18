import { request } from './client'

export const usersApi = {
  listUsers: () => request('/api/v1/users'),
  createUser: (data) => request('/api/v1/users', {
    method: 'POST',
    body: data
  }),
  updateUser: (id, data) => request(`/api/v1/users/${id}`, {
    method: 'PATCH',
    body: data
  }),
  deleteUser: (id) => request(`/api/v1/users/${id}`, {
    method: 'DELETE'
  }),
  toggleStatus: (id) => request(`/api/v1/users/${id}/toggle-status`, {
    method: 'PATCH'
  }),
}
