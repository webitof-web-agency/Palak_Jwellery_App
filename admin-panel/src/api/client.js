import { useAuthStore } from '../store/authStore'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

export class ApiError extends Error {
  constructor(error, code = 'API_ERROR', status = 0, details = null) {
    super(error)
    this.name = 'ApiError'
    this.error = error
    this.code = code
    this.status = status
    this.details = details
  }
}

const buildUrl = (path) => {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not defined')
  }

  const normalizedBase = apiBaseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${normalizedBase}${normalizedPath}`
}

const serializeBody = (body, headers) => {
  if (
    body == null ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  ) {
    return body
  }

  if (typeof body === 'object') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    return JSON.stringify(body)
  }

  return body
}

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''

  if (
    contentType.includes('text/csv') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/pdf')
  ) {
    return response.blob()
  }

  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = useAuthStore.getState().token

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
    body: serializeBody(options.body, headers),
  })

  const payload = await parseResponse(response)

  if (!response.ok) {
    const errorMessage =
      payload?.error || payload?.message || response.statusText || 'Request failed'
    const errorCode = payload?.code || 'API_ERROR'

    if (
      response.status === 401 &&
      token &&
      !String(path).includes('/api/v1/auth/login')
    ) {
      useAuthStore.getState().clearAuth()
    }

    throw new ApiError(errorMessage, errorCode, response.status, payload)
  }

  return payload
}
