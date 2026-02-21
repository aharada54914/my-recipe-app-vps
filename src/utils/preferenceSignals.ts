import type { CalendarEventRecord, DeviceType, Favorite, Recipe, RecipeCategory, ViewHistory, WeeklyMenu } from '../db/db'

export interface PreferenceSignalsInput {
  recipes: Recipe[]
  viewHistory: ViewHistory[]
  favorites: Favorite[]
  weeklyMenus: WeeklyMenu[]
  calendarEvents: CalendarEventRecord[]
  now?: Date
}

export interface PreferenceProfile {
  recipeAffinity: Map<number, number>
  categoryAffinity: Map<RecipeCategory, number>
  deviceAffinity: Map<DeviceType, number>
  ingredientAffinity: Map<string, number>
  maxRecipeAffinity: number
}

function daysAgo(date: Date, now: Date): number {
  return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function decayWeight(days: number, halfLifeDays: number): number {
  return Math.exp(-days / halfLifeDays)
}

function addMapValue<T>(map: Map<T, number>, key: T, delta: number): void {
  map.set(key, (map.get(key) ?? 0) + delta)
}

function contributeRecipeContext(
  recipe: Recipe,
  weight: number,
  categoryAffinity: Map<RecipeCategory, number>,
  deviceAffinity: Map<DeviceType, number>,
  ingredientAffinity: Map<string, number>
): void {
  addMapValue(categoryAffinity, recipe.category, weight)
  addMapValue(deviceAffinity, recipe.device, weight)

  // Prefer main ingredients for taste profile
  for (const ing of recipe.ingredients) {
    const normalized = ing.name.trim().toLowerCase()
    if (!normalized) continue
    const ingredientWeight = ing.category === 'main' ? weight * 0.7 : weight * 0.2
    addMapValue(ingredientAffinity, normalized, ingredientWeight)
  }
}

export function buildPreferenceProfile(input: PreferenceSignalsInput): PreferenceProfile {
  const now = input.now ?? new Date()
  const recipeById = new Map(input.recipes.filter((r): r is Recipe & { id: number } => r.id != null).map((r) => [r.id, r]))

  const recipeAffinity = new Map<number, number>()
  const categoryAffinity = new Map<RecipeCategory, number>()
  const deviceAffinity = new Map<DeviceType, number>()
  const ingredientAffinity = new Map<string, number>()

  for (const entry of input.viewHistory) {
    const recipe = recipeById.get(entry.recipeId)
    if (!recipe) continue
    const weight = 1.2 * decayWeight(daysAgo(new Date(entry.viewedAt), now), 21)
    addMapValue(recipeAffinity, entry.recipeId, weight)
    contributeRecipeContext(recipe, weight * 0.55, categoryAffinity, deviceAffinity, ingredientAffinity)
  }

  for (const fav of input.favorites) {
    const recipe = recipeById.get(fav.recipeId)
    if (!recipe) continue
    const weight = 4.5 * decayWeight(daysAgo(new Date(fav.addedAt), now), 45)
    addMapValue(recipeAffinity, fav.recipeId, weight)
    contributeRecipeContext(recipe, weight * 0.8, categoryAffinity, deviceAffinity, ingredientAffinity)
  }

  for (const menu of input.weeklyMenus) {
    const baseWeight = menu.status === 'registered' ? 3.0 : 1.8
    for (const item of menu.items) {
      const main = recipeById.get(item.recipeId)
      if (main) {
        addMapValue(recipeAffinity, item.recipeId, baseWeight)
        contributeRecipeContext(main, baseWeight * 0.7, categoryAffinity, deviceAffinity, ingredientAffinity)
      }
      if (item.sideRecipeId != null) {
        const side = recipeById.get(item.sideRecipeId)
        if (side) {
          addMapValue(recipeAffinity, item.sideRecipeId, baseWeight * 0.8)
          contributeRecipeContext(side, baseWeight * 0.5, categoryAffinity, deviceAffinity, ingredientAffinity)
        }
      }
    }
  }

  for (const event of input.calendarEvents) {
    if (event.eventType !== 'meal') continue
    const recipe = recipeById.get(event.recipeId)
    if (!recipe) continue
    const weight = 2.4 * decayWeight(daysAgo(new Date(event.createdAt), now), 30)
    addMapValue(recipeAffinity, event.recipeId, weight)
    contributeRecipeContext(recipe, weight * 0.6, categoryAffinity, deviceAffinity, ingredientAffinity)
  }

  const maxRecipeAffinity = Math.max(1, ...recipeAffinity.values())

  return {
    recipeAffinity,
    categoryAffinity,
    deviceAffinity,
    ingredientAffinity,
    maxRecipeAffinity,
  }
}
