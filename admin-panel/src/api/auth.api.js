import { request } from './client'

export async function login(identifier, password) {
  const response = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { email: identifier, password },
  })

  if (!response?.data) {
    throw new Error('Login response missing session data')
  }

  return response.data
}

export async function getMe() {
  const response = await request('/api/v1/auth/me')

  if (!response?.data) {
    throw new Error('Profile response missing user data')
  }

  return response.data
}
