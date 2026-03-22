/**
 * REST API client for server-side backend.
 *
 * When the app is running in "online" mode (API_BASE_URL is set),
 * repositories can delegate to these helpers instead of Dexie.
 * Dexie remains available for offline caching.
 */

function resolveApiBaseUrl(): string {
  const envValue = import.meta.env?.['VITE_API_BASE_URL']
  if (typeof envValue === 'string' && envValue.length > 0) {
    return envValue
  }

  if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
    return window.location.origin
  }

  return 'http://localhost:3001'
}

const API_BASE_URL = resolveApiBaseUrl()

const TOKEN_KEY = 'kitchen_jwt'

export interface AuthenticatedUser {
  sub: string
  email: string
  name: string | null
  picture?: string
}

export interface GoogleConnectionState {
  hasGoogleAccessToken: boolean
  hasRefreshToken: boolean
  accessTokenExpiresAt?: string
  canRefresh: boolean
  familyCalendarConfigured: boolean
}

export interface GoogleAuthExchangeResponse {
  token: string
  user: AuthenticatedUser
  providerToken?: string
  providerTokenExpiry?: string
  googleConnection?: GoogleConnectionState
}

// --- Token management ---

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Ignore storage errors in SSR or privacy mode
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Ignore
  }
}

// --- Request helpers ---

interface ApiErrorData {
  success: false
  error: string
}

export class ApiError extends Error {
  readonly status: number
  readonly data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export function resolveRequestUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (trimmedBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${trimmedBase}${normalizedPath.slice(4)}`
  }

  return `${trimmedBase}${normalizedPath}`
}

async function request<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string | null
    skipAuth?: boolean
  } = {},
): Promise<T> {
  const url = resolveRequestUrl(API_BASE_URL, path)
  const token = options.skipAuth ? null : (options.token ?? getToken())

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`
    try {
      const errorData = await response.json() as ApiErrorData
      errorMessage = errorData.error ?? errorMessage
    } catch {
      // Response is not JSON
    }
    throw new ApiError(errorMessage, response.status)
  }

  return response.json() as Promise<T>
}

// --- Public API ---

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body })
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body })
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body })
}

export async function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

// --- Auth-specific ---

export async function exchangeGoogleCode(code: string): Promise<{
  token: string
  user: AuthenticatedUser
  providerToken?: string
  providerTokenExpiry?: string
  googleConnection?: GoogleConnectionState
}> {
  const result = await request<{
    success: boolean
    data: GoogleAuthExchangeResponse
  }>('/api/auth/google', {
    method: 'POST',
    body: { code },
    skipAuth: true,
  })

  if (result.data?.token) {
    setToken(result.data.token)
  }

  return result.data
}

export async function exchangeGoogleSession(input: {
  accessToken: string
  expiresIn?: number
}): Promise<GoogleAuthExchangeResponse> {
  const result = await request<{
    success: boolean
    data: GoogleAuthExchangeResponse
  }>('/api/auth/google/session', {
    method: 'POST',
    body: input,
    skipAuth: true,
  })

  if (result.data?.token) {
    setToken(result.data.token)
  }

  return result.data
}

export async function refreshToken(): Promise<string | null> {
  try {
    const result = await request<{
      success: boolean
      data: { token: string }
    }>('/api/auth/refresh', { method: 'POST' })

    if (result.data?.token) {
      setToken(result.data.token)
      return result.data.token
    }
    return null
  } catch {
    clearToken()
    return null
  }
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
  const result = await request<{
    success: boolean
    data: {
      id: string
      email: string
      name: string | null
      googleConnection?: GoogleConnectionState
    }
  }>('/api/auth/me')

  if (!result.data?.id || !result.data?.email) {
    return null
  }

  return {
    sub: result.data.id,
    email: result.data.email,
    name: result.data.name,
  }
}

export async function fetchCurrentUserSession(): Promise<{
  user: AuthenticatedUser
  googleConnection: GoogleConnectionState | null
} | null> {
  const result = await request<{
    success: boolean
    data: {
      id: string
      email: string
      name: string | null
      googleConnection?: GoogleConnectionState
    }
  }>('/api/auth/me')

  if (!result.data?.id || !result.data?.email) {
    return null
  }

  return {
    user: {
      sub: result.data.id,
      email: result.data.email,
      name: result.data.name,
    },
    googleConnection: result.data.googleConnection ?? null,
  }
}

export async function fetchProviderToken(): Promise<{
  providerToken: string
  providerTokenExpiry?: string
  googleConnection?: GoogleConnectionState
}> {
  const result = await request<{
    success: boolean
    data: {
      providerToken: string
      providerTokenExpiry?: string
      googleConnection?: GoogleConnectionState
    }
  }>('/api/auth/google/provider-token', { method: 'POST' })

  return result.data
}

// --- Online mode detection ---

export function isOnlineMode(): boolean {
  return Boolean(
    typeof import.meta !== 'undefined' &&
    import.meta.env?.['VITE_API_BASE_URL'],
  )
}
