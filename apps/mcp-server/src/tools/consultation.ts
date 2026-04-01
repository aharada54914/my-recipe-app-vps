import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '../db.js'

export const askKitchenInputSchema = z.object({
  message: z.string().min(1),
  userId: z.string().min(1),
})

export type AskKitchenInput = z.infer<typeof askKitchenInputSchema>

interface StockItem {
  name: string
  quantity: number | null
  unit: string | null
}

interface WeeklyMenuRawItem {
  recipeId: number
  date: string
  mainServings: number
  sideRecipeId?: number
}

function isWeeklyMenuRawItem(value: unknown): value is WeeklyMenuRawItem {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return typeof obj['recipeId'] === 'number' && typeof obj['date'] === 'string' && typeof obj['mainServings'] === 'number'
}

function getTodayDateString(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function buildPrompt(params: {
  message: string
  stockItems: StockItem[]
  todayMenuTitle: string | null
  preferences: unknown
}): string {
  const stockText =
    params.stockItems.length > 0
      ? params.stockItems
          .map((s) => `- ${s.name}${s.quantity != null ? ` (${s.quantity}${s.unit ?? ''})` : ''}`)
          .join('\n')
      : '在庫なし'

  const todayMenuText = params.todayMenuTitle
    ? `今日の献立: ${params.todayMenuTitle}`
    : '今日の献立は未設定です'

  return [
    '# キッチンアシスタント',
    '',
    '## ユーザーの在庫',
    stockText,
    '',
    `## ${todayMenuText}`,
    '',
    '## ユーザーの質問',
    params.message,
    '',
    '上記の情報をもとに、簡潔で実用的なアドバイスを日本語で答えてください。',
  ].join('\n')
}

export async function askKitchen(input: AskKitchenInput): Promise<string> {
  const { message, userId } = input
  const today = getTodayDateString()

  const [stockItems, user, latestMenu] = await Promise.all([
    prisma.stock.findMany({
      where: { userId, inStock: true },
      select: { name: true, quantity: true, unit: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }),
    prisma.weeklyMenu.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { items: true },
    }),
  ])

  // Find today's menu item from the latest weekly menu
  let todayMenuTitle: string | null = null
  if (latestMenu != null) {
    const rawItems: unknown[] = Array.isArray(latestMenu.items) ? latestMenu.items : []
    const todayItem = rawItems.filter(isWeeklyMenuRawItem).find((item) => item.date === today)
    if (todayItem != null) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: todayItem.recipeId },
        select: { title: true },
      })
      todayMenuTitle = recipe?.title ?? null
    }
  }

  const prompt = buildPrompt({
    message,
    stockItems,
    todayMenuTitle,
    preferences: user?.preferences ?? {},
  })

  const apiKey = process.env['GEMINI_API_KEY'] ?? ''
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent(prompt)
  const response = result.response.text()

  await prisma.consultationLog.create({
    data: {
      userId,
      message,
      response,
    },
  })

  return JSON.stringify({ response }, null, 2)
}
