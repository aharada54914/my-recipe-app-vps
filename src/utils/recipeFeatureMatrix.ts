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
  const text = `${recipe.title} ${recipe.ingredients.map((i) => i.name).join(' ')}`
  return /春|夏|秋|冬|旬|新玉ねぎ|なす|かぼちゃ|白菜/.test(text) ? 1 : 0.5
}

function scorePriceSignal(recipe: Recipe): number {
  const text = `${recipe.title} ${recipe.ingredients.map((i) => i.name).join(' ')}`
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

export async function ensureRecipeFeatureMatrix(recipes: Recipe[]): Promise<Map<number, IngredientFeatureRecord>> {
  const ids = recipes.map(r => r.id).filter((id): id is number => id != null)
  const existing = await db.recipeFeatureMatrix.bulkGet(ids)
  const existingMap = new Map(
    (existing.filter(Boolean) as IngredientFeatureRecord[]).map(r => [r.recipeId, r])
  )

  const newRecords = recipes
    .filter(r => r.id != null && !existingMap.has(r.id))
    .map(buildRecipeFeatureRecord)
    .filter((record): record is IngredientFeatureRecord => record != null)

  if (newRecords.length > 0) {
    await db.recipeFeatureMatrix.bulkPut(newRecords)
  }

  for (const record of newRecords) {
    existingMap.set(record.recipeId, record)
  }
  return existingMap
}
