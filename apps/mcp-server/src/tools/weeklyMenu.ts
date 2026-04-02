import { z } from 'zod'
import { prisma } from '../db.js'

export const getWeeklyMenuInputSchema = z.object({
  weekStartDate: z.string().optional(),
})

export type GetWeeklyMenuInput = z.infer<typeof getWeeklyMenuInputSchema>

function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day // days to subtract to reach Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  const yyyy = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const dd = String(monday.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface WeeklyMenuRawItem {
  recipeId: number
  date: string
  mainServings: number
  sideRecipeId?: number
  mealType?: string
  locked?: boolean
}

function isWeeklyMenuRawItem(value: unknown): value is WeeklyMenuRawItem {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return typeof obj['recipeId'] === 'number' && typeof obj['date'] === 'string' && typeof obj['mainServings'] === 'number'
}

export async function getWeeklyMenu(input: GetWeeklyMenuInput): Promise<string> {
  const weekStartDate = input.weekStartDate ?? getCurrentWeekMonday()

  const menu = input.weekStartDate
    ? await prisma.weeklyMenu.findFirst({
        where: { weekStartDate },
        orderBy: { updatedAt: 'desc' },
      })
    : await prisma.weeklyMenu.findFirst({
        orderBy: { updatedAt: 'desc' },
      })

  if (!menu) {
    return JSON.stringify({ message: '週間献立が見つかりません。', weekStartDate }, null, 2)
  }

  const rawItems: unknown[] = Array.isArray(menu.items) ? menu.items : []
  const items = rawItems.filter(isWeeklyMenuRawItem)

  // Collect all recipeIds to fetch titles in one query
  const recipeIds = new Set<number>()
  for (const item of items) {
    recipeIds.add(item.recipeId)
    if (item.sideRecipeId != null) {
      recipeIds.add(item.sideRecipeId)
    }
  }

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: Array.from(recipeIds) } },
    select: { id: true, title: true },
  })

  const titleMap = new Map<number, string>(recipes.map((r) => [r.id, r.title]))

  const enrichedItems = items.map((item) => ({
    date: item.date,
    recipeId: item.recipeId,
    recipeTitle: titleMap.get(item.recipeId) ?? '不明なレシピ',
    mainServings: item.mainServings,
    ...(item.sideRecipeId != null
      ? {
          sideRecipeId: item.sideRecipeId,
          sideRecipeTitle: titleMap.get(item.sideRecipeId) ?? '不明なレシピ',
        }
      : {}),
  }))

  return JSON.stringify(
    {
      id: menu.id,
      weekStartDate: menu.weekStartDate,
      status: menu.status,
      items: enrichedItems,
    },
    null,
    2,
  )
}
