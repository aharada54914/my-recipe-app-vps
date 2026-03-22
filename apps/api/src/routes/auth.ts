import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { google } from 'googleapis'
import { prisma } from '../db/client.js'
import { normalizeUserPreferences } from '../lib/userPreferences.js'

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

function getOAuth2Client() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth environment variables are not configured')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

async function getGoogleProfileFromAccessToken(accessToken: string): Promise<GoogleProfile> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data: userInfo } = await oauth2.userinfo.get()

  if (!userInfo.id || !userInfo.email) {
    throw new Error('Failed to retrieve user information from Google')
  }

  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name ?? null,
    picture: userInfo.picture ?? null,
  }
}

async function upsertGoogleUserSession(input: {
  profile: GoogleProfile
  accessToken?: string
  refreshToken?: string
}) {
  const { profile, accessToken, refreshToken } = input

  return prisma.user.upsert({
    where: { id: profile.id },
    update: {
      email: profile.email,
      name: profile.name ?? undefined,
      googleAccessToken: accessToken ?? undefined,
      googleRefreshToken: refreshToken ?? undefined,
    },
    create: {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? undefined,
      googleAccessToken: accessToken ?? undefined,
      googleRefreshToken: refreshToken ?? undefined,
    },
  })
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
  }
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Exchange Google auth code for JWT
  app.post('/api/auth/google', async (request, reply) => {
    try {
      const { code } = GoogleTokenSchema.parse(request.body)
      const oauth2Client = getOAuth2Client()

      const { tokens } = await oauth2Client.getToken(code)
      oauth2Client.setCredentials(tokens)

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
      })
      const providerTokenExpiry = typeof tokens.expiry_date === 'number'
        ? new Date(tokens.expiry_date).toISOString()
        : undefined

      reply.send({
        success: true,
        data: buildAuthResponse(app, user, profile, tokens.access_token, providerTokenExpiry),
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
      })

      const providerTokenExpiry = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined

      reply.send({
        success: true,
        data: buildAuthResponse(app, user, profile, accessToken, providerTokenExpiry),
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
