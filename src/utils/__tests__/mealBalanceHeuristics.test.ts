import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../db/db'
import { inferMealBalance } from '../mealBalanceHeuristics'

function makeRecipe(title: string, ingredients: string[], category: Recipe['category'] = '主菜'): Recipe {
  return {
    id: 1,
    title,
    recipeNumber: 'T-001',
    device: 'manual',
    category,
    baseServings: 2,
    totalWeightG: 500,
    ingredients: ingredients.map((name) => ({ name, quantity: 1, unit: '個', category: 'main' })),
    steps: [{ name: '調理', durationMinutes: 10 }],
    totalTimeMinutes: 10,
  }
}

describe('inferMealBalance', () => {
  it('infers nutrition and primary ingredient tags from keywords', () => {
    const recipe = makeRecipe('鶏肉とブロッコリー炒め', ['鶏もも肉', 'ブロッコリー', '玉ねぎ'])
    const inferred = inferMealBalance(recipe)

    expect(inferred.nutrition.protein).toBeGreaterThanOrEqual(1)
    expect(inferred.nutrition.vegetable).toBeGreaterThanOrEqual(1)
    expect(inferred.primaryIngredients).toContain('chicken')
  })

  it('infers soup-like signal and dominant colors', () => {
    const recipe = makeRecipe('鮭とほうれん草の味噌汁', ['鮭', 'ほうれん草', '味噌'], 'スープ')
    const inferred = inferMealBalance(recipe)

    expect(inferred.nutrition.soupLike).toBeGreaterThan(0)
    expect(inferred.dominantColors).toContain('green')
    expect(inferred.primaryIngredients).toContain('fish')
  })

  it('infers genre and heavy flag from recipe text', () => {
    const recipe = makeRecipe('豚バラのオイスター炒め', ['豚バラ肉', 'オイスターソース', 'ねぎ'])
    const inferred = inferMealBalance(recipe)

    expect(inferred.genre).toBe('chinese')
    expect(inferred.isHeavy).toBe(true)
  })
})
