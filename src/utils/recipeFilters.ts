import type { Recipe, RecipeCategory } from '../db/db'
import { getCurrentSeasonalIngredients } from '../data/seasonalIngredients'
import { isHelsioDeli } from './recipeUtils'

const seasonalIngredients = getCurrentSeasonalIngredients()

export function applyUiRecipeFilters(
  recipes: Recipe[],
  options: {
    category: RecipeCategory
    quickFilter: boolean
    seasonalFilter: boolean
  }
) {
  const { category, quickFilter, seasonalFilter } = options
  let filtered = recipes

  // Defense-in-depth: keep category filter at UI layer as well.
  // This prevents mixed results if DB query scope is widened by future refactors.
  if (category !== 'すべて') {
    filtered = filtered.filter((r) => r.category === category)
  }

  if (quickFilter) {
    filtered = filtered.filter((r) => r.totalTimeMinutes <= 30)
  }
  if (seasonalFilter) {
    filtered = filtered.filter(
      (r) =>
        !isHelsioDeli(r) &&
        r.ingredients.some((ing) =>
          seasonalIngredients.some((s) => ing.name.includes(s))
        )
    )
  }

  return filtered
}
