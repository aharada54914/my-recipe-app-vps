import { syncTokyoPrices } from './priceSync'

export function shouldSyncMonthly(lastSyncAt: Date | undefined, now = new Date()): boolean {
  if (!lastSyncAt) return true
  const diffMs = now.getTime() - lastSyncAt.getTime()
  return diffMs >= 30 * 24 * 60 * 60 * 1000
}

export const shouldRunMonthlySync = shouldSyncMonthly

export async function runStartupPriceSync(lastSyncAt?: Date): Promise<{ synced: boolean, updated: number }> {
  if (!shouldSyncMonthly(lastSyncAt)) return { synced: false, updated: 0 }
  const result = await syncTokyoPrices(new Date())
  return { synced: true, updated: result.updated }
}
