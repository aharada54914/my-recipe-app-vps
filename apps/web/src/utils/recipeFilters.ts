import type { Recipe } from '../db/db'
import { getCurrentSeasonalIngredients } from '../data/seasonalIngredients'
import type { RecipeSearchFacetState } from './searchFacets'
import { isHelsioDeli } from './recipeUtils'

const seasonalIngredients = getCurrentSeasonalIngredients()

export function applyRecipeFacetFilters(
  recipes: Recipe[],
  facets: RecipeSearchFacetState,
) {
  let filtered = recipes

  if (facets.devices.length > 0) {
    const deviceSet = new Set(facets.devices)
    filtered = filtered.filter((recipe) => deviceSet.has(recipe.device))
  }

  if (facets.categories.length > 0) {
    const categorySet = new Set(facets.categories)
    filtered = filtered.filter((recipe) => categorySet.has(recipe.category))
  }

  if (facets.quick) {
    filtered = filtered.filter((recipe) => recipe.totalTimeMinutes <= 30)
  }

  if (facets.seasonal) {
    filtered = filtered.filter(
      (recipe) =>
        !isHelsioDeli(recipe) &&
        recipe.ingredients.some((ingredient) =>
          seasonalIngredients.some((seasonalIngredient) => ingredient.name.includes(seasonalIngredient)),
        ),
    )
  }

  return filtered
}

export const applyUiRecipeFilters = applyRecipeFacetFilters
