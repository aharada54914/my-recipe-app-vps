import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../db/db'
import { applyUiRecipeFilters } from '../../utils/recipeFilters'

const RECIPES: Recipe[] = [
  {
    id: 1,
    title: '豚の角煮',
    recipeNumber: 'A-1',
    device: 'hotcook',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 400,
    ingredients: [{ name: '豚肉', quantity: 300, unit: 'g', category: 'main' }],
    steps: [{ name: '煮る', durationMinutes: 40 }],
    totalTimeMinutes: 40,
  },
  {
    id: 2,
    title: '肉団子スープ',
    recipeNumber: 'S-1',
    device: 'healsio',
    category: 'スープ',
    baseServings: 2,
    totalWeightG: 300,
    ingredients: [{ name: '鶏ひき肉', quantity: 200, unit: 'g', category: 'main' }],
    steps: [{ name: '煮る', durationMinutes: 25 }],
    totalTimeMinutes: 25,
  },
]

describe('applyUiRecipeFilters', () => {
  it('keeps category filtering even when keyword-search results are mixed', () => {
    const filtered = applyUiRecipeFilters(RECIPES, {
      category: 'スープ',
      quickFilter: false,
      seasonalFilter: false,
    })

    expect(filtered.map((r) => r.title)).toEqual(['肉団子スープ'])
  })
})
