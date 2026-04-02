import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { RegisterToCalendarRequestSchema } from '@kitchen/shared-types'
import { generateShoppingList, registerShoppingListToCalendarForUser } from '../lib/shopping/service.js'

const GenerateShoppingListSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function registerShoppingRoutes(app: FastifyInstance): Promise<void> {
  // Generate sorted shopping list from weekly menu
  app.post('/api/shopping/generate', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const { weekStartDate } = GenerateShoppingListSchema.parse(request.body)

      const sortedList = await generateShoppingList({ userId, weekStartDate })

      reply.send({ success: true, data: sortedList })
    } catch (err) {
      if (err instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation error',
          data: err.issues,
        })
        return
      }
      if (err instanceof Error && err.message.includes('not found')) {
        reply.status(404).send({
          success: false,
          error: err.message,
        })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'Shopping list generation error')
      reply.status(500).send({
        success: false,
        error: `買い物リスト生成に失敗しました: ${message}`,
      })
    }
  })

  // Register shopping list to Google Calendar
  app.post('/api/shopping/register-to-calendar', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const body = RegisterToCalendarRequestSchema.parse(request.body)

      const result = await registerShoppingListToCalendarForUser({
        userId,
        weekStartDate: body.weekStartDate,
        scheduledDate: body.scheduledDate,
        ...(body.scheduledTime !== undefined && { scheduledTime: body.scheduledTime }),
      })

      reply.send({
        success: true,
        data: {
          eventId: result.eventId,
          htmlLink: result.htmlLink,
        },
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
      if (err instanceof Error && err.message.includes('not found')) {
        reply.status(404).send({
          success: false,
          error: err.message,
        })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'Calendar registration error')
      reply.status(500).send({
        success: false,
        error: `カレンダー登録に失敗しました: ${message}`,
      })
    }
  })
}
