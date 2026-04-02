import type { ConsultationRequest } from '@kitchen/shared-types'
import { prisma } from '../../db/client.js'
import { askGeminiConsultation } from '../gemini.js'

export const DAILY_LIMIT = 10

export async function getTodayUsageCount(userId: string): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  return prisma.consultationLog.count({
    where: {
      userId,
      createdAt: { gte: todayStart },
    },
  })
}

export async function askConsultation(
  userId: string,
  body: ConsultationRequest,
): Promise<{ response: string; remaining: number; limit: number }> {
  // Check daily limit
  const todayCount = await getTodayUsageCount(userId)
  if (todayCount >= DAILY_LIMIT) {
    throw new Error(`1日の相談回数上限(${DAILY_LIMIT}回)に達しました。明日またお試しください。`)
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
  }, 'advice')

  // Log the consultation
  await prisma.consultationLog.create({
    data: {
      userId,
      message: body.message,
      response,
    },
  })

  const remaining = DAILY_LIMIT - todayCount - 1

  return { response, remaining, limit: DAILY_LIMIT }
}
