import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../db/db'
import { applyRecipeFacetFilters } from '../../utils/recipeFilters'
import { createEmptyRecipeSearchFacets } from '../../utils/searchFacets'

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

describe('applyRecipeFacetFilters', () => {
  it('filters by a single selected category', () => {
    const filtered = applyRecipeFacetFilters(RECIPES, {
      ...createEmptyRecipeSearchFacets(),
      categories: ['スープ'],
    })

    expect(filtered.map((recipe) => recipe.title)).toEqual(['肉団子スープ'])
  })

  it('supports OR filtering with multiple categories in the same facet', () => {
    const filtered = applyRecipeFacetFilters(RECIPES, {
      ...createEmptyRecipeSearchFacets(),
      categories: ['スープ', '副菜'],
    })

    expect(filtered.map((recipe) => recipe.title)).toEqual(['肉団子スープ', '肉じゃが副菜'])
  })

  it('applies AND semantics across device, quick, and category facets', () => {
    const filtered = applyRecipeFacetFilters(RECIPES, {
      devices: ['hotcook'],
      categories: ['副菜'],
      quick: true,
      seasonal: false,
    })

    expect(filtered.map((recipe) => recipe.title)).toEqual(['肉じゃが副菜'])
  })

  it('supports OR filtering with multiple devices inside the device facet', () => {
    const filtered = applyRecipeFacetFilters(RECIPES, {
      ...createEmptyRecipeSearchFacets(),
      devices: ['hotcook', 'healsio'],
      quick: true,
    })

    expect(filtered.map((recipe) => recipe.title)).toEqual(['肉団子スープ', '肉じゃが副菜'])
  })
})
