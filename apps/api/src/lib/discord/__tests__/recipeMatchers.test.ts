import { describe, expect, it } from 'vitest'
import {
  buildPhotoRecipeCandidates,
  buildWeeklyMenuDayScore,
  extractIngredientNames,
  type RecipeRecordLite,
} from '../recipeMatchers.js'

function makeRecipe(overrides: Partial<RecipeRecordLite> = {}): RecipeRecordLite {
  return {
    id: 1,
    title: '鶏のトマト煮',
    device: 'hotcook',
    category: '主菜',
    baseServings: 2,
    ingredients: [
      { name: '鶏もも肉' },
      { name: 'トマト' },
      { name: '玉ねぎ' },
    ],
    ...overrides,
  }
}

describe('extractIngredientNames', () => {
  it('returns names from array ingredients', () => {
    expect(extractIngredientNames([
      { name: '玉ねぎ' },
      { name: 'にんじん' },
    ])).toEqual(['玉ねぎ', 'にんじん'])
  })

  it('ignores empty and non-string ingredient names', () => {
    expect(extractIngredientNames([
      { name: '  ' },
      { name: 123 },
      { unknown: 'ignored' },
      { name: '卵' },
    ])).toEqual(['卵'])
  })

  it('returns an empty array for non-array values', () => {
    expect(extractIngredientNames({ name: '玉ねぎ' })).toEqual([])
  })
})

describe('buildPhotoRecipeCandidates', () => {
  it('keeps only recipes with at least one matched ingredient', () => {
    const candidates = buildPhotoRecipeCandidates({
      recipes: [
        makeRecipe(),
        makeRecipe({
          id: 2,
          title: '豚汁',
          ingredients: [{ name: '大根' }, { name: '豚こま肉' }],
        }),
      ],
      requestedServings: 4,
      availableIngredients: ['鶏もも肉', '玉ねぎ'],
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.recipeId).toBe(1)
  })

  it('normalizes whitespace and casing while matching ingredients', () => {
    const candidates = buildPhotoRecipeCandidates({
      recipes: [makeRecipe()],
      requestedServings: 3,
      availableIngredients: ['  トマト  ', '鶏もも肉'],
    })

    expect(candidates[0]?.matchedIngredients).toEqual(['鶏もも肉', 'トマト'])
  })

  it('excludes recipe ids that the caller wants to skip', () => {
    const candidates = buildPhotoRecipeCandidates({
      recipes: [makeRecipe(), makeRecipe({ id: 2, title: '鶏と玉ねぎの炒め物' })],
      requestedServings: 2,
      availableIngredients: ['鶏もも肉', '玉ねぎ'],
      excludeRecipeIds: [1],
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.recipeId).toBe(2)
  })

  it('limits the result list to three candidates', () => {
    const recipes = Array.from({ length: 5 }, (_, index) => makeRecipe({
      id: index + 1,
      title: `候補${index + 1}`,
    }))

    const candidates = buildPhotoRecipeCandidates({
      recipes,
      requestedServings: 2,
      availableIngredients: ['鶏もも肉', 'トマト', '玉ねぎ'],
    })

    expect(candidates).toHaveLength(3)
  })

  it('surfaces missing ingredients for partial matches', () => {
    const candidates = buildPhotoRecipeCandidates({
      recipes: [makeRecipe()],
      requestedServings: 2,
      availableIngredients: ['鶏もも肉'],
    })

    expect(candidates[0]?.missingIngredients).toEqual(['トマト', '玉ねぎ'])
  })

  it('prefers recipes with more matched ingredients', () => {
    const candidates = buildPhotoRecipeCandidates({
      recipes: [
        makeRecipe({ id: 1, title: '完全一致レシピ' }),
        makeRecipe({
          id: 2,
          title: '部分一致レシピ',
          ingredients: [{ name: '鶏もも肉' }, { name: 'セロリ' }, { name: 'パセリ' }],
        }),
      ],
      requestedServings: 2,
      availableIngredients: ['鶏もも肉', 'トマト', '玉ねぎ'],
    })

    expect(candidates[0]?.recipeId).toBe(1)
    expect(candidates[0]?.score).toBeGreaterThan(candidates[1]?.score ?? 0)
  })
})

describe('buildWeeklyMenuDayScore', () => {
  it('rewards warm dishes on rainy and cold days', () => {
    const warmScore = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ title: 'チキンスープ', device: 'hotcook' }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '雨',
      maxTempC: 10,
      precipitationMm: 12,
      dayIndex: 0,
    })
    const lightScore = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ title: '冷やしサラダ', device: 'manual' }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '雨',
      maxTempC: 10,
      precipitationMm: 12,
      dayIndex: 0,
    })

    expect(warmScore).toBeGreaterThan(lightScore)
  })

  it('rewards lighter dishes on hot sunny days', () => {
    const lightScore = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ title: '冷しゃぶサラダ', device: 'healsio' }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '晴れ',
      maxTempC: 31,
      precipitationMm: 0,
      dayIndex: 0,
    })
    const heavyScore = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ title: '濃厚カレー', device: 'manual' }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '晴れ',
      maxTempC: 31,
      precipitationMm: 0,
      dayIndex: 0,
    })

    expect(lightScore).toBeGreaterThan(heavyScore)
  })

  it('applies a large penalty to duplicate recipe ids', () => {
    const uniqueScore = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ id: 1 }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '曇り',
      maxTempC: 20,
      precipitationMm: 0,
      dayIndex: 1,
    })
    const duplicateScore = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ id: 1 }),
      selectedRecipeIds: new Set<number>([1]),
      weatherText: '曇り',
      maxTempC: 20,
      precipitationMm: 0,
      dayIndex: 1,
    })

    expect(uniqueScore - duplicateScore).toBeGreaterThanOrEqual(100)
  })

  it('applies a penalty when replacement notes mention the same title keyword', () => {
    const withoutNotePenalty = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ title: 'さっぱり蒸し鶏' }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '晴れ',
      maxTempC: 26,
      precipitationMm: 0,
      dayIndex: 2,
    })
    const withNotePenalty = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ title: 'さっぱり蒸し鶏' }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '晴れ',
      maxTempC: 26,
      precipitationMm: 0,
      dayIndex: 2,
      notes: 'さっぱり',
    })

    expect(withNotePenalty).toBeLessThan(withoutNotePenalty)
  })

  it('favors main dishes over dessert in weekly selection', () => {
    const mainDishScore = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ category: '主菜', title: '煮込みハンバーグ' }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '曇り',
      maxTempC: 18,
      precipitationMm: 1,
      dayIndex: 3,
    })
    const dessertScore = buildWeeklyMenuDayScore({
      recipe: makeRecipe({ category: 'スイーツ', title: 'プリン' }),
      selectedRecipeIds: new Set<number>(),
      weatherText: '曇り',
      maxTempC: 18,
      precipitationMm: 1,
      dayIndex: 3,
    })

    expect(mainDishScore).toBeGreaterThan(dessertScore)
  })
})
