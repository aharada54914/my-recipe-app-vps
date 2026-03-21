import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../db/db'
import { analyzeWeeklyMenuNutrition } from '../weeklyMenuNutritionInsights'

function makeRecipe(id: number, title: string, nutritionPerServing?: Recipe['nutritionPerServing']): Recipe {
  return {
    id,
    title,
    recipeNumber: `R-${id}`,
    device: 'manual',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 500,
    ingredients: [{ name: title, quantity: 1, unit: '個', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 10 }],
    totalTimeMinutes: 10,
    ...(nutritionPerServing ? { nutritionPerServing } : {}),
  }
}

describe('analyzeWeeklyMenuNutrition', () => {
  it('returns heuristic insights when quantitative data is insufficient', () => {
    const result = analyzeWeeklyMenuNutrition([
      makeRecipe(1, '豚バラ炒め'),
      makeRecipe(2, '鶏の唐揚げ'),
      makeRecipe(3, '牛丼'),
      makeRecipe(4, '肉じゃが'),
    ])

    expect(result.tierDecision.tier).toBe('heuristic-3')
    expect(result.gaps.length).toBeGreaterThan(0)
  })

  it('returns nutrition-5 insights with gap messages from numeric data', () => {
    const recipes = Array.from({ length: 7 }, (_, i) => makeRecipe(100 + i, `main-${i}`, {
      servingSizeG: 280,
      energyKcal: 640,
      proteinG: 13,
      fatG: 29,
      carbG: 45,
      saltEquivalentG: 3.4,
    }))
    const sparse = [makeRecipe(200, 'fallback'), makeRecipe(201, 'fallback'), makeRecipe(202, 'fallback')]
    const result = analyzeWeeklyMenuNutrition([...recipes, ...sparse])

    expect(result.tierDecision.tier).toBe('nutrition-5')
    expect(result.gaps.some((gap) => gap.includes('たんぱく質'))).toBe(true)
    expect(result.gaps.some((gap) => gap.includes('食塩相当量'))).toBe(true)
  })
})
