import { db } from './db'
import type { Recipe, RecipeNutritionPerServing } from './db'
import { STOCK_MASTER } from '../data/stockMaster'

// Increment this version string when the estimation logic changes significantly,
// to force re-estimation on next launch for existing users.
const NUTRITION_ESTIMATION_VERSION = 'v8'
const NUTRITION_ESTIMATION_KEY = 'nutritionEstimationApplied'
let initPromise: Promise<void> | null = null
let nutritionMaintenancePromise: Promise<void> | null = null

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

async function loadSeedRecipesAsset(fileName: string): Promise<Omit<Recipe, 'id'>[]> {
  const base = import.meta.env.BASE_URL || '/'
  const assetUrl = `${base.replace(/\/?$/, '/')}seed/${fileName}`
  const response = await fetch(assetUrl, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Failed to load seed recipes: ${fileName} (${response.status})`)
  }
  return response.json() as Promise<Omit<Recipe, 'id'>[]>
}

export function shouldRunNutritionMaintenance(recipeCount: number, appliedVersion: string | null): boolean {
  return recipeCount === 0 || appliedVersion !== NUTRITION_ESTIMATION_VERSION
}

/**
 * Applies ingredient-based nutrition estimation to all recipes that are missing
 * nutritionPerServing data. Runs once per install (tracked via localStorage).
 * Preserves existing CSV-parsed energyKcal / saltEquivalentG when present.
 */
async function applyNutritionEstimation(): Promise<void> {
  const {
    estimateRecipeNutritionDetailed,
    resolveNutritionMetaConfidence,
  } = await import('../utils/nutritionEstimator')
  const { NUTRITION_REFERENCE } = await import('../data/nutritionLookup')
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
    if (!isEstimatedOrUnknown && hasNutrition5Coverage(r.nutritionPerServing) && hasCurrentEstimatedSchema) return

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
      confidence: resolveNutritionMetaConfidence(
        r.nutritionMeta?.source,
        r.nutritionMeta?.confidence,
        diagnostics,
      ),
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

async function seedRecipesIfEmpty(): Promise<{ recipeCount: number, seeded: boolean }> {
  const recipeCount = await db.recipes.count()
  if (recipeCount === 0) {
    const [hotcookRecipes, healsioRecipes, bookletRecipes] = await Promise.all([
      loadSeedRecipesAsset('recipes-hotcook.json'),
      loadSeedRecipesAsset('recipes-healsio.json'),
      loadSeedRecipesAsset('recipes-booklet.json'),
    ])
    const allRecipes = [
      ...hotcookRecipes,
      ...healsioRecipes,
      ...bookletRecipes,
    ].map((recipe) => normalizeRecipeCategory(recipe)) as Omit<Recipe, 'id'>[]
    await db.recipes.bulkAdd(allRecipes)
    return { recipeCount: allRecipes.length, seeded: true }
  }

  return { recipeCount, seeded: false }
}

async function normalizeRecipeCategories(): Promise<void> {
  await db.recipes.toCollection().modify((recipe) => {
    recipe.category = normalizeCategory(recipe.category) as Recipe['category']
  })
}

async function seedStockIfEmpty(): Promise<void> {
  const stockCount = await db.stock.count()
  if (stockCount > 0) return

  await db.stock.bulkAdd(
    STOCK_MASTER.map((item) => ({
      name: item.name,
      unit: item.unit,
      inStock: false,
      quantity: 0,
    })),
  )
}

function scheduleDeferredNutritionMaintenance(recipeCount: number): void {
  const appliedVersion = localStorage.getItem(NUTRITION_ESTIMATION_KEY)
  if (!shouldRunNutritionMaintenance(recipeCount, appliedVersion)) return
  if (nutritionMaintenancePromise) return

  nutritionMaintenancePromise = new Promise<void>((resolve) => {
    window.setTimeout(() => {
      void applyNutritionEstimation()
        .catch((error) => {
          console.error('Deferred nutrition maintenance failed', error)
        })
        .finally(() => {
          nutritionMaintenancePromise = null
          resolve()
        })
    }, 0)
  })
}

async function initDbInternal(): Promise<void> {
  const { recipeCount, seeded } = await seedRecipesIfEmpty()
  if (!seeded && recipeCount > 0) {
    await normalizeRecipeCategories()
  }

  await seedStockIfEmpty()
  scheduleDeferredNutritionMaintenance(recipeCount)
}

export async function initDb() {
  if (initPromise) return initPromise

  initPromise = initDbInternal().catch((error) => {
    initPromise = null
    throw error
  })

  return initPromise
}
