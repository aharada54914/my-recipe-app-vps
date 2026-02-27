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
  {
    id: 3,
    title: '肉じゃが副菜',
    recipeNumber: 'B-1',
    device: 'hotcook',
    category: '副菜',
    baseServings: 2,
    totalWeightG: 350,
    ingredients: [{ name: '牛肉', quantity: 150, unit: 'g', category: 'main' }],
    steps: [{ name: '煮る', durationMinutes: 20 }],
    totalTimeMinutes: 20,
  },
]

describe('applyUiRecipeFilters', () => {
  it('filters by a single selected category', () => {
    const filtered = applyUiRecipeFilters(RECIPES, {
      selectedCategories: ['スープ'],
      quickFilter: false,
      seasonalFilter: false,
    })

    expect(filtered.map((r) => r.title)).toEqual(['肉団子スープ'])
  })

  it('supports OR filtering with multiple selected categories', () => {
    const filtered = applyUiRecipeFilters(RECIPES, {
      selectedCategories: ['スープ', '副菜'],
      quickFilter: false,
      seasonalFilter: false,
    })

    expect(filtered.map((r) => r.title)).toEqual(['肉団子スープ', '肉じゃが副菜'])
  })


  it('treats すべて as no category constraint', () => {
    const filtered = applyUiRecipeFilters(RECIPES, {
      selectedCategories: ['すべて'],
      quickFilter: false,
      seasonalFilter: false,
    })

    expect(filtered).toHaveLength(3)
  })

  it('returns all categories when no category is selected', () => {
    const filtered = applyUiRecipeFilters(RECIPES, {
      selectedCategories: [],
      quickFilter: false,
      seasonalFilter: false,
    })

    expect(filtered).toHaveLength(3)
  })
})
