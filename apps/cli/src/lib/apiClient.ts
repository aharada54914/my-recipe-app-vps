const DEFAULT_BASE_URL = 'http://localhost:3001'

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string
}

function getBaseUrl(): string {
  return process.env['API_BASE_URL'] ?? DEFAULT_BASE_URL
}

function getToken(): string | undefined {
  return process.env['KITCHEN_API_TOKEN']
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path}`
  const token = options.token ?? getToken()

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

  const data = await response.json() as T

  if (!response.ok) {
    const errorData = data as { error?: string }
    throw new Error(
      errorData.error ?? `API request failed: ${response.status} ${response.statusText}`,
    )
  }

  return data
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' })
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body })
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PUT', body })
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' })
}
