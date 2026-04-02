import { prisma } from '../db.js'
import { getCurrentWeekMonday } from '../lib/date.js'

export interface WeeklyMenuResourceItem {
  date: string
  recipeId: number
  recipeTitle: string
  mainServings: number
  sideRecipeId?: number
  sideRecipeTitle?: string
}

export interface WeeklyMenuResourceData {
  userId: string
  weekStartDate: string
  status: string | null
  items: WeeklyMenuResourceItem[]
  message?: string
}

export interface TodayMenuResourceData {
  userId: string
  weekStartDate: string
  date: string
  item: WeeklyMenuResourceItem | null
  message?: string
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
  return typeof obj['recipeId'] === 'number'
    && typeof obj['date'] === 'string'
    && typeof obj['mainServings'] === 'number'
}

async function buildWeeklyMenuItems(rawItems: unknown[]): Promise<WeeklyMenuResourceItem[]> {
  const items = rawItems.filter(isWeeklyMenuRawItem)
  const recipeIds = new Set<number>()

  for (const item of items) {
    recipeIds.add(item.recipeId)
    if (item.sideRecipeId != null) {
      recipeIds.add(item.sideRecipeId)
    }
  }

  const recipes = recipeIds.size === 0
    ? []
    : await prisma.recipe.findMany({
        where: { id: { in: Array.from(recipeIds) } },
        select: { id: true, title: true },
      })

  const titleMap = new Map<number, string>(recipes.map((recipe) => [recipe.id, recipe.title]))

  return items.map((item) => ({
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
}

export async function getWeeklyMenuData(input: {
  userId: string
  weekStartDate?: string
}): Promise<WeeklyMenuResourceData> {
  const weekStartDate = input.weekStartDate ?? getCurrentWeekMonday()

  const menu = await prisma.weeklyMenu.findFirst({
    where: {
      userId: input.userId,
      weekStartDate,
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!menu) {
    return {
      userId: input.userId,
      weekStartDate,
      status: null,
      items: [],
      message: '指定した週の献立が見つかりません。',
    }
  }

  const rawItems: unknown[] = Array.isArray(menu.items) ? [...menu.items] : []
  const items = await buildWeeklyMenuItems(rawItems)

  return {
    userId: input.userId,
    weekStartDate: menu.weekStartDate,
    status: menu.status,
    items,
  }
}

export async function readWeeklyMenuResource(userId: string, weekStartDate: string): Promise<string> {
  return JSON.stringify(await getWeeklyMenuData({ userId, weekStartDate }), null, 2)
}
