import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import {
  createDefaultUserPreferences,
  buildUpdatedUserPreferences,
  normalizeUserPreferences,
  toUserPreferencesJson,
} from '../lib/userPreferences.js'
import { EditableUserPreferencesSchema } from '@kitchen/shared-types'

const UpdatePreferencesSchema = EditableUserPreferencesSchema

export async function registerPreferencesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/preferences', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { preferences: true },
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
        data: normalizeUserPreferences(user.preferences),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to fetch preferences: ${message}`,
      })
    }
  })

  app.patch('/api/preferences', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const updates = UpdatePreferencesSchema.parse(request.body)

      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { preferences: true },
      })

      if (!user) {
        reply.status(404).send({
          success: false,
          error: 'User not found',
        })
        return
      }

      const nextPreferences = buildUpdatedUserPreferences(user.preferences, updates)

      await prisma.user.update({
        where: { id: request.user.sub },
        data: { preferences: toUserPreferencesJson(nextPreferences) },
      })

      reply.send({
        success: true,
        data: nextPreferences,
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation error',
          data: err.issues,
        })
        return
      }

      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to update preferences: ${message}`,
      })
    }
  })

  app.post('/api/preferences/reset', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { id: true },
      })

      if (!existingUser) {
        reply.status(404).send({
          success: false,
          error: 'User not found',
        })
        return
      }

      const nextPreferences = createDefaultUserPreferences()

      await prisma.user.update({
        where: { id: request.user.sub },
        data: { preferences: toUserPreferencesJson(nextPreferences) },
      })

      reply.send({
        success: true,
        data: nextPreferences,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to reset preferences: ${message}`,
      })
    }
  })
}
