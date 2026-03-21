import type { Recipe } from '../db/db'
import type { BalanceTierDecision } from './mealBalanceTier'
import { resolveBalanceScoringTier } from './mealBalanceTier'
import { inferMealBalance } from './mealBalanceHeuristics'

export interface WeeklyMenuNutritionInsights {
  tierDecision: BalanceTierDecision
  gaps: string[]
  highlights: string[]
}

function sodiumToSaltEquivalentG(sodiumMg: number): number {
  return (sodiumMg * 2.54) / 1000
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatPercent(value: number): number {
  return Math.round(value * 100)
}

export function analyzeWeeklyMenuNutrition(recipes: Recipe[]): WeeklyMenuNutritionInsights {
  const tierDecision = resolveBalanceScoringTier(recipes, 'auto')
  const gaps: string[] = []
  const highlights: string[] = []

  if (recipes.length === 0) {
    return { tierDecision, gaps: ['献立が未生成です'], highlights }
  }

  if (tierDecision.tier === 'heuristic-3') {
    const inferred = recipes.map((recipe) => inferMealBalance(recipe))
    const vegRichCount = inferred.filter((entry) => entry.nutrition.vegetable >= 1).length
    const heavyCount = inferred.filter((entry) => entry.isHeavy).length
    const soupLikeCount = inferred.filter((entry) => entry.nutrition.soupLike >= 1).length

    if (vegRichCount / inferred.length < 0.4) gaps.push('野菜系メニューが少なめです')
    if (heavyCount / inferred.length > 0.5) gaps.push('重めのメニュー比率が高めです')
    if (soupLikeCount < 2) gaps.push('汁物系メニューが少なめです')

    if (vegRichCount / inferred.length >= 0.5) highlights.push('野菜系メニューの比率は良好です')
    if (heavyCount / inferred.length <= 0.4) highlights.push('重いメニューの連続が抑えられています')

    if (gaps.length === 0) gaps.push('大きな偏りは検出されませんでした')
    return { tierDecision, gaps, highlights }
  }

  const nutritions = recipes
    .map((recipe) => recipe.nutritionPerServing)
    .filter((nutrition): nutrition is NonNullable<Recipe['nutritionPerServing']> => Boolean(nutrition))

  const proteinAvg = average(nutritions.map((n) => n.proteinG).filter((v): v is number => typeof v === 'number'))
  const fatAvg = average(nutritions.map((n) => n.fatG).filter((v): v is number => typeof v === 'number'))
  const saltAvg = average(nutritions
    .map((n) => {
      if (typeof n.saltEquivalentG === 'number') return n.saltEquivalentG
      if (typeof n.sodiumMg === 'number') return sodiumToSaltEquivalentG(n.sodiumMg)
      return undefined
    })
    .filter((v): v is number => typeof v === 'number'))
  const fiberAvg = average(nutritions.map((n) => n.fiberG).filter((v): v is number => typeof v === 'number'))
  const satFatAvg = average(nutritions.map((n) => n.saturatedFatG).filter((v): v is number => typeof v === 'number'))

  if (typeof proteinAvg === 'number' && proteinAvg < 16) gaps.push('平均たんぱく質が低めです')
  if (typeof fatAvg === 'number' && fatAvg > 24) gaps.push('平均脂質が高めです')
  if (typeof saltAvg === 'number' && saltAvg > 3) gaps.push('平均食塩相当量が高めです')

  if (tierDecision.tier === 'nutrition-7') {
    if (typeof fiberAvg === 'number' && fiberAvg < 4) gaps.push('平均食物繊維が不足気味です')
    if (typeof satFatAvg === 'number' && satFatAvg > 7) gaps.push('平均飽和脂肪酸が高めです')
  }

  if (typeof proteinAvg === 'number' && proteinAvg >= 20) highlights.push('平均たんぱく質は良好です')
  if (typeof saltAvg === 'number' && saltAvg <= 2.5) highlights.push('食塩相当量は抑えられています')
  if (tierDecision.tier === 'nutrition-7' && typeof fiberAvg === 'number' && fiberAvg >= 5) highlights.push('食物繊維は十分確保できています')

  if (gaps.length === 0) gaps.push('大きな偏りは検出されませんでした')

  if (nutritions.length < recipes.length) {
    gaps.push(`栄養データ不足: ${recipes.length - nutritions.length}品 (${100 - formatPercent(nutritions.length / recipes.length)}%)`)
  }

  return { tierDecision, gaps, highlights }
}
