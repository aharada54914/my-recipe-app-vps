import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ConsultationRequestSchema } from '@kitchen/shared-types'
import { askConsultation, getTodayUsageCount, DAILY_LIMIT } from '../lib/consultation/service.js'

export async function registerConsultationRoutes(app: FastifyInstance): Promise<void> {
  // Ask consultation (authenticated, rate-limited)
  app.post('/api/consultation/ask', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const body = ConsultationRequestSchema.parse(request.body)

      const result = await askConsultation(userId, body)

      reply.send({
        success: true,
        data: result,
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
      if (message.includes('上限')) {
        reply.status(429).send({
          success: false,
          error: message,
          data: { remaining: 0, limit: DAILY_LIMIT },
        })
        return
      }
      app.log.error({ err }, 'Consultation error')
      reply.status(500).send({
        success: false,
        error: `相談処理に失敗しました: ${message}`,
      })
    }
  })

  // Get remaining consultation count
  app.get('/api/consultation/remaining', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const todayCount = await getTodayUsageCount(userId)
      const remaining = Math.max(0, DAILY_LIMIT - todayCount)

      reply.send({
        success: true,
        data: { remaining, limit: DAILY_LIMIT, used: todayCount },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to get remaining count: ${message}`,
      })
    }
  })
}
