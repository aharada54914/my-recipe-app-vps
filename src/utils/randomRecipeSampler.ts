import { db } from '../db/db'
import type { Recipe } from '../db/db'

/**
 * 全レシピから count 件をランダムサンプリングする。
 * IndexedDB のプライマリキー配列だけを取得してシャッフル → bulkGet で軽量実現。
 * offset(N).limit(200) のような連続取得バイアスを避け、全域から均一サンプリングする。
 */
export async function sampleRandomRecipes(count: number): Promise<Recipe[]> {
  const allIds = (await db.recipes.toCollection().primaryKeys()) as number[]
  if (allIds.length === 0) return []

  // Fisher-Yates で最初の count 件だけシャッフル（残りはシャッフル不要）
  const n = Math.min(count, allIds.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (allIds.length - i))
    ;[allIds[i], allIds[j]] = [allIds[j], allIds[i]]
  }
  const sampledIds = allIds.slice(0, n)

  const result = await db.recipes.bulkGet(sampledIds)
  return result.filter((r): r is Recipe => r != null)
}
