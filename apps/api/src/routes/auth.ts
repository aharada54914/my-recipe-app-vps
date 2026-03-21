import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { google } from 'googleapis'
import { prisma } from '../db/client.js'
import { normalizeUserPreferences } from '../lib/userPreferences.js'

const GoogleTokenSchema = z.object({
  code: z.string().min(1),
})

function getOAuth2Client() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth environment variables are not configured')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Exchange Google auth code for JWT
  app.post('/api/auth/google', async (request, reply) => {
    try {
      const { code } = GoogleTokenSchema.parse(request.body)
      const oauth2Client = getOAuth2Client()

      const { tokens } = await oauth2Client.getToken(code)
      oauth2Client.setCredentials(tokens)

      // Get user info from Google
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data: userInfo } = await oauth2.userinfo.get()

      if (!userInfo.id || !userInfo.email) {
        reply.status(400).send({
          success: false,
          error: 'Failed to retrieve user information from Google',
        })
        return
      }

      // Upsert user in database
      const user = await prisma.user.upsert({
        where: { id: userInfo.id },
        update: {
          email: userInfo.email,
          name: userInfo.name ?? undefined,
          googleAccessToken: tokens.access_token ?? undefined,
          googleRefreshToken: tokens.refresh_token ?? undefined,
        },
        create: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name ?? undefined,
          googleAccessToken: tokens.access_token ?? undefined,
          googleRefreshToken: tokens.refresh_token ?? undefined,
        },
      })

      // Generate JWT
      const jwt = app.jwt.sign({
        sub: user.id,
        email: user.email,
        name: user.name ?? undefined,
      })

      reply.send({
        success: true,
        data: {
          token: jwt,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        },
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
