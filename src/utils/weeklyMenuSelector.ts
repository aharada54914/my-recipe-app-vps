/**
 * Weekly Menu Auto-Selection Algorithm
 *
 * Selects 7 recipes for a week using scoring-based greedy selection.
 * Works entirely offline — no API needed.
 */

import { db, type DeviceType, type Recipe, type WeeklyMenuItem, type SeasonalPriority } from '../db/db'
import { calculateMatchRate, isHelsioDeli } from './recipeUtils'
import { getCurrentSeasonalIngredients } from '../data/seasonalIngredients'
import { format, addDays } from 'date-fns'
import { filterRecipesByRole, isRecipeAllowedForRole, type MealRole } from './mealRoleRules'
import { DEFAULT_BALANCE_SCORING_MODE, SEASONAL_WEIGHT } from '../constants/recipeConstants'
import { inferMealBalance } from './mealBalanceHeuristics'
import { computeMainScore, computeSideScore } from './mealBalanceScoring'
import type { MealBalanceInference } from './mealBalanceTypes'
import { resolveBalanceScoringTier } from './mealBalanceTier'
import type { BalanceTierDecision } from './mealBalanceTier'
import type { WeeklyMenuCostMode } from '../db/db'
import { estimateRecipeCost } from './cost/costEstimator'
import { computeLuxuryExperienceScore } from './cost/luxuryExperience'
import { getWeeklyWeatherForecast, type DailyWeather } from './season-weather/weatherProvider'
import { computeWeatherComfortScore, computeWeatherDemandVec } from './season-weather/weatherScoring'
import { computeRecipeWeatherVec, dotProduct } from './season-weather/recipeWeatherVectors'
import { filterForecastForWeek, isCompleteForecastForWeek } from './season-weather/weekWeather'
import { ensureRecipeFeatureMatrix } from './recipeFeatureMatrix'
import type { IngredientFeatureRecord } from '../db/db'

export interface MenuSelectionConfig {
  seasonalPriority: SeasonalPriority
  userPrompt: string
  desiredMealHour: number
  desiredMealMinute: number
  weeklyMenuCostMode?: WeeklyMenuCostMode
  weeklyBudgetYen?: number
  preloadedWeather?: DailyWeather[]
}

interface ScoredRecipe {
  recipe: Recipe
  baseScore: number
}

interface SelectionContext {
  scoredMains: ScoredRecipe[]
  scoredSides: ScoredRecipe[]
  mainEligible: Recipe[]
  byRecipeId: Map<number, Recipe>
  byInferenceId: Map<number, MealBalanceInference>
  balanceTier: BalanceTierDecision
  recipeCostMap: Map<number, number>
  luxuryScoreMap: Map<number, number>
  weatherByDate: Map<string, DailyWeather>
  costMode: WeeklyMenuCostMode
  featureMatrixByRecipeId: Map<number, IngredientFeatureRecord>
}

const SEASONAL_WEIGHTS: Record<SeasonalPriority, number> = {
  low: SEASONAL_WEIGHT.OFF,
  medium: SEASONAL_WEIGHT.NORMAL,
  high: SEASONAL_WEIGHT.PEAK,
}

const TARGET_DAYS = 7

const DEVICE_TYPES: DeviceType[] = ['hotcook', 'healsio', 'manual']

function shuffleRecipes<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function countByDevice(recipes: Recipe[]): Record<DeviceType, number> {
  return recipes.reduce<Record<DeviceType, number>>((acc, recipe) => {
    acc[recipe.device] += 1
    return acc
  }, { hotcook: 0, healsio: 0, manual: 0 })
}

function buildMainDeviceTargets(mainEligible: Recipe[], lockedDevices: DeviceType[]): Record<DeviceType, number> {
  const available = countByDevice(mainEligible)
  const targets: Record<DeviceType, number> = { hotcook: 0, healsio: 0, manual: 0 }

  for (const device of lockedDevices) {
    targets[device] += 1
  }

  const lockedDays = lockedDevices.length
  const remainingDays = Math.max(0, TARGET_DAYS - lockedDays)

  if (remainingDays === 0) return targets

  const remainingAvailable: Record<DeviceType, number> = {
    hotcook: Math.max(0, available.hotcook - targets.hotcook),
    healsio: Math.max(0, available.healsio - targets.healsio),
    manual: Math.max(0, available.manual - targets.manual),
  }

  if (remainingAvailable.hotcook > 0 && remainingAvailable.healsio > 0) {
    const minEach = Math.min(2, remainingDays)
    const hotAllocation = Math.min(minEach, remainingAvailable.hotcook)
    const healAllocation = Math.min(minEach, remainingAvailable.healsio)
    targets.hotcook += hotAllocation
    targets.healsio += healAllocation
    remainingAvailable.hotcook -= hotAllocation
    remainingAvailable.healsio -= healAllocation
  }

  let slotsLeft = TARGET_DAYS - (targets.hotcook + targets.healsio + targets.manual)
  while (slotsLeft > 0) {
    const nextDevice = DEVICE_TYPES
      .filter((device) => remainingAvailable[device] > 0)
      .sort((a, b) => remainingAvailable[b] - remainingAvailable[a])[0]

    if (!nextDevice) break

    targets[nextDevice] += 1
    remainingAvailable[nextDevice] -= 1
    slotsLeft -= 1
  }

  return targets
}

function buildScoredRecipes(
  recipes: Recipe[],
  stockNames: Set<string>,
  seasonalIngredients: string[],
  seasonalWeight: number,
  recentMenuRecipeIds: Set<number>,
  recentViewIds: Set<number>,
  featureMatrixByRecipeId: Map<number, IngredientFeatureRecord>,
): ScoredRecipe[] {
  return recipes.map((recipe) => {
    let score = 0

    const matchRate = calculateMatchRate(recipe.ingredients, stockNames)
    score += matchRate * 3.0

    const hasSeasonalIngredient = recipe.ingredients.some(
      ing => seasonalIngredients.some(s => ing.name.includes(s))
    )
    if (hasSeasonalIngredient) score += 10 * seasonalWeight
    if (recentMenuRecipeIds.has(recipe.id!)) score -= 20
    if (recentViewIds.has(recipe.id!)) score -= 5

    // Apply Gemini confidence floor: low-confidence AI recipes get dampened base scores
    const featureConfidence = featureMatrixByRecipeId.get(recipe.id!)?.confidence ?? 1
    return { recipe, baseScore: score * featureConfidence }
  })
}

async function buildSelectionContext(weekStartDate: Date, config: MenuSelectionConfig): Promise<SelectionContext> {
  const [recipes, stockItems, recentMenus, recentHistory] = await Promise.all([
    db.recipes.toArray(),
    db.stock.filter(item => item.inStock).toArray(),
    db.weeklyMenus.orderBy('weekStartDate').reverse().limit(2).toArray(),
    db.viewHistory.orderBy('viewedAt').reverse().limit(30).toArray(),
  ])

  const stockNames = new Set(stockItems.map(s => s.name))
  const seasonalIngredients = getCurrentSeasonalIngredients()
  const seasonalWeight = SEASONAL_WEIGHTS[config.seasonalPriority]

  const recentMenuRecipeIds = new Set<number>()
  for (const menu of recentMenus) {
    for (const item of menu.items) {
      recentMenuRecipeIds.add(item.recipeId)
    }
  }

  const recentViewIds = new Set(recentHistory.map(vh => vh.recipeId))

  const eligible = shuffleRecipes(recipes)
    .filter(r => !isHelsioDeli(r) && r.id != null)

  const mainEligible = filterRecipesByRole(eligible, 'main')
  const sideEligible = eligible.filter((r) => isRecipeAllowedForRole(r, 'side'))

  const featureMatrixByRecipeId = await ensureRecipeFeatureMatrix(eligible)

  const scoredMains = buildScoredRecipes(
    mainEligible,
    stockNames,
    seasonalIngredients,
    seasonalWeight,
    recentMenuRecipeIds,
    recentViewIds,
    featureMatrixByRecipeId,
  ).sort((a, b) => b.baseScore - a.baseScore)

  const scoredSides = buildScoredRecipes(
    sideEligible,
    stockNames,
    seasonalIngredients,
    seasonalWeight,
    recentMenuRecipeIds,
    recentViewIds,
    featureMatrixByRecipeId,
  ).sort((a, b) => b.baseScore - a.baseScore)

  const byRecipeId = new Map<number, Recipe>()
  const byInferenceId = new Map<number, MealBalanceInference>()

  for (const recipe of eligible) {
    if (recipe.id == null) continue
    byRecipeId.set(recipe.id, recipe)
    byInferenceId.set(recipe.id, inferMealBalance(recipe))
  }

  const balanceTier = resolveBalanceScoringTier(mainEligible, DEFAULT_BALANCE_SCORING_MODE)

  const recipeCostMap = new Map<number, number>()
  const luxuryScoreMap = new Map<number, number>()
  const mode: WeeklyMenuCostMode = config.weeklyMenuCostMode ?? 'ignore'
  await Promise.all(eligible.map(async (recipe) => {
    if (recipe.id == null) return
    const cost = await estimateRecipeCost(recipe, mode)
    recipeCostMap.set(recipe.id, cost)
  }))

  const preloaded = config.preloadedWeather ? filterForecastForWeek(config.preloadedWeather, weekStartDate) : []
  const weather = isCompleteForecastForWeek(preloaded, weekStartDate)
    ? preloaded
    : await getWeeklyWeatherForecast(weekStartDate)
  const weatherByDate = new Map<string, DailyWeather>()
  weather.forEach((w) => weatherByDate.set(w.date, w))

  for (let i = 0; i < 7; i += 1) {
    const dateStr = format(addDays(weekStartDate, i), 'yyyy-MM-dd')
    for (const recipe of eligible) {
      if (recipe.id == null) continue
      luxuryScoreMap.set(recipe.id, computeLuxuryExperienceScore(recipe, i))
      if (!weatherByDate.has(dateStr)) continue
    }
  }

  return { scoredMains, scoredSides, mainEligible, byRecipeId, byInferenceId, balanceTier, recipeCostMap, luxuryScoreMap, weatherByDate, costMode: mode, featureMatrixByRecipeId }
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
  const context = await buildSelectionContext(weekStartDate, config)

  if (context.mainEligible.length === 0) return []

  const lockedMap = new Map<string, number>()
  const lockedDevices: DeviceType[] = []
  if (lockedItems) {
    for (const item of lockedItems) {
      if (!item.locked) continue
      lockedMap.set(item.date, item.recipeId)
      const lockedRecipe = context.mainEligible.find((r) => r.id === item.recipeId)
      if (lockedRecipe) lockedDevices.push(lockedRecipe.device)
    }
  }

  const mainDeviceTargets = buildMainDeviceTargets(context.mainEligible, lockedDevices)

  const result: WeeklyMenuItem[] = []
  const usedRecipeIds = new Set<number>()
  const selectedCategories: string[] = []
  const selectedDevices: DeviceType[] = []
  const selectedMainInferences: MealBalanceInference[] = []
  const selectedMainRecipes: Recipe[] = []

  for (let day = 0; day < TARGET_DAYS; day++) {
    const dateStr = format(addDays(weekStartDate, day), 'yyyy-MM-dd')

    const lockedRecipeId = lockedMap.get(dateStr)
    if (lockedRecipeId != null) {
      const lockedRecipe = context.mainEligible.find(r => r.id === lockedRecipeId)
      if (lockedRecipe) {
        usedRecipeIds.add(lockedRecipeId)
        selectedCategories.push(lockedRecipe.category)
        selectedDevices.push(lockedRecipe.device)
        const lockedInference = context.byInferenceId.get(lockedRecipeId)
        if (lockedInference) selectedMainInferences.push(lockedInference)
        selectedMainRecipes.push(lockedRecipe)
        result.push({ recipeId: lockedRecipeId, date: dateStr, mealType: 'dinner', locked: true })
        continue
      }
    }

    let bestRecipe: Recipe | null = null
    let bestScore = -Infinity

    for (const { recipe, baseScore } of context.scoredMains) {
      if (usedRecipeIds.has(recipe.id!)) continue
      const candidateInference = context.byInferenceId.get(recipe.id!)
      if (!candidateInference) continue

      let score = computeMainScore({
        recipe,
        baseScore,
        selectedCategories,
        selectedDevices,
        mainDeviceTargets,
        candidateInference,
        selectedMainInferences,
        selectedMainRecipes,
        balanceTier: context.balanceTier.tier,
      })

      const weather = context.weatherByDate.get(dateStr)
      if (weather) {
        // Phase 2: 需要ベクトル × レシピベクトルのドット積でスコアリング
        // スコア識別率: Phase 1 ~35% → Phase 2 ~50%
        const demandVec = computeWeatherDemandVec(weather)
        const recipeVec = computeRecipeWeatherVec(recipe)
        const vecScore = dotProduct(demandVec, recipeVec)
        // Phase 1 スコア（0〜1）を補完的に加算し、ベクトル識別力と組み合わせる
        const comfortScore = computeWeatherComfortScore(recipe, weather)
        score += vecScore * 6 + comfortScore * 2
      }

      const recipeCost = context.recipeCostMap.get(recipe.id!) ?? 0
      if (context.costMode === 'saving') score -= recipeCost / 80
      if (context.costMode === 'luxury') score += (context.luxuryScoreMap.get(recipe.id!) ?? 0) * 8

      if (score > bestScore) {
        bestScore = score
        bestRecipe = recipe
      }
    }

    if (!bestRecipe) continue

    usedRecipeIds.add(bestRecipe.id!)
    selectedCategories.push(bestRecipe.category)
    selectedDevices.push(bestRecipe.device)
    const selectedInference = context.byInferenceId.get(bestRecipe.id!)
    if (selectedInference) selectedMainInferences.push(selectedInference)
    selectedMainRecipes.push(bestRecipe)
    result.push({
      recipeId: bestRecipe.id!,
      date: dateStr,
      mealType: 'dinner',
      locked: false,
    })
  }

  if (context.scoredSides.length > 0) {
    const usedSideIds = new Set<number>()
    const usedSideCategories: string[] = []

    for (const item of result) {
      let bestSide: Recipe | null = null
      let bestSideScore = -Infinity

      const mainInference = context.byInferenceId.get(item.recipeId)
      const mainRecipe = context.byRecipeId.get(item.recipeId)
      if (!mainInference || !mainRecipe) continue

      for (const { recipe, baseScore } of context.scoredSides) {
        if (usedSideIds.has(recipe.id!)) continue
        if (recipe.id === item.recipeId) continue
        const candidateInference = context.byInferenceId.get(recipe.id!)
        if (!candidateInference) continue

        const score = computeSideScore({
          recipe,
          mainRecipe,
          baseScore,
          candidateInference,
          mainInference,
          usedSideCategories,
          balanceTier: context.balanceTier.tier,
        })

        if (score > bestSideScore) {
          bestSideScore = score
          bestSide = recipe
        }
      }

      if (!bestSide) continue
      usedSideIds.add(bestSide.id!)
      usedSideCategories.push(bestSide.category)
      item.sideRecipeId = bestSide.id!
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
  limit = 10,
  role: MealRole = 'main'
): Promise<Recipe[]> {
  const [recipes, stockItems] = await Promise.all([
    db.recipes.limit(200).toArray(),
    db.stock.filter(item => item.inStock).toArray(),
  ])

  const stockNames = new Set(stockItems.map(s => s.name))

  return recipes
    .filter(r => !isHelsioDeli(r) && r.id != null && !excludeIds.has(r.id!))
    .filter(r => isRecipeAllowedForRole(r, role))
    .map(r => ({
      recipe: r,
      matchRate: calculateMatchRate(r.ingredients, stockNames),
    }))
    .sort((a, b) => b.matchRate - a.matchRate)
    .slice(0, limit)
    .map(r => r.recipe)
}
