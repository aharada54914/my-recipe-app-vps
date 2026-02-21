/**
 * Weekly Shopping List Aggregation
 *
 * Combines ingredients from multiple recipes and calculates missing items.
 */

import type { Recipe, StockItem } from '../db/db'
import { formatQuantityVibe } from './recipeUtils'

export interface AggregatedIngredient {
  name: string
  totalQuantity: number | string
  unit: string
  ingredientCategory: 'main' | 'sub'
  inStock: boolean
}

/**
 * Aggregate ingredients from multiple recipes.
 * Same name + same unit → merge quantities.
 * 適量 items are not aggregated, shown once only.
 */
export function aggregateIngredients(
  recipes: Recipe[],
  stockItems: StockItem[]
): AggregatedIngredient[] {
  const stockNames = new Set(stockItems.filter(s => s.inStock).map(s => s.name))
  const map = new Map<string, AggregatedIngredient>()

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const key = `${ing.name}__${ing.unit}`

      if (ing.quantity === '適量' || ing.unit === '適量') {
        // Don't aggregate 適量 — just mark presence
        if (!map.has(key)) {
          map.set(key, {
            name: ing.name,
            totalQuantity: '適量',
            unit: '',
            ingredientCategory: ing.category,
            inStock: stockNames.has(ing.name),
          })
        }
        continue
      }

      const existing = map.get(key)
      if (existing) {
        if (typeof existing.totalQuantity === 'number' && typeof ing.quantity === 'number') {
          existing.totalQuantity += ing.quantity
        }
      } else {
        map.set(key, {
          name: ing.name,
          totalQuantity: ing.quantity,
          unit: ing.unit,
          ingredientCategory: ing.category,
          inStock: stockNames.has(ing.name),
        })
      }
    }
  }

  // Sort: main ingredients first, then sub; within each group, not-in-stock first
  return Array.from(map.values()).sort((a, b) => {
    // Main before sub
    if (a.ingredientCategory !== b.ingredientCategory) {
      return a.ingredientCategory === 'main' ? -1 : 1
    }
    // Not in stock before in stock
    if (a.inStock !== b.inStock) {
      return a.inStock ? 1 : -1
    }
    return 0
  })
}

/**
 * Get only the missing (not in stock) ingredients.
 */
export function getMissingWeeklyIngredients(
  recipes: Recipe[],
  stockItems: StockItem[]
): AggregatedIngredient[] {
  return aggregateIngredients(recipes, stockItems).filter(ing => !ing.inStock)
}

/**
 * Format aggregated shopping list for LINE sharing.
 */
export function formatWeeklyShoppingList(
  weekStart: string,
  ingredients: AggregatedIngredient[]
): string {
  const missing = ingredients.filter(ing => !ing.inStock)

  if (missing.length === 0) {
    return `${weekStart}〜 の週間献立\n全ての材料が揃っています！`
  }

  const mainItems = missing.filter(i => i.ingredientCategory === 'main')
  const subItems = missing.filter(i => i.ingredientCategory === 'sub')

  let text = `${weekStart}〜 買い物リスト\n`
  text += `─────────────\n`

  if (mainItems.length > 0) {
    text += `【主材料】\n`
    for (const item of mainItems) {
      const qty = item.totalQuantity === '適量' || item.unit === '適量'
        ? '適量'
        : formatQuantityVibe(item.totalQuantity, item.unit)
      text += `・${item.name} ${qty}\n`
    }
  }

  if (subItems.length > 0) {
    text += `【調味料・その他】\n`
    for (const item of subItems) {
      const qty = item.totalQuantity === '適量' || item.unit === '適量'
        ? '適量'
        : formatQuantityVibe(item.totalQuantity, item.unit)
      text += `・${item.name} ${qty}\n`
    }
  }

  return text.trimEnd()
}
