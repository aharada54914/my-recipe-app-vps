import type { Recipe } from '../db/db'
import type { PreferenceProfile } from './preferenceSignals'

function normalize(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.max(0, Math.min(1, value / max))
}

function getIngredientSimilarity(recipe: Recipe, profile: PreferenceProfile): number {
  let total = 0
  let matched = 0

  for (const ing of recipe.ingredients) {
    if (ing.category !== 'main') continue
    total += 1
    const key = ing.name.trim().toLowerCase()
    if (!key) continue
    const weight = profile.ingredientAffinity.get(key) ?? 0
    if (weight > 0) matched += Math.min(1, weight / 5)
  }

  return total > 0 ? matched / total : 0
}

function getOwnRecipeBoost(recipe: Recipe): number {
  const fromAi = recipe.recipeNumber?.startsWith('AI-')
  const fromImport = !!recipe.sourceUrl
  return fromAi || fromImport ? 0.25 : 0
}

export function computeKitchenAppPreferenceScore(recipe: Recipe, profile: PreferenceProfile): number {
  if (recipe.id == null) return getOwnRecipeBoost(recipe)

  const recipeAffinity = profile.recipeAffinity.get(recipe.id) ?? 0
  const maxCategory = Math.max(1, ...profile.categoryAffinity.values())
  const maxDevice = Math.max(1, ...profile.deviceAffinity.values())

  const recipeSignal = normalize(recipeAffinity, profile.maxRecipeAffinity)
  const categorySignal = normalize(profile.categoryAffinity.get(recipe.category) ?? 0, maxCategory)
  const deviceSignal = normalize(profile.deviceAffinity.get(recipe.device) ?? 0, maxDevice)
  const ingredientSignal = getIngredientSimilarity(recipe, profile)

  return (
    recipeSignal * 3.4 +
    categorySignal * 1.5 +
    deviceSignal * 1.1 +
    ingredientSignal * 1.6 +
    getOwnRecipeBoost(recipe)
  )
}
