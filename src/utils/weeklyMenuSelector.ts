/**
 * Weekly Menu Auto-Selection Algorithm
 *
 * Selects 7 recipes for a week using scoring-based greedy selection.
 * Works entirely offline — no API needed.
 */

import { db, type Recipe, type WeeklyMenuItem, type SeasonalPriority } from '../db/db'
import { calculateMatchRate, isHelsioDeli } from './recipeUtils'
import { getCurrentSeasonalIngredients } from '../data/seasonalIngredients'
import { format, addDays } from 'date-fns'

export interface MenuSelectionConfig {
  seasonalPriority: SeasonalPriority
  userPrompt: string
  desiredMealHour: number
  desiredMealMinute: number
}

interface ScoredRecipe {
  recipe: Recipe
  baseScore: number
}

const SEASONAL_WEIGHTS: Record<SeasonalPriority, number> = {
  low: 0.5,
  medium: 1.5,
  high: 3.0,
}

/**
 * Select 7 recipes for a week starting from weekStartDate.
 * Uses greedy selection with scoring to balance variety and stock usage.
 */
export async function selectWeeklyMenu(
  weekStartDate: Date,
  config: MenuSelectionConfig,
  lockedItems?: WeeklyMenuItem[]
): Promise<WeeklyMenuItem[]> {
  // Gather data
  const [recipes, stockItems, recentMenus, recentHistory] = await Promise.all([
    db.recipes.limit(200).toArray(),
    db.stock.filter(item => item.inStock).toArray(),
    db.weeklyMenus.orderBy('weekStartDate').reverse().limit(2).toArray(),
    db.viewHistory.orderBy('viewedAt').reverse().limit(30).toArray(),
  ])

  if (recipes.length === 0) return []

  const stockNames = new Set(stockItems.map(s => s.name))
  const seasonalIngredients = getCurrentSeasonalIngredients()
  const seasonalWeight = SEASONAL_WEIGHTS[config.seasonalPriority]

  // Build set of recently used recipe IDs (from past weekly menus)
  const recentMenuRecipeIds = new Set<number>()
  for (const menu of recentMenus) {
    for (const item of menu.items) {
      recentMenuRecipeIds.add(item.recipeId)
    }
  }

  // Build set of recently viewed recipe IDs
  const recentViewIds = new Set(recentHistory.map(vh => vh.recipeId))

  // Filter eligible recipes (exclude ヘルシオデリ)
  const eligible = recipes.filter(r => !isHelsioDeli(r) && r.id != null)

  // Calculate base scores for each recipe
  const scored: ScoredRecipe[] = eligible.map(recipe => {
    let score = 0

    // Stock match rate (weight: 3.0)
    const matchRate = calculateMatchRate(recipe.ingredients, stockNames)
    score += matchRate * 3.0

    // Seasonal bonus
    const hasSeasonalIngredient = recipe.ingredients.some(
      ing => seasonalIngredients.some(s => ing.name.includes(s))
    )
    if (hasSeasonalIngredient) {
      score += 10 * seasonalWeight
    }

    // Penalty for recently used in weekly menus
    if (recentMenuRecipeIds.has(recipe.id!)) {
      score -= 20
    }

    // Penalty for recently viewed (less severe)
    if (recentViewIds.has(recipe.id!)) {
      score -= 5
    }

    return { recipe, baseScore: score }
  })

  // Sort by base score descending
  scored.sort((a, b) => b.baseScore - a.baseScore)

  // Build locked items map (date -> recipeId)
  const lockedMap = new Map<string, number>()
  if (lockedItems) {
    for (const item of lockedItems) {
      if (item.locked) {
        lockedMap.set(item.date, item.recipeId)
      }
    }
  }

  // Greedy selection for 7 days — main dishes
  const result: WeeklyMenuItem[] = []
  const usedRecipeIds = new Set<number>()
  const selectedCategories: string[] = []
  const selectedDevices: string[] = []

  for (let day = 0; day < 7; day++) {
    const dateStr = format(addDays(weekStartDate, day), 'yyyy-MM-dd')

    // Check if this day is locked
    const lockedRecipeId = lockedMap.get(dateStr)
    if (lockedRecipeId != null) {
      usedRecipeIds.add(lockedRecipeId)
      const lockedRecipe = eligible.find(r => r.id === lockedRecipeId)
      if (lockedRecipe) {
        selectedCategories.push(lockedRecipe.category)
        selectedDevices.push(lockedRecipe.device)
      }
      result.push({
        recipeId: lockedRecipeId,
        date: dateStr,
        mealType: 'dinner',
        locked: true,
      })
      continue
    }

    // Score candidates with diversity bonuses
    let bestRecipe: Recipe | null = null
    let bestScore = -Infinity

    for (const { recipe, baseScore } of scored) {
      if (usedRecipeIds.has(recipe.id!)) continue

      let score = baseScore

      // Category diversity bonus/penalty
      const catCount = selectedCategories.filter(c => c === recipe.category).length
      if (catCount >= 2) {
        score -= (catCount - 1) * 10
      }

      // Device diversity bonus
      const devCount = selectedDevices.filter(d => d === recipe.device).length
      if (devCount >= 3) {
        score -= (devCount - 2) * 5
      } else if (selectedDevices.length > 0 && selectedDevices[selectedDevices.length - 1] !== recipe.device) {
        score += 3 // Bonus for alternating devices
      }

      if (score > bestScore) {
        bestScore = score
        bestRecipe = recipe
      }
    }

    if (bestRecipe) {
      usedRecipeIds.add(bestRecipe.id!)
      selectedCategories.push(bestRecipe.category)
      selectedDevices.push(bestRecipe.device)
      result.push({
        recipeId: bestRecipe.id!,
        date: dateStr,
        mealType: 'dinner',
        locked: false,
      })
    }
  }

  // Second pass — select side dishes (副菜 or スープ) for each day
  const sideEligible = eligible.filter(
    r => r.category === '副菜' || r.category === 'スープ'
  )

  if (sideEligible.length > 0) {
    // Score side candidates with same base scoring
    const scoredSides: ScoredRecipe[] = sideEligible.map(recipe => {
      let score = 0
      const matchRate = calculateMatchRate(recipe.ingredients, stockNames)
      score += matchRate * 3.0
      const hasSeasonalIngredient = recipe.ingredients.some(
        ing => seasonalIngredients.some(s => ing.name.includes(s))
      )
      if (hasSeasonalIngredient) score += 10 * seasonalWeight
      if (recentMenuRecipeIds.has(recipe.id!)) score -= 20
      if (recentViewIds.has(recipe.id!)) score -= 5
      return { recipe, baseScore: score }
    })
    scoredSides.sort((a, b) => b.baseScore - a.baseScore)

    const usedSideIds = new Set<number>()
    for (const item of result) {
      let bestSide: Recipe | null = null
      let bestSideScore = -Infinity

      for (const { recipe, baseScore } of scoredSides) {
        if (usedSideIds.has(recipe.id!)) continue
        // Avoid same recipe as the main dish
        if (recipe.id === item.recipeId) continue

        // Penalise over-representation of the same sub-category
        let score = baseScore
        const subCatCount = [...usedSideIds]
          .map(id => sideEligible.find(r => r.id === id)?.category ?? '')
          .filter(c => c === recipe.category).length
        if (subCatCount >= 3) score -= (subCatCount - 2) * 8

        if (score > bestSideScore) {
          bestSideScore = score
          bestSide = recipe
        }
      }

      if (bestSide) {
        usedSideIds.add(bestSide.id!)
        item.sideRecipeId = bestSide.id!
      }
    }
  }

  return result
}

/**
 * Get the Sunday start date for the week containing the given date.
 */
export function getWeekStartDate(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dayOfWeek = d.getDay() // 0 = Sunday
  d.setDate(d.getDate() - dayOfWeek)
  return d
}

/**
 * Get top N alternative recipes for replacing a menu item.
 */
export async function getAlternativeRecipes(
  excludeIds: Set<number>,
  limit = 10
): Promise<Recipe[]> {
  const [recipes, stockItems] = await Promise.all([
    db.recipes.limit(200).toArray(),
    db.stock.filter(item => item.inStock).toArray(),
  ])

  const stockNames = new Set(stockItems.map(s => s.name))

  return recipes
    .filter(r => !isHelsioDeli(r) && r.id != null && !excludeIds.has(r.id!))
    .map(r => ({
      recipe: r,
      matchRate: calculateMatchRate(r.ingredients, stockNames),
    }))
    .sort((a, b) => b.matchRate - a.matchRate)
    .slice(0, limit)
    .map(r => r.recipe)
}
