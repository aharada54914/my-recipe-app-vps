import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerAuth } from '../../plugins/auth.js'

const mocks = vi.hoisted(() => ({
  upsertUserMock: vi.fn(),
  findUniqueUserMock: vi.fn(),
  userInfoGetMock: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({
  prisma: {
    user: {
      upsert: mocks.upsertUserMock,
      findUnique: mocks.findUniqueUserMock,
    },
  },
}))

vi.mock('googleapis', () => {
  class OAuth2 {
    setCredentials() {}
    async getToken() {
      return { tokens: {} }
    }
  }

  return {
    google: {
      auth: {
        OAuth2,
      },
      oauth2: () => ({
        userinfo: {
          get: mocks.userInfoGetMock,
        },
      }),
    },
  }
})

import { registerAuthRoutes } from '../auth.js'

describe('auth routes', () => {
  beforeEach(() => {
    process.env['JWT_SECRET'] = 'test-secret'
    mocks.upsertUserMock.mockReset()
    mocks.findUniqueUserMock.mockReset()
    mocks.userInfoGetMock.mockReset()
  })

  afterEach(() => {
    delete process.env['JWT_SECRET']
  })

  it('creates a server session from a Google access token and hydrates auth/me', async () => {
    mocks.userInfoGetMock.mockResolvedValue({
      data: {
        id: 'google-user-1',
        email: 'user@example.com',
        name: 'Example User',
        picture: 'https://example.com/avatar.png',
      },
    })

    mocks.upsertUserMock.mockResolvedValue({
      id: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
    })

    mocks.findUniqueUserMock.mockResolvedValue({
      id: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
      preferences: {},
      createdAt: new Date('2026-03-22T00:00:00Z'),
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

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${sessionBody.data.token as string}`,
      },
    })

    expect(meResponse.statusCode).toBe(200)
    expect(meResponse.json().data.email).toBe('user@example.com')
    expect(mocks.upsertUserMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'google-user-1' },
    }))

    await app.close()
  })
})
