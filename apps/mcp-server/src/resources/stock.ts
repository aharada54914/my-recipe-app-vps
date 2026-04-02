import { prisma } from '../db.js'

export interface StockResourceItem {
  id: number
  name: string
  quantity: number | null
  unit: string | null
  purchasedAt: Date | null
  expiresAt: Date | null
}

export async function getStockData(userId: string): Promise<StockResourceItem[]> {
  return prisma.stock.findMany({
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
}

export async function readStockResource(userId: string): Promise<string> {
  return JSON.stringify({ userId, items: await getStockData(userId) }, null, 2)
}
