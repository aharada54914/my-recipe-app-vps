import type { Recipe } from '../db/db'
import { db } from '../db/db'
import { calculateMatchRate, isHelsioDeli } from './recipeUtils'
import { sampleRandomRecipes } from './randomRecipeSampler'

/**
 * Get locally-recommended recipes based on stock match rate.
 * Works entirely offline — no API needed.
 * Returns top N recipes sorted by match rate (excluding ヘルシオデリ).
 */
export async function getLocalRecommendations(limit = 6): Promise<{ recipe: Recipe; matchRate: number }[]> {
  const [recipes, stockItems] = await Promise.all([
    sampleRandomRecipes(200),
    db.stock.filter(item => item.inStock).toArray(),
  ])

  if (stockItems.length === 0) return []

  const stockNames = new Set(stockItems.map(s => s.name))

  return recipes
    .filter(r => !isHelsioDeli(r))
    .map(r => ({
      recipe: r,
      matchRate: calculateMatchRate(r.ingredients, stockNames),
    }))
    .filter(r => r.matchRate > 0)
    .sort((a, b) => b.matchRate - a.matchRate)
    .slice(0, limit)
}
