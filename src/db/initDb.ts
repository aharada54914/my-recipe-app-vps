import { db } from './db'
import type { Recipe, RecipeNutritionPerServing } from './db'
import hotcookRecipes from '../data/recipes-hotcook.json'
import healsioRecipes from '../data/recipes-healsio.json'
import { STOCK_MASTER } from '../data/stockMaster'

// Increment this version string when the estimation logic changes significantly,
// to force re-estimation on next launch for existing users.
const NUTRITION_ESTIMATION_VERSION = 'v1'
const NUTRITION_ESTIMATION_KEY = 'nutritionEstimationApplied'

function normalizeCategory(category: string): string {
  if (category === 'ご飯もの') return '一品料理'
  if (category === 'デザート') return 'スイーツ'
  return category
}

function normalizeRecipeCategory<T extends { category?: string }>(recipe: T): T {
  return {
    ...recipe,
    category: normalizeCategory(recipe.category ?? ''),
  }
}

/**
 * Applies ingredient-based nutrition estimation to all recipes that are missing
 * nutritionPerServing data. Runs once per install (tracked via localStorage).
 * Preserves existing CSV-parsed energyKcal / saltEquivalentG when present.
 */
async function applyNutritionEstimation(): Promise<void> {
  const { estimateRecipeNutrition } = await import('../utils/nutritionEstimator')
  await db.recipes.toCollection().modify((recipe) => {
    const r = recipe as Recipe
    // Skip recipes already estimated at this schema version
    if (r.nutritionPerServing?.energyKcal != null && r.nutritionMeta?.schemaVersion === 1) return

    const existing = r.nutritionPerServing ?? {}
    const estimated = estimateRecipeNutrition(r)

    // Merge: existing CSV-parsed fields take priority over estimates
    const merged: RecipeNutritionPerServing = {
      servingSizeG: existing.servingSizeG ?? estimated.servingSizeG,
      energyKcal: existing.energyKcal ?? estimated.energyKcal,
      proteinG: existing.proteinG ?? estimated.proteinG,
      fatG: existing.fatG ?? estimated.fatG,
      carbG: existing.carbG ?? estimated.carbG,
      saltEquivalentG: existing.saltEquivalentG ?? estimated.saltEquivalentG,
      sodiumMg: existing.sodiumMg ?? estimated.sodiumMg,
      fiberG: existing.fiberG ?? estimated.fiberG,
      sugarG: existing.sugarG ?? estimated.sugarG,
      saturatedFatG: existing.saturatedFatG ?? estimated.saturatedFatG,
      potassiumMg: existing.potassiumMg ?? estimated.potassiumMg,
      calciumMg: existing.calciumMg ?? estimated.calciumMg,
      ironMg: existing.ironMg ?? estimated.ironMg,
      vitaminCMg: existing.vitaminCMg ?? estimated.vitaminCMg,
    }

    r.nutritionPerServing = merged
    r.nutritionMeta = {
      source: r.nutritionMeta?.source === 'jsonld' || r.nutritionMeta?.source === 'gemini'
        ? r.nutritionMeta.source
        : 'estimated',
      confidence: r.nutritionMeta?.confidence ?? 0.35,
      schemaVersion: 1,
      updatedAt: new Date(),
    }
  })
  localStorage.setItem(NUTRITION_ESTIMATION_KEY, NUTRITION_ESTIMATION_VERSION)
}

export async function initDb() {
  // Init recipes (run once on first launch)
  const recipeCount = await db.recipes.count()
  if (recipeCount === 0) {
    const allRecipes = [
      ...hotcookRecipes,
      ...healsioRecipes,
    ].map((recipe) => normalizeRecipeCategory(recipe)) as Omit<Recipe, 'id'>[]
    await db.recipes.bulkAdd(allRecipes)
    // Apply nutrition estimation for fresh installs (JSON files don't include nutritionPerServing)
    await applyNutritionEstimation()
  } else {
    // Safety migration for users whose DB was initialized before category rename was applied at import time.
    await db.recipes.toCollection().modify((recipe) => {
      recipe.category = normalizeCategory(recipe.category) as Recipe['category']
    })
    // Apply nutrition estimation for existing installs if not yet done
    if (localStorage.getItem(NUTRITION_ESTIMATION_KEY) !== NUTRITION_ESTIMATION_VERSION) {
      await applyNutritionEstimation()
    }
  }

  // Init stock from master (run once if stock table is empty)
  const stockCount = await db.stock.count()
  if (stockCount === 0) {
    await db.stock.bulkAdd(
      STOCK_MASTER.map((item) => ({
        name: item.name,
        unit: item.unit,
        inStock: false,
        quantity: 0,
      }))
    )
  }
}
