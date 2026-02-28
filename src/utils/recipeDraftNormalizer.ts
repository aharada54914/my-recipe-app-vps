import type {
  DeviceType,
  IngredientCategory,
  Recipe,
  RecipeCategory,
  RecipeNutritionMeta,
  RecipeNutritionPerServing,
} from '../db/db'

export interface RecipeDraftIngredient {
  name: string
  quantity: number | string
  unit: string
  category: IngredientCategory
  optional?: boolean
}

export interface RecipeDraftStep {
  name: string
  durationMinutes: number
  isDeviceStep?: boolean
}

export interface RecipeDraft {
  title: string
  recipeNumber: string
  device: DeviceType
  category: RecipeCategory
  baseServings: number
  totalWeightG: number
  ingredients: RecipeDraftIngredient[]
  steps: RecipeDraftStep[]
  totalTimeMinutes: number
  imageUrl?: string
  sourceUrl?: string
  nutritionPerServing?: RecipeNutritionPerServing
  nutritionMeta?: RecipeNutritionMeta
}

const VALID_DEVICES: DeviceType[] = ['hotcook', 'healsio', 'manual']
const VALID_CATEGORIES: RecipeCategory[] = ['主菜', '副菜', 'スープ', '一品料理', 'スイーツ']
const VALID_INGREDIENT_CATEGORIES: IngredientCategory[] = ['main', 'sub']

function generateRecipeNumber(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `AI-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function normalizeDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 5
  return Math.round(value)
}

function normalizeQuantity(value: number | string): number | string {
  if (value === '適量') return '適量'
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  if (num < 0) return 0
  return num
}

export function toRecipeDraft(recipe: Omit<Recipe, 'id'>): RecipeDraft {
  return {
    title: recipe.title,
    recipeNumber: recipe.recipeNumber || generateRecipeNumber(),
    device: VALID_DEVICES.includes(recipe.device) ? recipe.device : 'manual',
    category: VALID_CATEGORIES.includes(recipe.category) ? recipe.category : '主菜',
    baseServings: Number.isFinite(recipe.baseServings) && recipe.baseServings > 0 ? recipe.baseServings : 2,
    totalWeightG: Number.isFinite(recipe.totalWeightG) && recipe.totalWeightG > 0 ? recipe.totalWeightG : 500,
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: normalizeQuantity(ing.quantity),
      unit: ing.unit,
      category: VALID_INGREDIENT_CATEGORIES.includes(ing.category) ? ing.category : 'main',
      ...(ing.optional ? { optional: true } : {}),
    })),
    steps: recipe.steps.map((step) => ({
      name: step.name,
      durationMinutes: normalizeDuration(step.durationMinutes),
      ...(step.isDeviceStep ? { isDeviceStep: true } : {}),
    })),
    totalTimeMinutes: Number.isFinite(recipe.totalTimeMinutes)
      ? recipe.totalTimeMinutes
      : recipe.steps.reduce((sum, step) => sum + normalizeDuration(step.durationMinutes), 0),
    ...(recipe.imageUrl ? { imageUrl: recipe.imageUrl } : {}),
    ...(recipe.sourceUrl ? { sourceUrl: recipe.sourceUrl } : {}),
    ...(recipe.nutritionPerServing ? { nutritionPerServing: recipe.nutritionPerServing } : {}),
    ...(recipe.nutritionMeta ? { nutritionMeta: recipe.nutritionMeta } : {}),
  }
}

export function normalizeRecipeDraft(draft: RecipeDraft): Omit<Recipe, 'id'> {
  const title = draft.title.trim()
  if (!title) throw new Error('レシピ名を入力してください。')

  const ingredients = draft.ingredients
    .map((ing) => ({
      name: ing.name.trim(),
      quantity: normalizeQuantity(ing.quantity),
      unit: ing.unit.trim(),
      category: VALID_INGREDIENT_CATEGORIES.includes(ing.category) ? ing.category : 'main',
      ...(ing.optional ? { optional: true } : {}),
    }))
    .filter((ing) => ing.name.length > 0)

  if (ingredients.length === 0) {
    throw new Error('材料を1件以上入力してください。')
  }

  const steps = draft.steps
    .map((step) => ({
      name: step.name.trim(),
      durationMinutes: normalizeDuration(step.durationMinutes),
      ...(step.isDeviceStep ? { isDeviceStep: true } : {}),
    }))
    .filter((step) => step.name.length > 0)

  if (steps.length === 0) {
    throw new Error('手順を1件以上入力してください。')
  }

  const baseServings = Number.isFinite(draft.baseServings) && draft.baseServings > 0
    ? Math.round(draft.baseServings)
    : 2

  const totalTimeMinutes = steps.reduce((sum, step) => sum + step.durationMinutes, 0)

  return {
    title,
    recipeNumber: draft.recipeNumber || generateRecipeNumber(),
    device: VALID_DEVICES.includes(draft.device) ? draft.device : 'manual',
    category: VALID_CATEGORIES.includes(draft.category) ? draft.category : '主菜',
    baseServings,
    totalWeightG: Number.isFinite(draft.totalWeightG) && draft.totalWeightG > 0 ? draft.totalWeightG : 500,
    ingredients,
    steps,
    totalTimeMinutes,
    ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
    ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
    ...(draft.nutritionPerServing ? { nutritionPerServing: draft.nutritionPerServing } : {}),
    ...(draft.nutritionMeta ? { nutritionMeta: draft.nutritionMeta } : {}),
  }
}
