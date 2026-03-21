import { TOKYO_INGREDIENT_PRICE_SEED } from '../../data/ingredientAveragePrices'
import { db } from '../../db/db'

export async function syncTokyoPrices(now = new Date()): Promise<{ updated: number }> {
  let updated = 0
  await db.transaction('rw', db.ingredientPrices, db.ingredientPriceSyncLogs, async () => {
    for (const row of TOKYO_INGREDIENT_PRICE_SEED) {
      const existing = await db.ingredientPrices.where('normalizedName').equals(row.normalizedName).first()
      if (existing?.id != null) {
        await db.ingredientPrices.update(existing.id, {
          ...row,
          updatedAt: now,
        })
      } else {
        await db.ingredientPrices.add({ ...row, updatedAt: now })
      }
      updated += 1
    }
    await db.ingredientPriceSyncLogs.add({
      startedAt: now,
      endedAt: new Date(),
      status: 'success',
      updatedCount: updated,
      failedCount: 0,
      errorSummary: '',
    })
  })
  return { updated }
}
