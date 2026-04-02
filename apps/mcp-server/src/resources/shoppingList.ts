import { prisma } from '../db.js'
import { getCurrentWeekMonday } from '../lib/date.js'

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
  const weekStartDate = input.weekStartDate ?? getCurrentWeekMonday()

  const menu = await prisma.weeklyMenu.findFirst({
    where: {
      userId: input.userId,
      weekStartDate,
    },
    select: {
      weekStartDate: true,
      shoppingList: true,
      status: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!menu) {
    return {
      userId: input.userId,
      weekStartDate,
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
