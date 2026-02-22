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

interface SelectionContext {
  scoredMains: ScoredRecipe[]
  scoredSides: ScoredRecipe[]
  mainEligible: Recipe[]
}

const SEASONAL_WEIGHTS: Record<SeasonalPriority, number> = {
  low: 0.5,
  medium: 1.5,
  high: 3.0,
}

const TARGET_DAYS = 7
const DEVICE_BALANCE_BONUS = 12
const DEVICE_OVER_TARGET_PENALTY = 8

const DEVICE_TYPES: DeviceType[] = ['hotcook', 'healsio', 'manual']

type CuisineGenre = 'japanese' | 'western' | 'chinese' | 'other'

function guessGenre(recipe: Recipe): CuisineGenre {
  const text = recipe.title + ' ' + recipe.ingredients.map(i => i.name).join(' ')

  const jpKeywords = ['醤油', 'しょうゆ', '味噌', 'みそ', 'だし', 'みりん', '和風', '照り', '煮', '酒', 'かつお', '昆布', '梅', '大根おろし', '白だし', 'めんつゆ']
  const westernKeywords = ['トマト', 'チーズ', 'オリーブ', 'パスタ', '洋風', 'グラタン', 'シチュー', 'バター', 'ワイン', 'コンソメ', 'ベーコン', 'パン粉', '牛乳']
  const chineseKeywords = ['豆板醤', 'オイスター', '中華', '麻婆', 'ごま油', '鶏ガラスープ', 'オイスターソース', '甜麺醤', '八角', 'ラー油']

  let jpScore = 0; let wsScore = 0; let cnScore = 0
  for (const w of jpKeywords) if (text.includes(w)) jpScore++
  for (const w of westernKeywords) if (text.includes(w)) wsScore++
  for (const w of chineseKeywords) if (text.includes(w)) cnScore++

  if (jpScore > wsScore && jpScore > cnScore) return 'japanese'
  if (wsScore > jpScore && wsScore > cnScore) return 'western'
  if (cnScore > jpScore && cnScore > wsScore) return 'chinese'
  return 'other'
}

function isHeavy(recipe: Recipe): boolean {
  const text = recipe.title + ' ' + recipe.ingredients.map(i => i.name).join(' ')
  const heavyKeywords = ['豚', '牛', '鶏', '肉', '揚げ', 'マヨネーズ', 'チーズ', 'バラ', 'ひき肉', 'カルビ', 'ベーコン', 'ウインナー', 'ソーセージ']
  return heavyKeywords.some(w => text.includes(w))
}

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

    return { recipe, baseScore: score }
  })
}

async function buildSelectionContext(config: MenuSelectionConfig): Promise<SelectionContext> {
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

  const scoredMains = buildScoredRecipes(
    mainEligible,
    stockNames,
    seasonalIngredients,
    seasonalWeight,
    recentMenuRecipeIds,
    recentViewIds,
  ).sort((a, b) => b.baseScore - a.baseScore)

  const scoredSides = buildScoredRecipes(
    sideEligible,
    stockNames,
    seasonalIngredients,
    seasonalWeight,
    recentMenuRecipeIds,
    recentViewIds,
  ).sort((a, b) => b.baseScore - a.baseScore)

  return { scoredMains, scoredSides, mainEligible }
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
  const context = await buildSelectionContext(config)

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

  for (let day = 0; day < TARGET_DAYS; day++) {
    const dateStr = format(addDays(weekStartDate, day), 'yyyy-MM-dd')

    const lockedRecipeId = lockedMap.get(dateStr)
    if (lockedRecipeId != null) {
      const lockedRecipe = context.mainEligible.find(r => r.id === lockedRecipeId)
      if (lockedRecipe) {
        usedRecipeIds.add(lockedRecipeId)
        selectedCategories.push(lockedRecipe.category)
        selectedDevices.push(lockedRecipe.device)
        result.push({ recipeId: lockedRecipeId, date: dateStr, mealType: 'dinner', locked: true })
        continue
      }
    }

    let bestRecipe: Recipe | null = null
    let bestScore = -Infinity

    for (const { recipe, baseScore } of context.scoredMains) {
      if (usedRecipeIds.has(recipe.id!)) continue

      let score = baseScore

      const catCount = selectedCategories.filter(c => c === recipe.category).length
      if (catCount >= 2) score -= (catCount - 1) * 10

      const devCount = selectedDevices.filter(d => d === recipe.device).length
      const devTarget = mainDeviceTargets[recipe.device]
      const deficit = Math.max(0, devTarget - devCount)
      const overTarget = Math.max(0, devCount - devTarget)
      score += deficit * DEVICE_BALANCE_BONUS
      score -= overTarget * DEVICE_OVER_TARGET_PENALTY

      if (selectedDevices.length > 0 && selectedDevices[selectedDevices.length - 1] !== recipe.device) {
        score += 3
      }

      if (score > bestScore) {
        bestScore = score
        bestRecipe = recipe
      }
    }

    if (!bestRecipe) continue

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

  if (context.scoredSides.length > 0) {
    const usedSideIds = new Set<number>()

    for (const item of result) {
      let bestSide: Recipe | null = null
      let bestSideScore = -Infinity

      const mainRecipe = context.mainEligible.find(r => r.id === item.recipeId)
      const mainGenre = mainRecipe ? guessGenre(mainRecipe) : 'other'
      const mainIsHeavy = mainRecipe ? isHeavy(mainRecipe) : false

      for (const { recipe, baseScore } of context.scoredSides) {
        if (usedSideIds.has(recipe.id!)) continue
        if (recipe.id === item.recipeId) continue

        let score = baseScore
        const subCatCount = [...usedSideIds]
          .map(id => context.scoredSides.find(({ recipe: side }) => side.id === id)?.recipe.category ?? '')
          .filter(c => c === recipe.category).length
        if (subCatCount >= 3) score -= (subCatCount - 2) * 8

        const sideGenre = guessGenre(recipe)
        if (mainGenre !== 'other' && sideGenre === mainGenre) score += 15

        const sideIsHeavy = isHeavy(recipe)
        if (mainIsHeavy && !sideIsHeavy) score += 10
        else if (!mainIsHeavy && sideIsHeavy) score += 5
        else if (mainIsHeavy && sideIsHeavy) score -= 10

        if (score > bestSideScore) {
          bestSideScore = score
          bestSide = recipe
        }
      }

      if (!bestSide) continue
      usedSideIds.add(bestSide.id!)
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
