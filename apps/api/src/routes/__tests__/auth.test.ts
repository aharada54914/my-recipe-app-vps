import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerAuth } from '../../plugins/auth.js'

const mocks = vi.hoisted(() => ({
  findUniqueUserMock: vi.fn(),
  exchangeGoogleCodeForTokensMock: vi.fn(),
  getGoogleProfileFromAccessTokenMock: vi.fn(),
  upsertGoogleUserSessionMock: vi.fn(),
  ensureFreshGoogleAccessTokenForUserMock: vi.fn(),
  buildGoogleConnectionStateMock: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: mocks.findUniqueUserMock,
    },
  },
}))

vi.mock('../../lib/googleAuth.js', () => ({
  exchangeGoogleCodeForTokens: mocks.exchangeGoogleCodeForTokensMock,
  getGoogleProfileFromAccessToken: mocks.getGoogleProfileFromAccessTokenMock,
  upsertGoogleUserSession: mocks.upsertGoogleUserSessionMock,
  ensureFreshGoogleAccessTokenForUser: mocks.ensureFreshGoogleAccessTokenForUserMock,
  buildGoogleConnectionState: mocks.buildGoogleConnectionStateMock,
}))

import { registerAuthRoutes } from '../auth.js'

describe('auth routes', () => {
  beforeEach(() => {
    process.env['JWT_SECRET'] = 'test-secret'
    mocks.findUniqueUserMock.mockReset()
    mocks.exchangeGoogleCodeForTokensMock.mockReset()
    mocks.getGoogleProfileFromAccessTokenMock.mockReset()
    mocks.upsertGoogleUserSessionMock.mockReset()
    mocks.ensureFreshGoogleAccessTokenForUserMock.mockReset()
    mocks.buildGoogleConnectionStateMock.mockReset()
  })

  afterEach(() => {
    delete process.env['JWT_SECRET']
  })

  it('creates a server session from a Google access token and hydrates auth/me', async () => {
    mocks.getGoogleProfileFromAccessTokenMock.mockResolvedValue({
      id: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
      picture: 'https://example.com/avatar.png',
    })

    mocks.upsertGoogleUserSessionMock.mockResolvedValue({
      id: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
    })

    mocks.findUniqueUserMock.mockResolvedValue({
      id: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
      preferences: {},
      googleAccessToken: 'google-access-token',
      googleAccessTokenExpiresAt: new Date('2026-03-22T01:00:00Z'),
      googleRefreshToken: 'refresh-token',
      createdAt: new Date('2026-03-22T00:00:00Z'),
    })
    mocks.buildGoogleConnectionStateMock.mockReturnValue({
      hasGoogleAccessToken: true,
      hasRefreshToken: true,
      accessTokenExpiresAt: '2026-03-22T01:00:00.000Z',
      canRefresh: true,
      familyCalendarConfigured: false,
    })

    const app = Fastify()
    await registerAuth(app)
    await registerAuthRoutes(app)
    await app.ready()

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/google/session',
      payload: {
        accessToken: 'google-access-token',
        expiresIn: 3600,
      },
    })

    expect(sessionResponse.statusCode).toBe(200)
    const sessionBody = sessionResponse.json()
    expect(sessionBody.data.user).toEqual({
      sub: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
      picture: 'https://example.com/avatar.png',
    })
    expect(sessionBody.data.providerToken).toBe('google-access-token')
    expect(sessionBody.data.token).toEqual(expect.any(String))
    expect(sessionBody.data.googleConnection).toEqual({
      hasGoogleAccessToken: true,
      hasRefreshToken: true,
      accessTokenExpiresAt: '2026-03-22T01:00:00.000Z',
      canRefresh: true,
      familyCalendarConfigured: false,
    })

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${sessionBody.data.token as string}`,
      },
    })

    expect(meResponse.statusCode).toBe(200)
    expect(meResponse.json().data.email).toBe('user@example.com')
    expect(meResponse.json().data.googleConnection).toEqual({
      hasGoogleAccessToken: true,
      hasRefreshToken: true,
      accessTokenExpiresAt: '2026-03-22T01:00:00.000Z',
      canRefresh: true,
      familyCalendarConfigured: false,
    })

    await app.close()
  })

  it('returns a refreshed provider token for authenticated users', async () => {
    mocks.ensureFreshGoogleAccessTokenForUserMock.mockResolvedValue({
      userId: 'google-user-1',
      accessToken: 'fresh-provider-token',
      accessTokenExpiresAt: '2026-03-22T02:00:00.000Z',
      connection: {
        hasGoogleAccessToken: true,
        hasRefreshToken: true,
        accessTokenExpiresAt: '2026-03-22T02:00:00.000Z',
        canRefresh: true,
        familyCalendarConfigured: true,
      },
    })

    const app = Fastify()
    await registerAuth(app)
    await registerAuthRoutes(app)
    await app.ready()

    const jwt = app.jwt.sign({ sub: 'google-user-1', email: 'user@example.com' })
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/google/provider-token',
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toEqual({
      providerToken: 'fresh-provider-token',
      providerTokenExpiry: '2026-03-22T02:00:00.000Z',
      googleConnection: {
        hasGoogleAccessToken: true,
        hasRefreshToken: true,
        accessTokenExpiresAt: '2026-03-22T02:00:00.000Z',
        canRefresh: true,
        familyCalendarConfigured: true,
      },
    })

    await app.close()
  })
})
