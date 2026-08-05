import { request } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()

  if (params.page !== undefined && params.page !== null && params.page !== '') {
    query.set('page', String(params.page))
  }

  if (params.limit !== undefined && params.limit !== null && params.limit !== '') {
    query.set('limit', String(params.limit))
  }

  if (params.q) query.set('q', params.q)
  if (params.status) query.set('status', params.status)
  if (params.transactionType) query.set('transactionType', params.transactionType)
  if (params.syncStatus) query.set('syncStatus', params.syncStatus)
  if (params.salesman) query.set('salesman', params.salesman)
  if (params.customer) query.set('customer', params.customer)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)

  return query.toString() ? `?${query.toString()}` : ''
}

export const bullionApi = {
  getBullionSales: (params = {}) => request(`/api/v1/bullion-sales${toQueryString(params)}`),
  getBullionSalesByCustomer: (customerId, params = {}) =>
    request(`/api/v1/bullion-sales/customer/${customerId}${toQueryString(params)}`),
  getBullionInventory: () => request('/api/v1/bullion-inventory'),
  updateBullionInventory: (data) =>
    request('/api/v1/bullion-inventory', {
      method: 'PUT',
      body: data,
    }),
  getBullionPurchaseOrders: (params = {}) =>
    request(`/api/v1/bullion-purchase-orders${toQueryString(params)}`),
  createBullionPurchaseOrder: (data) =>
    request('/api/v1/bullion-purchase-orders', {
      method: 'POST',
      body: data,
    }),
  markPurchaseOrderDone: (id, data) =>
    request(`/api/v1/bullion-purchase-orders/${id}/done`, {
      method: 'PATCH',
      body: data,
    }),
  getBullionAnalytics: (params = {}) =>
    request(`/api/v1/bullion-sales/analytics/summary${toQueryString(params)}`),
}

export default bullionApi
