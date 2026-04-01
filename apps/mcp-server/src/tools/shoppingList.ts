import { z } from 'zod'
import { prisma } from '../db.js'

export const getShoppingListInputSchema = z.object({
  weekStartDate: z.string().min(1),
})

export type GetShoppingListInput = z.infer<typeof getShoppingListInputSchema>

export async function getShoppingList(input: GetShoppingListInput): Promise<string> {
  const { weekStartDate } = input

  const menu = await prisma.weeklyMenu.findFirst({
    where: { weekStartDate },
    select: {
      weekStartDate: true,
      shoppingList: true,
      status: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!menu) {
    return JSON.stringify(
      {
        weekStartDate,
        shoppingList: null,
        message: '指定した週の献立が見つかりません。',
      },
      null,
      2,
    )
  }

  if (!menu.shoppingList) {
    return JSON.stringify(
      {
        weekStartDate: menu.weekStartDate,
        shoppingList: null,
        message: '買い物リストがまだ生成されていません',
      },
      null,
      2,
    )
  }

  return JSON.stringify(
    {
      weekStartDate: menu.weekStartDate,
      shoppingList: menu.shoppingList,
    },
    null,
    2,
  )
}
