import type { JsonValue } from '@prisma/client/runtime/library'
import type { DeviceType, EditableRecipeCategory, PhotoRecipeCandidate, RecipeCategory } from '@kitchen/shared-types'

type RawIngredient = {
  name?: unknown
}

export interface RecipeRecordLite {
  id: number
  title: string
  device: string
  category: string
  baseServings: number
  ingredients: JsonValue
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function categoryToEditable(category: string): EditableRecipeCategory {
  if (category === '主菜' || category === '副菜' || category === 'スープ' || category === '一品料理' || category === 'スイーツ') {
    return category
  }
  return '一品料理'
}

function deviceToTyped(device: string): DeviceType {
  if (device === 'hotcook' || device === 'healsio' || device === 'manual') {
    return device
  }
  return 'manual'
}

export function extractIngredientNames(ingredients: JsonValue): string[] {
  if (!Array.isArray(ingredients)) return []
  return ingredients
    .map((item) => {
      const name = (item as RawIngredient)?.name
      return typeof name === 'string' ? name.trim() : ''
    })
    .filter((name) => name.length > 0)
}

export function buildPhotoRecipeCandidates(params: {
  recipes: RecipeRecordLite[]
  requestedServings: number
  availableIngredients: string[]
  excludeRecipeIds?: number[]
}): PhotoRecipeCandidate[] {
  const ingredientSet = new Set(params.availableIngredients.map(normalizeText))
  const excluded = new Set(params.excludeRecipeIds ?? [])

  return params.recipes
    .filter((recipe) => !excluded.has(recipe.id))
    .map((recipe) => {
      const ingredientNames = extractIngredientNames(recipe.ingredients)
      const matchedIngredients = ingredientNames.filter((name) => ingredientSet.has(normalizeText(name)))
      const missingIngredients = ingredientNames.filter((name) => !ingredientSet.has(normalizeText(name)))
      const matchRatio = ingredientNames.length > 0 ? matchedIngredients.length / ingredientNames.length : 0
      const score = Number((matchedIngredients.length * 5 + matchRatio * 10 - missingIngredients.length * 0.5).toFixed(2))
      return {
        recipeId: recipe.id,
        title: recipe.title,
        device: deviceToTyped(recipe.device),
        category: categoryToEditable(recipe.category),
        baseServings: recipe.baseServings,
        requestedServings: params.requestedServings,
        matchedIngredients,
        missingIngredients,
        score,
      }
    })
    .filter((candidate) => candidate.matchedIngredients.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
}

function titleKeywordScore(title: string, weatherText: string, maxTempC: number, precipitationMm: number): number {
  const normalizedTitle = normalizeText(title)
  let score = 0

  const wantsWarm = precipitationMm >= 5 || maxTempC <= 14 || /雨|曇/.test(weatherText)
  const wantsLight = maxTempC >= 26 || /晴/.test(weatherText)

  if (wantsWarm && /(煮|鍋|スープ|汁|カレー|シチュー|ポトフ)/.test(normalizedTitle)) score += 8
  if (wantsLight && /(サラダ|冷|南蛮|蒸し|和え|そうめん|そば)/.test(normalizedTitle)) score += 8
  if (wantsLight && /(揚げ|こってり|濃厚)/.test(normalizedTitle)) score -= 2

  return score
}

function categoryScore(category: RecipeCategory | string): number {
  if (category === '主菜') return 8
  if (category === '一品料理') return 7
  if (category === '副菜') return 3
  if (category === 'スープ') return 1
  return -6
}

function deviceWeatherScore(device: DeviceType | string, maxTempC: number, precipitationMm: number): number {
  if (precipitationMm >= 5 || maxTempC <= 12) {
    if (device === 'hotcook') return 5
    if (device === 'manual') return 2
  }
  if (maxTempC >= 28) {
    if (device === 'healsio') return 4
    if (device === 'manual') return 1
  }
  return 0
}

export function buildWeeklyMenuDayScore(params: {
  recipe: RecipeRecordLite
  selectedRecipeIds: Set<number>
  weatherText: string
  maxTempC: number
  precipitationMm: number
  dayIndex: number
  notes?: string
}): number {
  const duplicatePenalty = params.selectedRecipeIds.has(params.recipe.id) ? 100 : 0
  const notePenalty = params.notes && normalizeText(params.notes).length > 0
    ? (normalizeText(params.recipe.title).includes(normalizeText(params.notes)) ? 20 : 0)
    : 0

  return (
    categoryScore(params.recipe.category)
    + deviceWeatherScore(params.recipe.device, params.maxTempC, params.precipitationMm)
    + titleKeywordScore(params.recipe.title, params.weatherText, params.maxTempC, params.precipitationMm)
    - duplicatePenalty
    - notePenalty
    - params.dayIndex * 0.1
  )
}
