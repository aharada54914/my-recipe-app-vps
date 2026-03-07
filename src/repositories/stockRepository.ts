import { db, type StockItem } from '../db/db'

export async function getAllStockItems(): Promise<StockItem[]> {
  return db.stock.toArray()
}

export async function getInStockItems(): Promise<StockItem[]> {
  return db.stock.filter((item) => item.inStock).toArray()
}

export async function upsertStockItem(name: string, unit: string, quantity: number): Promise<void> {
  const existing = await db.stock.where('name').equals(name).first()
  const nextUpdatedAt = new Date()

  if (existing?.id != null) {
    await db.stock.update(existing.id, {
      quantity,
      unit,
      inStock: quantity > 0,
      updatedAt: nextUpdatedAt,
    })
    return
  }

  await db.stock.add({
    name,
    quantity,
    unit,
    inStock: quantity > 0,
    updatedAt: nextUpdatedAt,
  })
}

export async function deleteStockItem(name: string): Promise<void> {
  const existing = await db.stock.where('name').equals(name).first()
  if (existing?.id != null) {
    await db.stock.delete(existing.id)
  }
}

export async function upsertStockBatch(items: Array<{ name: string; unit: string; quantity: number }>): Promise<void> {
  const uniqueItems = Array.from(new Map(items.map((item) => [item.name, item])).values())

  await db.transaction('rw', db.stock, async () => {
    for (const item of uniqueItems) {
      const existing = await db.stock.where('name').equals(item.name).first()
      if (existing?.id != null) {
        const currentQty = typeof existing.quantity === 'number' ? existing.quantity : 0
        await db.stock.update(existing.id, {
          unit: existing.unit || item.unit,
          quantity: currentQty > 0 ? currentQty : item.quantity,
          inStock: true,
          updatedAt: new Date(),
        })
      } else {
        await db.stock.add({
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          inStock: item.quantity > 0,
          updatedAt: new Date(),
        })
      }
    }
  })
}
