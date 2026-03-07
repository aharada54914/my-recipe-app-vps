import { describe, expect, it } from 'vitest'
import type {
  CalendarEventRecord,
  Favorite,
  Recipe,
  ViewHistory,
  WeeklyMenu,
} from '../../db/db'
import {
  buildRecipeCategoryCounts,
  buildRecipeSearchResults,
  createEmptySearchModelInput,
  getRecipeSearchResultIds,
} from '../recipeSearchModel'

function makeRecipe(
  id: number,
  title: string,
  overrides: Partial<Recipe> = {},
): Recipe {
  return {
    id,
    title,
    recipeNumber: `R-${id}`,
    device: 'hotcook',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 400,
    ingredients: [{ name: '鶏もも肉', quantity: 200, unit: 'g', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 20 }],
    totalTimeMinutes: 20,
    ...overrides,
  }
}

const RECIPES: Recipe[] = [
  makeRecipe(1, '鶏もも肉の照り焼き', {
    ingredients: [
      { name: '鶏もも肉', quantity: 300, unit: 'g', category: 'main' },
      { name: 'しょうゆ', quantity: 2, unit: '大さじ', category: 'sub' },
    ],
  }),
  makeRecipe(2, '鶏だんごスープ', {
    category: 'スープ',
    device: 'healsio',
    ingredients: [
      { name: '鶏ひき肉', quantity: 250, unit: 'g', category: 'main' },
      { name: '白菜', quantity: 200, unit: 'g', category: 'main' },
    ],
  }),
  makeRecipe(3, '豚バラ大根', {
    ingredients: [
      { name: '豚バラ肉', quantity: 280, unit: 'g', category: 'main' },
      { name: '大根', quantity: 250, unit: 'g', category: 'main' },
    ],
  }),
  makeRecipe(4, 'かぼちゃスープ', {
    category: 'スープ',
    device: 'manual',
    ingredients: [
      { name: 'かぼちゃ', quantity: 300, unit: 'g', category: 'main' },
      { name: '牛乳', quantity: 200, unit: 'ml', category: 'sub' },
    ],
  }),
]

const VIEW_HISTORY: ViewHistory[] = [
  { id: 1, recipeId: 3, viewedAt: new Date('2026-03-01T10:00:00Z') },
]

const FAVORITES: Favorite[] = [
  { id: 1, recipeId: 3, addedAt: new Date('2026-03-02T10:00:00Z') },
]

const WEEKLY_MENUS: WeeklyMenu[] = []
const CALENDAR_EVENTS: CalendarEventRecord[] = []

describe('buildRecipeSearchResults', () => {
  it('keeps ranking stable for chicken query golden case', () => {
    const results = buildRecipeSearchResults(createEmptySearchModelInput({
      recipes: RECIPES,
      stockItems: [{ name: '鶏もも肉' }],
      searchQuery: '鶏肉',
      viewHistory: VIEW_HISTORY,
      favorites: FAVORITES,
      weeklyMenus: WEEKLY_MENUS,
      calendarEvents: CALENDAR_EVENTS,
    }))

    expect(getRecipeSearchResultIds(results)).toEqual([1, 2])
  })

  it('keeps no-query ranking driven by preference and stock signals', () => {
    const results = buildRecipeSearchResults(createEmptySearchModelInput({
      recipes: RECIPES,
      stockItems: [{ name: '豚バラ肉' }, { name: '大根' }],
      searchQuery: '',
      viewHistory: VIEW_HISTORY,
      favorites: FAVORITES,
      weeklyMenus: WEEKLY_MENUS,
      calendarEvents: CALENDAR_EVENTS,
    }))

    expect(getRecipeSearchResultIds(results).slice(0, 4)).toEqual([3, 1, 2, 4])
  })

  it('returns score breakdown for the top result', () => {
    const [top] = buildRecipeSearchResults(createEmptySearchModelInput({
      recipes: RECIPES,
      stockItems: [{ name: '豚バラ肉' }, { name: '大根' }],
      searchQuery: '',
      viewHistory: VIEW_HISTORY,
      favorites: FAVORITES,
      weeklyMenus: WEEKLY_MENUS,
      calendarEvents: CALENDAR_EVENTS,
    }))

    expect(top.recipe.id).toBe(3)
    expect(top.queryScore).toBe(0.5)
    expect(top.preferenceScore).toBeGreaterThan(6.82)
    expect(top.preferenceScore).toBeLessThan(6.85)
    expect(top.stockScore).toBeCloseTo(1.4, 3)
    expect(top.baseScore).toBeGreaterThan(8.22)
    expect(top.baseScore).toBeLessThan(8.25)
    expect(top.finalScore).toBeGreaterThan(10.33)
    expect(top.finalScore).toBeLessThan(10.35)
  })
})

describe('buildRecipeCategoryCounts', () => {
  it('counts total and category buckets', () => {
    expect(buildRecipeCategoryCounts(RECIPES)).toEqual({
      'すべて': 4,
      '主菜': 2,
      'スープ': 2,
    })
  })
})
