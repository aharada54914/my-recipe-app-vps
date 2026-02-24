import { describe, it, expect } from 'vitest'
import type { Recipe } from '../../db/db'
import { evaluatePrecisionAtK } from '../searchEvaluation'

const recipes: Recipe[] = [
  {
    id: 1,
    title: '鶏もも肉の照り焼き',
    recipeNumber: '001',
    device: 'hotcook',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 500,
    ingredients: [{ name: '鶏もも肉', quantity: 300, unit: 'g', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 20, isDeviceStep: true }],
    totalTimeMinutes: 20,
  },
  {
    id: 2,
    title: '豚バラ大根',
    recipeNumber: '002',
    device: 'hotcook',
    category: '主菜',
    baseServings: 4,
    totalWeightG: 800,
    ingredients: [{ name: '豚バラ', quantity: 200, unit: 'g', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 30, isDeviceStep: true }],
    totalTimeMinutes: 30,
  },
  {
    id: 3,
    title: 'かぼちゃスープ',
    recipeNumber: '003',
    device: 'healsio',
    category: 'スープ',
    baseServings: 2,
    totalWeightG: 600,
    ingredients: [{ name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 25, isDeviceStep: true }],
    totalTimeMinutes: 25,
  },
]

describe('evaluatePrecisionAtK', () => {
  it('returns precision metrics for adoption decision PoC', () => {
    const result = evaluatePrecisionAtK(recipes, [
      { query: 'とりにく', relevantRecipeIds: [1], k: 3 },
      { query: 'す', relevantRecipeIds: [], k: 3 },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].precisionAtK).toBeGreaterThan(0)
    expect(result[1].precisionAtK).toBe(0)
  })
})
