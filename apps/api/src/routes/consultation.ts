import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.ts'
import { askGeminiConsultation } from '../lib/gemini.ts'
import { ConsultationRequestSchema } from '@kitchen/shared-types'

const DAILY_LIMIT = 10

async function getTodayUsageCount(userId: string): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  return prisma.consultationLog.count({
    where: {
      userId,
      createdAt: { gte: todayStart },
    },
  })
}

export async function registerConsultationRoutes(app: FastifyInstance): Promise<void> {
  // Ask consultation (authenticated, rate-limited)
  app.post('/api/consultation/ask', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const body = ConsultationRequestSchema.parse(request.body)

      // Check daily limit
      const todayCount = await getTodayUsageCount(userId)
      if (todayCount >= DAILY_LIMIT) {
        reply.status(429).send({
          success: false,
          error: `1日の相談回数上限(${DAILY_LIMIT}回)に達しました。明日またお試しください。`,
          data: { remaining: 0, limit: DAILY_LIMIT },
        })
        return
      }

      // Build context from user data
      const [user, stocks] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { preferences: true },
        }),
        prisma.stock.findMany({
          where: { userId },
          select: { name: true, inStock: true },
        }),
      ])

      const preferences = user?.preferences as Record<string, unknown> | null
      const userPrompt = typeof preferences?.['userPrompt'] === 'string'
        ? preferences['userPrompt']
        : undefined

      // Get today's menu if available
      let todayMenuTitle: string | undefined
      let sideMenuTitle: string | undefined

      if (body.context?.todayMenu) {
        const mainRecipe = await prisma.recipe.findUnique({
          where: { id: body.context.todayMenu.recipeId },
          select: { title: true },
        })
        todayMenuTitle = mainRecipe?.title ?? undefined

        if (body.context.todayMenu.sideRecipeId) {
          const sideRecipe = await prisma.recipe.findUnique({
            where: { id: body.context.todayMenu.sideRecipeId },
            select: { title: true },
          })
          sideMenuTitle = sideRecipe?.title ?? undefined
        }
      }

      const response = await askGeminiConsultation(body.message, {
        todayMenuTitle,
        sideMenuTitle,
        stockItems: stocks,
        userPrompt,
      })

      // Log the consultation
      await prisma.consultationLog.create({
        data: {
          userId,
          message: body.message,
          response,
        },
      })

      const remaining = DAILY_LIMIT - todayCount - 1

      reply.send({
        success: true,
        data: {
          response,
          remaining,
          limit: DAILY_LIMIT,
        },
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation error',
          data: err.errors,
        })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      app.log.error('Consultation error:', err)
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
