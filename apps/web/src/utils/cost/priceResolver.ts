import { db, type IngredientPrice } from '../../db/db'
import { INGREDIENT_SYNONYMS } from '../../data/ingredientAveragePrices'
import { resolveSimilarIngredient } from './similarIngredientResolver'

function normalizeName(name: string): string {
  return name.trim().replace(/[\s\u3000]/g, '')
}

export type PriceResolveReason = 'exact' | 'synonym' | 'similar' | 'fallback'

export interface ResolvedPrice {
  normalizedName: string
  tokyoAvgPrice: number
  unitBasis: 'g' | 'ml' | 'piece'
  reason: PriceResolveReason
  sourceUrl?: string
}

const FALLBACK_PRICE = 1.0

/**
 * @param priceTable - 呼び出し元で事前ロード済みの価格テーブル。
 *   指定すると IDB への追加クエリを行わずキャッシュから解決する。
 */
export async function resolveIngredientPrice(name: string, priceTable?: IngredientPrice[]): Promise<ResolvedPrice> {
  const normalized = normalizeName(name)

  if (priceTable) {
    // キャッシュテーブルから解決（IDB アクセスなし）
    const exact = priceTable.find(p => p.normalizedName === normalized)
    if (exact) {
      return { normalizedName: exact.normalizedName, tokyoAvgPrice: exact.tokyoAvgPrice, unitBasis: exact.unitBasis, reason: 'exact', sourceUrl: exact.sourceUrl }
    }
    const synonym = INGREDIENT_SYNONYMS[normalized]
    if (synonym) {
      const matched = priceTable.find(p => p.normalizedName === synonym)
      if (matched) {
        return { normalizedName: matched.normalizedName, tokyoAvgPrice: matched.tokyoAvgPrice, unitBasis: matched.unitBasis, reason: 'synonym', sourceUrl: matched.sourceUrl }
      }
    }
    const similar = resolveSimilarIngredient(normalized, priceTable.map(p => p.normalizedName), 0.82)
    if (similar) {
      const matched = priceTable.find(p => p.normalizedName === similar.matchedName)
      if (matched) {
        return { normalizedName: matched.normalizedName, tokyoAvgPrice: matched.tokyoAvgPrice, unitBasis: matched.unitBasis, reason: 'similar', sourceUrl: matched.sourceUrl }
      }
    }
    return { normalizedName: normalized, tokyoAvgPrice: FALLBACK_PRICE, unitBasis: 'g', reason: 'fallback' }
  }

  // キャッシュなし: 従来の IDB クエリ
  const exact = await db.ingredientPrices.where('normalizedName').equals(normalized).first()
  if (exact) {
    return {
      normalizedName: exact.normalizedName,
      tokyoAvgPrice: exact.tokyoAvgPrice,
      unitBasis: exact.unitBasis,
      reason: 'exact',
      sourceUrl: exact.sourceUrl,
    }
  }

  const synonym = INGREDIENT_SYNONYMS[normalized]
  if (synonym) {
    const matched = await db.ingredientPrices.where('normalizedName').equals(synonym).first()
    if (matched) {
      return {
        normalizedName: matched.normalizedName,
        tokyoAvgPrice: matched.tokyoAvgPrice,
        unitBasis: matched.unitBasis,
        reason: 'synonym',
        sourceUrl: matched.sourceUrl,
      }
    }
  }

  const all = await db.ingredientPrices.toArray()
  const similar = resolveSimilarIngredient(normalized, all.map((p) => p.normalizedName), 0.82)
  if (similar) {
    const matched = all.find((p) => p.normalizedName === similar.matchedName)
    if (matched) {
      return {
        normalizedName: matched.normalizedName,
        tokyoAvgPrice: matched.tokyoAvgPrice,
        unitBasis: matched.unitBasis,
        reason: 'similar',
        sourceUrl: matched.sourceUrl,
      }
    }
  }

  return {
    normalizedName: normalized,
    tokyoAvgPrice: FALLBACK_PRICE,
    unitBasis: 'g',
    reason: 'fallback',
  }
}
