import { describe, it, expect } from 'vitest'
import { searchRecipes } from '../searchUtils'
import { expandSynonyms } from '../../data/synonyms'
import type { Recipe } from '../../db/db'

const mockRecipes: Recipe[] = [
  {
    id: 1,
    title: '鶏もも肉の照り焼き',
    recipeNumber: '001',
    device: 'hotcook',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 500,
    ingredients: [
      { name: '鶏もも肉', quantity: 300, unit: 'g', category: 'main' },
      { name: '醤油', quantity: 2, unit: '大さじ', category: 'sub' },
      { name: 'みりん', quantity: 2, unit: '大さじ', category: 'sub' },
    ],
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
    ingredients: [
      { name: '豚バラ', quantity: 200, unit: 'g', category: 'main' },
      { name: '大根', quantity: 300, unit: 'g', category: 'main' },
      { name: '醤油', quantity: 1, unit: '大さじ', category: 'sub' },
    ],
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
    ingredients: [
      { name: 'かぼちゃ', quantity: 300, unit: 'g', category: 'main' },
      { name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' },
      { name: '牛乳', quantity: 200, unit: 'ml', category: 'sub' },
    ],
    steps: [{ name: '調理', durationMinutes: 25, isDeviceStep: true }],
    totalTimeMinutes: 25,
  },
]

describe('searchRecipes', () => {
  it('returns all recipes for empty query', () => {
    const result = searchRecipes(mockRecipes, '')
    expect(result).toHaveLength(3)
  })

  it('returns matching recipes by title', () => {
    const result = searchRecipes(mockRecipes, '照り焼き')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].title).toContain('照り焼き')
  })

  it('finds recipes via synonym expansion (とり肉 → 鶏もも肉)', () => {
    const result = searchRecipes(mockRecipes, 'とり肉')
    expect(result.length).toBeGreaterThanOrEqual(1)
    const titles = result.map((r) => r.title)
    expect(titles).toContain('鶏もも肉の照り焼き')
  })

  it('deduplicates results (same recipe does not appear multiple times)', () => {
    const result = searchRecipes(mockRecipes, '鶏肉')
    const ids = result.map((r) => r.id)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
  })

  it('returns results sorted by score', () => {
    // Direct title match should rank higher
    const result = searchRecipes(mockRecipes, 'スープ')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].title).toContain('スープ')
  })

  it('finds recipes by ingredient name', () => {
    const result = searchRecipes(mockRecipes, '大根')
    expect(result.length).toBeGreaterThanOrEqual(1)
    const titles = result.map((r) => r.title)
    expect(titles).toContain('豚バラ大根')
  })

  it('returns empty array for no matches', () => {
    const result = searchRecipes(mockRecipes, 'ラーメン')
    expect(result).toHaveLength(0)
  })
})

describe('expandSynonyms', () => {
  it('expands とり肉 to include chicken synonyms', () => {
    const result = expandSynonyms('とり肉')
    expect(result).toContain('とり肉')
    expect(result).toContain('鶏肉')
    expect(result).toContain('鶏もも肉')
  })

  it('returns at least the original query for unknown terms', () => {
    const result = expandSynonyms('ラーメン')
    expect(result).toContain('ラーメン')
    expect(result).toHaveLength(1)
  })
})
