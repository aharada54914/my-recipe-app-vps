import type {
  CalendarEventRecord,
  Favorite,
  Recipe,
  RecipeCategory,
  ViewHistory,
  WeeklyMenu,
} from '../db/db'
import { calculateMatchRate, isHelsioDeli } from './recipeUtils'
import { searchRecipesWithScores } from './searchUtils'
import { buildPreferenceProfile } from './preferenceSignals'
import { computeKitchenAppPreferenceScore } from './preferenceRanker'
import { applyUiRecipeFilters } from './recipeFilters'

export const QUERY_SCORE_WEIGHT = 4.2

export interface BaseRecipeScore {
  matchRate: number
  isDeli: boolean
  preferenceScore: number
  stockScore: number
  baseScore: number
}

export interface RecipeSearchResult {
  recipe: Recipe
  matchRate: number
  isDeli: boolean
  queryScore: number
  preferenceScore: number
  stockScore: number
  baseScore: number
  finalScore: number
}

export interface RecipeSearchModelInput {
  recipes: Recipe[]
  stockItems: Array<{ name: string }>
  viewHistory: ViewHistory[]
  favorites: Favorite[]
  weeklyMenus: WeeklyMenu[]
  calendarEvents: CalendarEventRecord[]
  searchQuery: string
  selectedCategories: RecipeCategory[]
  quickFilter: boolean
  seasonalFilter: boolean
}

export function computeBaseRecipeScore(recipe: Recipe, stockNames: Set<string>, preferenceScore: number): BaseRecipeScore {
  const matchRate = calculateMatchRate(recipe.ingredients, stockNames)
  const stockScore = (matchRate / 100) * 1.4
  const isDeli = isHelsioDeli(recipe)
  const deliPenalty = isDeli ? 2.2 : 0

  return {
    matchRate,
    isDeli,
    preferenceScore,
    stockScore,
    baseScore: preferenceScore + stockScore - deliPenalty,
  }
}

export function buildRecipeSearchResults(input: RecipeSearchModelInput): RecipeSearchResult[] {
  const {
    recipes,
    stockItems,
    viewHistory,
    favorites,
    weeklyMenus,
    calendarEvents,
    searchQuery,
    selectedCategories,
    quickFilter,
    seasonalFilter,
  } = input

  const stockNames = new Set(stockItems.map((item) => item.name))
  const preferenceProfile = buildPreferenceProfile({
    recipes,
    viewHistory,
    favorites,
    weeklyMenus,
    calendarEvents,
  })

  const baseScoreByRecipeId = new Map<number, BaseRecipeScore>()
  for (const recipe of recipes) {
    if (recipe.id == null) continue
    const preferenceScore = computeKitchenAppPreferenceScore(recipe, preferenceProfile)
    baseScoreByRecipeId.set(recipe.id, computeBaseRecipeScore(recipe, stockNames, preferenceScore))
  }

  const scored = searchQuery
    ? searchRecipesWithScores(recipes, searchQuery)
    : recipes.map((recipe) => ({ recipe, queryScore: 0.5 }))

  const filtered = applyUiRecipeFilters(
    scored.map((entry) => entry.recipe),
    { selectedCategories, quickFilter, seasonalFilter },
  )
  const queryScoreById = new Map(scored.map((entry) => [entry.recipe.id!, entry.queryScore]))

  return filtered
    .map((recipe) => {
      const queryScore = queryScoreById.get(recipe.id!) ?? 0.5
      const baseScore = recipe.id != null
        ? baseScoreByRecipeId.get(recipe.id)
        : undefined
      const resolvedScore = baseScore ?? computeBaseRecipeScore(
        recipe,
        stockNames,
        computeKitchenAppPreferenceScore(recipe, preferenceProfile),
      )
      const finalScore = queryScore * QUERY_SCORE_WEIGHT + resolvedScore.baseScore

      return {
        recipe,
        matchRate: resolvedScore.matchRate,
        isDeli: resolvedScore.isDeli,
        queryScore,
        preferenceScore: resolvedScore.preferenceScore,
        stockScore: resolvedScore.stockScore,
        baseScore: resolvedScore.baseScore,
        finalScore,
      }
    })
    .sort((a, b) => {
      if (a.isDeli !== b.isDeli) return a.isDeli ? 1 : -1
      return b.finalScore - a.finalScore
    })
}

export function buildRecipeCategoryCounts(recipes: Recipe[]): Partial<Record<RecipeCategory, number>> {
  const counts: Partial<Record<RecipeCategory, number>> = { 'すべて': recipes.length }
  for (const recipe of recipes) {
    counts[recipe.category] = (counts[recipe.category] ?? 0) + 1
  }
  return counts
}

export function getRecipeSearchResultIds(results: RecipeSearchResult[]): number[] {
  return results.map((entry) => entry.recipe.id!).filter((id): id is number => id != null)
}

export function createEmptySearchModelInput(overrides: Partial<RecipeSearchModelInput> = {}): RecipeSearchModelInput {
  return {
    recipes: [],
    stockItems: [],
    viewHistory: [],
    favorites: [],
    weeklyMenus: [],
    calendarEvents: [],
    searchQuery: '',
    selectedCategories: [],
    quickFilter: false,
    seasonalFilter: false,
    ...overrides,
  }
}
