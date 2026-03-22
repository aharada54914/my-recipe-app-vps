import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUniqueMock,
      update: mocks.userUpdateMock,
    },
  },
}))

vi.mock('googleapis', () => {
  class OAuth2 {
    setCredentials() {}
    async refreshAccessToken() {
      return {
        credentials: {
          access_token: 'refreshed-access-token',
          expiry_date: new Date('2026-03-22T03:00:00Z').getTime(),
        },
      }
    }
  }

  return {
    google: {
      auth: {
        OAuth2,
      },
      oauth2: () => ({
        userinfo: {
          get: vi.fn(),
        },
      }),
    },
  }
})

import { ensureFreshGoogleAccessTokenForUser } from '../googleAuth.js'

describe('ensureFreshGoogleAccessTokenForUser', () => {
  beforeEach(() => {
    mocks.userFindUniqueMock.mockReset()
    mocks.userUpdateMock.mockReset()
    process.env['GOOGLE_CLIENT_ID'] = 'client-id'
    process.env['GOOGLE_CLIENT_SECRET'] = 'client-secret'
    process.env['GOOGLE_REDIRECT_URI'] = 'http://localhost:3000'
  })

  it('returns the stored token when it is still fresh', async () => {
    mocks.userFindUniqueMock.mockResolvedValue({
      id: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
      googleAccessToken: 'stored-token',
      googleAccessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      googleRefreshToken: 'refresh-token',
      preferences: { familyCalendarId: 'family@example.com' },
    })

    const result = await ensureFreshGoogleAccessTokenForUser('google-user-1')

    expect(result.accessToken).toBe('stored-token')
    expect(mocks.userUpdateMock).not.toHaveBeenCalled()
  })

  it('refreshes the access token when expired and refresh token exists', async () => {
    mocks.userFindUniqueMock.mockResolvedValue({
      id: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
      googleAccessToken: 'expired-token',
      googleAccessTokenExpiresAt: new Date(Date.now() - 60 * 1000),
      googleRefreshToken: 'refresh-token',
      preferences: { familyCalendarId: 'family@example.com' },
    })
    mocks.userUpdateMock.mockResolvedValue({
      id: 'google-user-1',
      email: 'user@example.com',
      name: 'Example User',
      googleAccessToken: 'refreshed-access-token',
      googleAccessTokenExpiresAt: new Date('2026-03-22T03:00:00Z'),
      googleRefreshToken: 'refresh-token',
      preferences: { familyCalendarId: 'family@example.com' },
    })

    const result = await ensureFreshGoogleAccessTokenForUser('google-user-1')

    expect(result.accessToken).toBe('refreshed-access-token')
    expect(mocks.userUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'google-user-1' },
      data: expect.objectContaining({
        googleAccessToken: 'refreshed-access-token',
      }),
    }))
  })
})
