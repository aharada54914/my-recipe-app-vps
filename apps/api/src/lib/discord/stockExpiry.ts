import type { DiscordStockExpiryAlertBatch } from '@kitchen/shared-types'
import { prisma } from '../../db/client.js'

const ALERT_WINDOW_DAYS = 2

function getDayStart(date: Date): Date {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function differenceInCalendarDays(left: Date, right: Date): number {
  const leftStart = getDayStart(left).getTime()
  const rightStart = getDayStart(right).getTime()
  return Math.round((leftStart - rightStart) / (1000 * 60 * 60 * 24))
}

export async function listPendingStockExpiryAlerts(guildId: string): Promise<DiscordStockExpiryAlertBatch> {
  const now = new Date()
  const alertWindowEnd = new Date(now.getTime() + (1000 * 60 * 60 * 24 * ALERT_WINDOW_DAYS))
  const notifiedSince = getDayStart(now)

  const links = await prisma.discordUserLink.findMany({
    where: { guildId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          stocks: {
            where: {
              inStock: true,
              expiresAt: {
                not: null,
                lte: alertWindowEnd,
              },
              OR: [
                { lastExpiryAlertAt: null },
                { lastExpiryAlertAt: { lt: notifiedSince } },
              ],
            },
            select: {
              id: true,
              name: true,
              expiresAt: true,
              purchasedAt: true,
            },
            orderBy: [{ expiresAt: 'asc' }, { name: 'asc' }],
          },
        },
      },
    },
  })

  return {
    guildId,
    items: links.flatMap((link) =>
      link.user.stocks.flatMap((stock) => {
        if (!stock.expiresAt) return []
        return [{
          stockId: stock.id,
          userId: link.user.id,
          userLabel: link.user.name?.trim() || link.user.email,
          stockName: stock.name,
          expiresAt: stock.expiresAt,
          ...(stock.purchasedAt ? { purchasedAt: stock.purchasedAt } : {}),
          daysUntilExpiry: differenceInCalendarDays(stock.expiresAt, now),
        }]
      }),
    ),
  }
}

export async function markStockExpiryAlertsSent(stockIds: number[]): Promise<void> {
  const uniqueIds = Array.from(new Set(stockIds.filter((value) => Number.isInteger(value) && value > 0)))
  if (uniqueIds.length === 0) return

  await prisma.stock.updateMany({
    where: { id: { in: uniqueIds } },
    data: { lastExpiryAlertAt: new Date() },
  })
}

