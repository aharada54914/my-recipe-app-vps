import { describe, it, expect } from 'vitest'
import { aggregateIngredients, getMissingWeeklyIngredients, formatWeeklyShoppingList } from '../weeklyShoppingUtils'
import type { Recipe, StockItem } from '../../db/db'

// Minimal recipe factory
function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 1,
    title: 'テストレシピ',
    device: 'hotcook',
    category: '主菜',
    servings: 2,
    ingredients: [],
    steps: [],
    saltContent: null,
    totalTimeMinutes: null,
    imageUrl: null,
    recipeNumber: null,
    sourceUrl: null,
    ...overrides,
  }
}

function makeStock(name: string, inStock = true): StockItem {
  return { id: 1, name, quantity: 1, unit: 'g', inStock, updatedAt: new Date() }
}

// --- aggregateIngredients ---

describe('aggregateIngredients', () => {
  it('merges same ingredient+unit across recipes', () => {
    const recipes = [
      makeRecipe({ ingredients: [{ name: '豚肉', quantity: 200, unit: 'g', category: 'main' }] }),
      makeRecipe({ ingredients: [{ name: '豚肉', quantity: 100, unit: 'g', category: 'main' }] }),
    ]
    const result = aggregateIngredients(recipes, [])
    const meat = result.find(i => i.name === '豚肉')
    expect(meat?.totalQuantity).toBe(300)
    expect(meat?.unit).toBe('g')
  })

  it('does not merge same ingredient with different units', () => {
    const recipes = [
      makeRecipe({ ingredients: [{ name: '醤油', quantity: 2, unit: '大さじ', category: 'sub' }] }),
      makeRecipe({ ingredients: [{ name: '醤油', quantity: 50, unit: 'ml', category: 'sub' }] }),
    ]
    const result = aggregateIngredients(recipes, [])
    expect(result.filter(i => i.name === '醤油')).toHaveLength(2)
  })

  it('deduplicates 適量 entries (only shown once per ingredient)', () => {
    const recipes = [
      makeRecipe({ ingredients: [{ name: '塩', quantity: 0, unit: '適量', category: 'sub' }] }),
      makeRecipe({ ingredients: [{ name: '塩', quantity: 0, unit: '適量', category: 'sub' }] }),
    ]
    const result = aggregateIngredients(recipes, [])
    expect(result.filter(i => i.name === '塩')).toHaveLength(1)
    expect(result[0].unit).toBe('適量')
  })

  it('marks ingredient as inStock when present in stock', () => {
    const recipes = [makeRecipe({ ingredients: [{ name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' }] })]
    const stock = [makeStock('玉ねぎ', true)]
    const result = aggregateIngredients(recipes, stock)
    expect(result[0].inStock).toBe(true)
  })

  it('marks ingredient as not in stock when missing', () => {
    const recipes = [makeRecipe({ ingredients: [{ name: '鶏肉', quantity: 300, unit: 'g', category: 'main' }] })]
    const result = aggregateIngredients(recipes, [])
    expect(result[0].inStock).toBe(false)
  })

  it('sorts main before sub, and not-in-stock before in-stock', () => {
    const recipes = [
      makeRecipe({
        ingredients: [
          { name: '調味料A', quantity: 1, unit: '大さじ', category: 'sub' },
          { name: '主材料B', quantity: 100, unit: 'g', category: 'main' },
        ],
      }),
    ]
    const result = aggregateIngredients(recipes, [])
    expect(result[0].ingredientCategory).toBe('main')
    expect(result[1].ingredientCategory).toBe('sub')
  })

  it('returns empty array for empty recipes', () => {
    expect(aggregateIngredients([], [])).toEqual([])
  })
})

// --- getMissingWeeklyIngredients ---

describe('getMissingWeeklyIngredients', () => {
  it('returns only ingredients not in stock', () => {
    const recipes = [
      makeRecipe({
        ingredients: [
          { name: '豚肉', quantity: 200, unit: 'g', category: 'main' },
          { name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' },
        ],
      }),
    ]
    const stock = [makeStock('玉ねぎ', true)]
    const missing = getMissingWeeklyIngredients(recipes, stock)
    expect(missing).toHaveLength(1)
    expect(missing[0].name).toBe('豚肉')
  })

  it('returns empty array when all ingredients are in stock', () => {
    const recipes = [makeRecipe({ ingredients: [{ name: '豚肉', quantity: 200, unit: 'g', category: 'main' }] })]
    const stock = [makeStock('豚肉', true)]
    expect(getMissingWeeklyIngredients(recipes, stock)).toHaveLength(0)
  })
})

// --- formatWeeklyShoppingList ---

describe('formatWeeklyShoppingList', () => {
  it('returns all-stocked message when no missing items', () => {
    const result = formatWeeklyShoppingList('2026-01-06', [])
    expect(result).toContain('全ての材料が揃っています')
  })

  it('includes week label in output', () => {
    const result = formatWeeklyShoppingList('2026-01-06', [])
    expect(result).toContain('2026-01-06')
  })

  it('lists missing main ingredients under 主材料', () => {
    const items = [
      { name: '豚肉', totalQuantity: 300, unit: 'g', ingredientCategory: 'main' as const, inStock: false },
    ]
    const result = formatWeeklyShoppingList('2026-01-06', items)
    expect(result).toContain('【主材料】')
    expect(result).toContain('豚肉')
  })

  it('lists missing sub ingredients under 調味料・その他', () => {
    const items = [
      { name: '醤油', totalQuantity: 2, unit: '大さじ', ingredientCategory: 'sub' as const, inStock: false },
    ]
    const result = formatWeeklyShoppingList('2026-01-06', items)
    expect(result).toContain('【調味料・その他】')
    expect(result).toContain('醤油')
  })

  it('excludes in-stock items from the output text', () => {
    const items = [
      { name: '玉ねぎ', totalQuantity: 1, unit: '個', ingredientCategory: 'main' as const, inStock: true },
      { name: '豚肉', totalQuantity: 200, unit: 'g', ingredientCategory: 'main' as const, inStock: false },
    ]
    const result = formatWeeklyShoppingList('2026-01-06', items)
    expect(result).toContain('豚肉')
    expect(result).not.toContain('玉ねぎ')
  })
})
