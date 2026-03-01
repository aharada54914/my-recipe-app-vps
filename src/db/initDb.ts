import { db } from './db'
import type { Recipe, RecipeNutritionPerServing } from './db'
import hotcookRecipes from '../data/recipes-hotcook.json'
import healsioRecipes from '../data/recipes-healsio.json'
import { STOCK_MASTER } from '../data/stockMaster'
import { NUTRITION_REFERENCE } from '../data/nutritionLookup'

// Increment this version string when the estimation logic changes significantly,
// to force re-estimation on next launch for existing users.
const NUTRITION_ESTIMATION_VERSION = 'v6'
const NUTRITION_ESTIMATION_KEY = 'nutritionEstimationApplied'

function hasNutrition5Coverage(nutrition: RecipeNutritionPerServing | undefined): boolean {
  if (!nutrition) return false
  const required: Array<keyof RecipeNutritionPerServing> = [
    'servingSizeG',
    'energyKcal',
    'proteinG',
    'fatG',
    'carbG',
  ]
  for (const key of required) {
    const value = nutrition[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) return false
  }
  const hasSalt = typeof nutrition.saltEquivalentG === 'number' && Number.isFinite(nutrition.saltEquivalentG)
  const hasSodium = typeof nutrition.sodiumMg === 'number' && Number.isFinite(nutrition.sodiumMg)
  return hasSalt || hasSodium
}

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
  const {
    estimateRecipeNutritionDetailed,
    deriveEstimationConfidence,
  } = await import('../utils/nutritionEstimator')
  await db.recipes.toCollection().modify((recipe) => {
    const r = recipe as Recipe
    const metaSchemaVersion = typeof r.nutritionMeta?.schemaVersion === 'number'
      ? r.nutritionMeta.schemaVersion
      : 0
    const metaEstimatorVersion = typeof r.nutritionMeta?.estimatorVersion === 'string'
      ? r.nutritionMeta.estimatorVersion
      : undefined
    const isEstimatedOrUnknown = !r.nutritionMeta?.source || r.nutritionMeta.source === 'estimated'
    const hasCurrentEstimatedSchema = !isEstimatedOrUnknown || (
      metaSchemaVersion >= 3 &&
      metaEstimatorVersion === NUTRITION_REFERENCE.estimatorVersion
    )
    // Skip only when required nutrition coverage is already present.
    if (
      hasNutrition5Coverage(r.nutritionPerServing) &&
      hasCurrentEstimatedSchema
    ) return

    const existing = r.nutritionPerServing ?? {}
    const { nutrition: estimated, diagnostics } = estimateRecipeNutritionDetailed(r)

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
      confidence: r.nutritionMeta?.confidence ?? deriveEstimationConfidence(diagnostics),
      schemaVersion: 3,
      referenceDataset: NUTRITION_REFERENCE.dataset,
      referenceLabel: NUTRITION_REFERENCE.label,
      estimatorVersion: NUTRITION_REFERENCE.estimatorVersion,
      totalIngredientCount: diagnostics.totalIngredientCount,
      matchedIngredientCount: diagnostics.matchedIngredientCount,
      ingredientMatchRatio: diagnostics.ingredientMatchRatio,
      matchedWeightRatio: diagnostics.matchedWeightRatio,
      usedFallback: diagnostics.usedFallback,
      lowConfidence: diagnostics.lowConfidence,
      officialFoodCodeCount: diagnostics.officialFoodCodeCount,
      derivedFoodCodeCount: diagnostics.derivedFoodCodeCount,
      matchedFoodCodes: diagnostics.matchedFoodCodes,
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
    // Apply nutrition estimation on first launch to ensure current estimator schema is applied.
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
