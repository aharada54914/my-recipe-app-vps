import type { Ingredient, IngredientPrice, Recipe } from '../../db/db'
import { resolveIngredientPrice } from './priceResolver'

export type WeeklyMenuCostMode = 'saving' | 'ignore' | 'luxury'

const MODE_FACTOR: Record<Exclude<WeeklyMenuCostMode, 'ignore'>, number> = {
  saving: 0.9,
  luxury: 1.2,
}

function estimateQuantityInBasis(ing: Ingredient): number {
  if (typeof ing.quantity !== 'number') return 0
  if (ing.unit === 'g' || ing.unit === 'ml') return ing.quantity
  if (ing.unit === '個') return ing.quantity
  if (ing.unit === '大さじ') return ing.quantity * 15
  if (ing.unit === '小さじ') return ing.quantity * 5
  return ing.quantity
}

export async function estimateRecipeCost(recipe: Recipe, mode: WeeklyMenuCostMode, priceTable?: IngredientPrice[]): Promise<number> {
  if (mode === 'ignore') return 0
  let total = 0
  for (const ing of recipe.ingredients) {
    if (ing.category === 'sub') continue // exclude seasoning
    const resolved = await resolveIngredientPrice(ing.name, priceTable)
    const qty = estimateQuantityInBasis(ing)
    const factor = MODE_FACTOR[mode]
    total += qty * resolved.tokyoAvgPrice * factor
  }
  return Math.round(total)
}
