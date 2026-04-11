import { getCurrentWeekMonday } from '../lib/date.js'
import { findWeeklyMenuRecord } from './weeklyMenu.js'

export interface ShoppingListResourceData {
  userId: string
  weekStartDate: string
  shoppingList: string | null
  status: string | null
  message?: string
}

export async function getShoppingListData(input: {
  userId: string
  weekStartDate?: string
}): Promise<ShoppingListResourceData> {
  const fallbackWeekStartDate = input.weekStartDate ?? getCurrentWeekMonday()

  const menu = await findWeeklyMenuRecord({
    userId: input.userId,
    ...(input.weekStartDate ? { weekStartDate: input.weekStartDate } : {}),
  })

  if (!menu) {
    return {
      userId: input.userId,
      weekStartDate: fallbackWeekStartDate,
      shoppingList: null,
      status: null,
      message: '指定した週の献立が見つかりません。',
    }
  }

  if (!menu.shoppingList) {
    return {
      userId: input.userId,
      weekStartDate: menu.weekStartDate,
      shoppingList: null,
      status: menu.status,
      message: '買い物リストがまだ生成されていません。',
    }
  }

  return {
    userId: input.userId,
    weekStartDate: menu.weekStartDate,
    shoppingList: menu.shoppingList,
    status: menu.status,
  }
}

export async function readShoppingListResource(userId: string, weekStartDate: string): Promise<string> {
  return JSON.stringify(await getShoppingListData({ userId, weekStartDate }), null, 2)
}
