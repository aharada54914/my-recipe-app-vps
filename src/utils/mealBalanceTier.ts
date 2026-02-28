import type { BalanceScoringTier, Recipe, RecipeNutritionPerServing } from '../db/db'
import {
  BALANCE_SCORING_MIN_COVERAGE,
  DEFAULT_BALANCE_SCORING_MODE,
} from '../constants/recipeConstants'

export type BalanceScoringMode = 'auto' | BalanceScoringTier

export interface BalanceTierDecision {
  tier: BalanceScoringTier
  mode: BalanceScoringMode
  totalRecipes: number
  nutrition5Coverage: number
  nutrition7Coverage: number
  reason: string
}

const NUTRITION5_FIELDS: Array<keyof RecipeNutritionPerServing> = [
  'servingSizeG',
  'energyKcal',
  'proteinG',
  'fatG',
  'carbG',
]

const NUTRITION7_EXTRA_FIELDS: Array<keyof RecipeNutritionPerServing> = [
  'fiberG',
  'sugarG',
  'saturatedFatG',
  'potassiumMg',
  'calciumMg',
  'ironMg',
  'vitaminCMg',
]

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isNutrition5Ready(recipe: Recipe): boolean {
  const nutrition = recipe.nutritionPerServing
  if (!nutrition) return false
  for (const field of NUTRITION5_FIELDS) {
    if (!isFiniteNumber(nutrition[field])) return false
  }
  return isFiniteNumber(nutrition.saltEquivalentG) || isFiniteNumber(nutrition.sodiumMg)
}

export function isNutrition7Ready(recipe: Recipe): boolean {
  if (!isNutrition5Ready(recipe)) return false
  const nutrition = recipe.nutritionPerServing
  if (!nutrition) return false
  for (const field of NUTRITION7_EXTRA_FIELDS) {
    if (!isFiniteNumber(nutrition[field])) return false
  }
  return true
}

function resolveTierFromCoverage(nutrition5Coverage: number, nutrition7Coverage: number): BalanceScoringTier {
  if (nutrition7Coverage >= BALANCE_SCORING_MIN_COVERAGE.nutrition7) return 'nutrition-7'
  if (nutrition5Coverage >= BALANCE_SCORING_MIN_COVERAGE.nutrition5) return 'nutrition-5'
  return 'heuristic-3'
}

export function resolveBalanceScoringTier(
  recipes: Recipe[],
  mode: BalanceScoringMode = DEFAULT_BALANCE_SCORING_MODE,
): BalanceTierDecision {
  const totalRecipes = recipes.length
  if (totalRecipes === 0) {
    return {
      tier: 'heuristic-3',
      mode,
      totalRecipes: 0,
      nutrition5Coverage: 0,
      nutrition7Coverage: 0,
      reason: '候補レシピがないため3段階推定を使用',
    }
  }

  let nutrition5ReadyCount = 0
  let nutrition7ReadyCount = 0
  for (const recipe of recipes) {
    if (isNutrition5Ready(recipe)) nutrition5ReadyCount += 1
    if (isNutrition7Ready(recipe)) nutrition7ReadyCount += 1
  }

  const nutrition5Coverage = nutrition5ReadyCount / totalRecipes
  const nutrition7Coverage = nutrition7ReadyCount / totalRecipes

  if (mode === 'heuristic-3') {
    return {
      tier: 'heuristic-3',
      mode,
      totalRecipes,
      nutrition5Coverage,
      nutrition7Coverage,
      reason: '設定で3段階推定を固定',
    }
  }

  if (mode === 'nutrition-5') {
    const tier = nutrition5Coverage >= BALANCE_SCORING_MIN_COVERAGE.nutrition5
      ? 'nutrition-5'
      : 'heuristic-3'
    return {
      tier,
      mode,
      totalRecipes,
      nutrition5Coverage,
      nutrition7Coverage,
      reason: tier === 'nutrition-5'
        ? '5段階栄養列の充足率が基準以上'
        : '5段階栄養列の充足率不足のため3段階へフォールバック',
    }
  }

  if (mode === 'nutrition-7') {
    if (nutrition7Coverage >= BALANCE_SCORING_MIN_COVERAGE.nutrition7) {
      return {
        tier: 'nutrition-7',
        mode,
        totalRecipes,
        nutrition5Coverage,
        nutrition7Coverage,
        reason: '7段階栄養列の充足率が基準以上',
      }
    }
    const fallbackTier = nutrition5Coverage >= BALANCE_SCORING_MIN_COVERAGE.nutrition5
      ? 'nutrition-5'
      : 'heuristic-3'
    return {
      tier: fallbackTier,
      mode,
      totalRecipes,
      nutrition5Coverage,
      nutrition7Coverage,
      reason: fallbackTier === 'nutrition-5'
        ? '7段階充足率不足のため5段階へフォールバック'
        : '7段階/5段階の充足率不足のため3段階へフォールバック',
    }
  }

  const autoTier = resolveTierFromCoverage(nutrition5Coverage, nutrition7Coverage)
  return {
    tier: autoTier,
    mode,
    totalRecipes,
    nutrition5Coverage,
    nutrition7Coverage,
    reason: autoTier === 'nutrition-7'
      ? 'AUTO判定: 7段階充足率を満たす'
      : autoTier === 'nutrition-5'
        ? 'AUTO判定: 5段階充足率を満たす'
        : 'AUTO判定: 栄養列充足率不足のため3段階推定',
  }
}
