import { z } from 'zod'
import { prisma } from '../db.js'

export const getStockInputSchema = z.object({
  userId: z.string().min(1),
})

export type GetStockInput = z.infer<typeof getStockInputSchema>

export async function getStock(input: GetStockInput): Promise<string> {
  const { userId } = input

  const items = await prisma.stock.findMany({
    where: {
      userId,
      inStock: true,
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true,
      purchasedAt: true,
      expiresAt: true,
    },
    orderBy: { name: 'asc' },
  })

  return JSON.stringify(items, null, 2)
}
