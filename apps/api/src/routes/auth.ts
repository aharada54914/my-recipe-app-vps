import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { normalizeUserPreferences } from '../lib/userPreferences.js'
import {
  buildGoogleConnectionState,
  type GoogleConnectionState,
  ensureFreshGoogleAccessTokenForUser,
  exchangeGoogleCodeForTokens,
  getGoogleProfileFromAccessToken,
  upsertGoogleUserSession,
} from '../lib/googleAuth.js'

const GoogleTokenSchema = z.object({
  code: z.string().min(1),
})

const GoogleSessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive().optional(),
})

type GoogleProfile = {
  id: string
  email: string
  name: string | null
  picture?: string | null
}

function buildAuthResponse(
  app: FastifyInstance,
  user: {
    id: string
    email: string
    name: string | null
  },
  profile: GoogleProfile,
  providerToken?: string,
  providerTokenExpiry?: string,
  googleConnection?: GoogleConnectionState,
) {
  const jwt = app.jwt.sign({
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
  })

  return {
    token: jwt,
    user: {
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: profile.picture ?? undefined,
    },
    providerToken,
    providerTokenExpiry,
    googleConnection,
  }
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Exchange Google auth code for JWT
  app.post('/api/auth/google', async (request, reply) => {
    try {
      const { code } = GoogleTokenSchema.parse(request.body)
      const tokens = await exchangeGoogleCodeForTokens(code)

      if (!tokens.access_token) {
        reply.status(400).send({
          success: false,
          error: 'Failed to retrieve Google access token',
        })
        return
      }

      const profile = await getGoogleProfileFromAccessToken(tokens.access_token)
      const user = await upsertGoogleUserSession({
        profile,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiryDate: typeof tokens.expiry_date === 'number' ? tokens.expiry_date : null,
      })
      const providerTokenExpiry = typeof tokens.expiry_date === 'number'
        ? new Date(tokens.expiry_date).toISOString()
        : undefined

      reply.send({
        success: true,
        data: buildAuthResponse(
          app,
          user,
          profile,
          tokens.access_token,
          providerTokenExpiry,
          buildGoogleConnectionState(user),
        ),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'Google auth error')
      reply.status(500).send({
        success: false,
        error: `Authentication failed: ${message}`,
      })
    }
  })

  app.post('/api/auth/google/session', async (request, reply) => {
    try {
      const { accessToken, expiresIn } = GoogleSessionSchema.parse(request.body)
      const profile = await getGoogleProfileFromAccessToken(accessToken)
      const user = await upsertGoogleUserSession({
        profile,
        accessToken,
        expiresIn,
      })

      const providerTokenExpiry = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined

      reply.send({
        success: true,
        data: buildAuthResponse(
          app,
          user,
          profile,
          accessToken,
          providerTokenExpiry,
          buildGoogleConnectionState(user),
        ),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'Google session sync error')
      reply.status(500).send({
        success: false,
        error: `Google session sync failed: ${message}`,
      })
    }
  })

  app.post('/api/auth/google/provider-token', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const tokenState = await ensureFreshGoogleAccessTokenForUser(request.user.sub)
      reply.send({
        success: true,
        data: {
          providerToken: tokenState.accessToken,
          providerTokenExpiry: tokenState.accessTokenExpiresAt,
          googleConnection: tokenState.connection,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(409).send({
        success: false,
        error: `Google provider token unavailable: ${message}`,
      })
    }
  })

  // Refresh token endpoint
  app.post('/api/auth/refresh', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { sub, email, name } = request.user
      const jwt = app.jwt.sign({ sub, email, name })

      reply.send({
        success: true,
        data: { token: jwt },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Token refresh failed: ${message}`,
      })
    }
  })

  // Get current user profile
  app.get('/api/auth/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: {
          id: true,
          email: true,
          name: true,
          preferences: true,
          googleAccessToken: true,
          googleAccessTokenExpiresAt: true,
          googleRefreshToken: true,
          createdAt: true,
        },
      })

      if (!user) {
        reply.status(404).send({
          success: false,
          error: 'User not found',
        })
        return
      }

      reply.send({
        success: true,
        data: {
          ...user,
          preferences: normalizeUserPreferences(user.preferences),
          googleConnection: buildGoogleConnectionState(user),
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to fetch user: ${message}`,
      })
    }
  })
}
