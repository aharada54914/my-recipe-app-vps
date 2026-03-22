import { describe, expect, it } from 'vitest'
import { resolveRequestUrl } from '../apiClient'

describe('resolveRequestUrl', () => {
  it('avoids duplicating the /api prefix when the base URL already ends with /api', () => {
    expect(resolveRequestUrl('/api', '/api/auth/google/session')).toBe('/api/auth/google/session')
  })

  it('joins origin and api path normally', () => {
    expect(resolveRequestUrl('http://localhost:3000', '/api/preferences')).toBe('http://localhost:3000/api/preferences')
  })

  it('normalizes missing leading slashes', () => {
    expect(resolveRequestUrl('/api', 'api/auth/me')).toBe('/api/auth/me')
    expect(resolveRequestUrl('http://localhost:3000', 'api/health')).toBe('http://localhost:3000/api/health')
  })
})
