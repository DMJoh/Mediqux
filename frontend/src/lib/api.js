const RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Always same-origin: Caddy proxies /api to the backend in production, and
// vite.config.js proxies it to the backend container in dev — the frontend
// never needs to know the backend's actual host/port.
export function getApiBaseUrl() {
  return '/api'
}

// /auth/login and /auth/signup are never behind a session — the backend returns
// 401 from them to mean "those credentials are wrong," not "your session expired."
// Treating every 401/403 the same here used to blow away that real error message
// (e.g. "Invalid credentials") and force a logout for a user who was never logged in.
const UNAUTHENTICATED_PATHS = ['/auth/login', '/auth/signup', '/auth/initial-config']
function isUnauthenticatedEndpoint(path) {
  return UNAUTHENTICATED_PATHS.some((p) => path.startsWith(p))
}

let unauthorizedHandler = null
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

// Passive connection-status tracking — piggybacks on whatever requests the app is
// already making (no dedicated health-poll, so no extra log noise). "Online" means
// the last fetch() reached the server at all, regardless of that request's own
// success/failure (a 401/500 still proves the backend is up); only a fetch() that
// throws — network unreachable, server down — flips it to offline.
let isOnline = true
const connectionListeners = new Set()

function setConnectionStatus(next) {
  if (next === isOnline) return
  isOnline = next
  connectionListeners.forEach((fn) => fn(isOnline))
}

export function getConnectionStatus() {
  return isOnline
}

export function subscribeConnectionStatus(fn) {
  connectionListeners.add(fn)
  return () => connectionListeners.delete(fn)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestOnce(path, options) {
  const token = localStorage.getItem('authToken')
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers })
    setConnectionStatus(true)
  } catch (err) {
    setConnectionStatus(false)
    throw err
  }

  if ((response.status === 401 || response.status === 403) && !isUnauthenticatedEndpoint(path)) {
    unauthorizedHandler?.()
    throw new ApiError('Session expired', response.status)
  }

  const body = await response.json().catch(() => null)

  if (!response.ok || body?.success === false) {
    throw new ApiError(body?.error || `Request failed (${response.status})`, response.status)
  }

  return body?.data ?? body
}

async function apiFetch(path, options = {}) {
  const isIdempotent = !options.method || options.method === 'GET'
  let lastError
  const attempts = isIdempotent ? RETRY_ATTEMPTS : 1

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestOnce(path, options)
    } catch (err) {
      lastError = err
      if (err instanceof ApiError) throw err
      if (attempt < attempts) await sleep(RETRY_DELAY * attempt)
    }
  }
  throw lastError
}

/** For endpoints that return a raw file (PDF view/download) instead of JSON —
 * requestOnce() always calls response.json(), so those need this separate path. */
async function fetchBlob(path) {
  const token = localStorage.getItem('authToken')
  let response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    setConnectionStatus(true)
  } catch (err) {
    setConnectionStatus(false)
    throw err
  }
  if (response.status === 401 || response.status === 403) {
    unauthorizedHandler?.()
    throw new ApiError('Session expired', response.status)
  }
  if (!response.ok) throw new ApiError(`Request failed (${response.status})`, response.status)

  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="(.+)"/)
  return { blob: await response.blob(), filename: match?.[1] || 'lab-report.pdf' }
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) =>
    apiFetch(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (path, body) =>
    apiFetch(path, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
  del: (path) => apiFetch(path, { method: 'DELETE' }),
  getBlob: (path) => fetchBlob(path),
}
