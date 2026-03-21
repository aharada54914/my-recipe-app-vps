import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../db/db'
import {
  isNutrition5Ready,
  isNutrition7Ready,
  resolveBalanceScoringTier,
} from '../mealBalanceTier'

function makeRecipe(id: number, withNutrition?: Partial<NonNullable<Recipe['nutritionPerServing']>>): Recipe {
  return {
    id,
    title: `recipe-${id}`,
    recipeNumber: `R-${id}`,
    device: 'manual',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 500,
    ingredients: [{ name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 10 }],
    totalTimeMinutes: 10,
    ...(withNutrition ? { nutritionPerServing: withNutrition } : {}),
  }
}

const N5_BASE = {
  servingSizeG: 300,
  energyKcal: 500,
  proteinG: 25,
  fatG: 20,
  carbG: 50,
  saltEquivalentG: 2.3,
}

const N7_EXTRA = {
  fiberG: 6,
  sugarG: 8,
  saturatedFatG: 5,
  potassiumMg: 800,
  calciumMg: 180,
  ironMg: 2.3,
  vitaminCMg: 35,
}

describe('mealBalanceTier', () => {
  it('detects nutrition5 readiness with minimum required fields', () => {
    const ready = makeRecipe(1, N5_BASE)
    const notReady = makeRecipe(2, { energyKcal: 100 })

    expect(isNutrition5Ready(ready)).toBe(true)
    expect(isNutrition5Ready(notReady)).toBe(false)
  })

  it('detects nutrition7 readiness only when extra fields are present', () => {
    const n5Only = makeRecipe(1, N5_BASE)
    const n7Ready = makeRecipe(2, { ...N5_BASE, ...N7_EXTRA })

    expect(isNutrition7Ready(n5Only)).toBe(false)
    expect(isNutrition7Ready(n7Ready)).toBe(true)
  })

  it('resolves auto tier by coverage thresholds', () => {
    const recipes = [
      makeRecipe(1, { ...N5_BASE, ...N7_EXTRA }),
      makeRecipe(2, { ...N5_BASE, ...N7_EXTRA }),
      makeRecipe(3, { ...N5_BASE, ...N7_EXTRA }),
      makeRecipe(4, { ...N5_BASE, ...N7_EXTRA }),
      makeRecipe(5, N5_BASE),
      makeRecipe(6, N5_BASE),
      makeRecipe(7, N5_BASE),
      makeRecipe(8),
      makeRecipe(9),
      makeRecipe(10),
    ]

    const decision = resolveBalanceScoringTier(recipes, 'auto')
    expect(decision.tier).toBe('nutrition-5')
  })

  it('falls back when requested tier lacks enough coverage', () => {
    const recipes = [
      makeRecipe(1, N5_BASE),
      makeRecipe(2, N5_BASE),
      makeRecipe(3, N5_BASE),
      makeRecipe(4),
      makeRecipe(5),
    ]

    const decision = resolveBalanceScoringTier(recipes, 'nutrition-7')
    expect(decision.tier).toBe('heuristic-3')
  })
})
