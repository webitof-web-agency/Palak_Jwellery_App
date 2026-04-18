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

export async function getSuppliers() {
  const response = await request('/api/v1/suppliers')
  return unwrapData(response, 'Suppliers response missing data')
}

export async function createSupplier(payload) {
  const response = await request('/api/v1/suppliers', {
    method: 'POST',
    body: payload,
  })

  return unwrapData(response, 'Create supplier response missing data')
}

export async function updateSupplier(id, payload) {
  const response = await request(`/api/v1/suppliers/${id}`, {
    method: 'PUT',
    body: payload,
  })

  return unwrapData(response, 'Update supplier response missing data')
}

export async function deleteSupplier(id) {
  return request(`/api/v1/suppliers/${id}`, {
    method: 'DELETE',
  })
}

export async function testSupplierParse(payload) {
  const response = await request('/api/v1/suppliers/parse-qr', {
    method: 'POST',
    body: payload,
  })

  return unwrapData(response, 'Parse QR response missing data')
}

// Support both individual exports for legacy pages and 
// the new object-based pattern for Slice 4+ pages.
export const suppliersApi = {
  getSuppliers,
  listSuppliers: getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  testSupplierParse,
}
