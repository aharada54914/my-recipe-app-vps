import { db, type IngredientFeatureRecord, type Recipe } from '../db/db'

const GEMINI_LOW_CONFIDENCE_WEIGHT_FLOOR = 0.2

function resolveFeatureSource(recipe: Recipe): IngredientFeatureRecord['source'] {
  if (recipe.isUserAdded) return 'gemini'
  if (recipe.recipeNumber || recipe.sourceUrl) return 'csv'
  return 'estimated'
}

function resolveFeatureConfidence(recipe: Recipe): number {
  const confidence = recipe.nutritionMeta?.confidence
  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    return Math.max(GEMINI_LOW_CONFIDENCE_WEIGHT_FLOOR, Math.min(1, confidence))
  }
  if (recipe.isUserAdded && recipe.nutritionMeta?.lowConfidence) return GEMINI_LOW_CONFIDENCE_WEIGHT_FLOOR
  return 1
}

function scoreSeasonalitySignal(recipe: Recipe): number {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  const text = `${recipe.title} ${ingredients.map((i) => i.name).join(' ')}`
  return /春|夏|秋|冬|旬|新玉ねぎ|なす|かぼちゃ|白菜/.test(text) ? 1 : 0.5
}

function scorePriceSignal(recipe: Recipe): number {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  const text = `${recipe.title} ${ingredients.map((i) => i.name).join(' ')}`
  if (/和牛|うなぎ|鰻|いくら|かに|蟹|ローストビーフ/.test(text)) return 0.15
  if (/鶏むね|もやし|豆腐|卵|豚こま/.test(text)) return 0.9
  return 0.55
}

export function buildRecipeFeatureRecord(recipe: Recipe): IngredientFeatureRecord | null {
  if (recipe.id == null) return null
  const confidence = resolveFeatureConfidence(recipe)
  return {
    recipeId: recipe.id,
    source: resolveFeatureSource(recipe),
    confidence,
    updatedAt: new Date(),
    seasonalityScore: scoreSeasonalitySignal(recipe),
    priceSignalScore: scorePriceSignal(recipe),
  }
}

function getUniqueRecipesById(recipes: Recipe[]): Recipe[] {
  const seen = new Set<number>()
  const unique: Recipe[] = []

  for (const recipe of recipes) {
    if (recipe.id == null || seen.has(recipe.id)) continue
    seen.add(recipe.id)
    unique.push(recipe)
  }

  return unique
}

async function loadRecipeFeatureRecordsByRecipeId(recipeIds: number[]): Promise<Map<number, IngredientFeatureRecord>> {
  if (recipeIds.length === 0) return new Map()

  const records = await db.recipeFeatureMatrix
    .where('recipeId')
    .anyOf(recipeIds)
    .toArray()

  return new Map(records.map((record) => [record.recipeId, record]))
}

async function persistRecipeFeatureRecords(records: IngredientFeatureRecord[]): Promise<void> {
  if (records.length === 0) return

  try {
    await db.recipeFeatureMatrix.bulkPut(records)
  } catch (error) {
    // The feature matrix is a derived cache. Weekly menu generation should continue
    // even if the cache cannot be persisted for this run.
    console.error('Failed to persist recipe feature matrix cache', error)
  }
}

export async function ensureRecipeFeatureMatrix(recipes: Recipe[]): Promise<Map<number, IngredientFeatureRecord>> {
  const uniqueRecipes = getUniqueRecipesById(recipes)
  const ids = uniqueRecipes.map((recipe) => recipe.id!)

  let existingMap = new Map<number, IngredientFeatureRecord>()
  try {
    existingMap = await loadRecipeFeatureRecordsByRecipeId(ids)
  } catch (error) {
    console.error('Failed to load recipe feature matrix cache; rebuilding in memory', error)
  }

  const newRecords = uniqueRecipes
    .filter((recipe) => !existingMap.has(recipe.id!))
    .map(buildRecipeFeatureRecord)
    .filter((record): record is IngredientFeatureRecord => record != null)

  await persistRecipeFeatureRecords(newRecords)

  for (const record of newRecords) {
    existingMap.set(record.recipeId, record)
  }
  return existingMap
}
