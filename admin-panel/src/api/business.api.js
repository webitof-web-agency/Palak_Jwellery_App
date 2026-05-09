import { request } from './client'

const unwrapData = (response, fallbackMessage) => {
  if (response?.data == null) {
    if (fallbackMessage) {
      throw new Error(fallbackMessage)
    }

    return response?.data
  }

  return response.data
}

export async function getBusinessOverview() {
  const response = await request('/api/v1/business/overview')
  return unwrapData(response, 'Business overview response missing data')
}

export async function listBusinessOptions(kind) {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  const response = await request(`/api/v1/business/options${query}`)
  return unwrapData(response, 'Business options response missing data')
}

export async function createBusinessOption(payload) {
  const response = await request('/api/v1/business/options', {
    method: 'POST',
    body: payload,
  })
  return unwrapData(response, 'Create business option response missing data')
}

export async function updateBusinessOption(id, payload) {
  const response = await request(`/api/v1/business/options/${id}`, {
    method: 'PUT',
    body: payload,
  })
  return unwrapData(response, 'Update business option response missing data')
}

export async function deleteBusinessOption(id) {
  return request(`/api/v1/business/options/${id}`, {
    method: 'DELETE',
  })
}

export async function getSettlementSettings() {
  const response = await request('/api/v1/business/settings')
  return unwrapData(response, 'Settlement settings response missing data')
}

export async function saveSettlementSettings(settings) {
  const response = await request('/api/v1/business/settings', {
    method: 'PUT',
    body: { settings },
  })
  return unwrapData(response, 'Save settlement settings response missing data')
}
