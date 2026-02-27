import type { Recipe, RecipeCategory } from '../db/db'
import { getCurrentSeasonalIngredients } from '../data/seasonalIngredients'
import { isHelsioDeli } from './recipeUtils'

const seasonalIngredients = getCurrentSeasonalIngredients()

export function applyUiRecipeFilters(
  recipes: Recipe[],
  options: {
    selectedCategories: RecipeCategory[]
    quickFilter: boolean
    seasonalFilter: boolean
  }
) {
  const { selectedCategories, quickFilter, seasonalFilter } = options
  let filtered = recipes

  const activeCategories = selectedCategories.filter(
    (category): category is Exclude<RecipeCategory, 'すべて'> => category !== 'すべて'
  )

  if (activeCategories.length > 0) {
    const categorySet = new Set(activeCategories)
    filtered = filtered.filter((r) => r.category !== 'すべて' && categorySet.has(r.category))
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
