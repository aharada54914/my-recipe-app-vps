import { describe, expect, it } from 'vitest'
import type {
  CalendarEventRecord,
  Favorite,
  Recipe,
  ViewHistory,
  WeeklyMenu,
} from '../../db/db'
import {
  buildFacetAwareCategoryCounts,
  buildFacetAwareCategoryCountsFromContext,
  buildRecipeCategoryCounts,
  buildRecipeSearchResults,
  buildRecipeSearchResultsFromContext,
  createRecipeSearchStaticContext,
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
    expect(top.preferenceScore).toBeCloseTo(6.82, 2)
    expect(top.stockScore).toBeCloseTo(1.4, 3)
    expect(top.baseScore).toBeGreaterThan(8.21)
    expect(top.baseScore).toBeLessThan(8.24)
    expect(top.finalScore).toBeGreaterThan(10.31)
    expect(top.finalScore).toBeLessThan(10.34)
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

  it('keeps category counts facet-aware while ignoring the active category facet itself', () => {
    expect(buildFacetAwareCategoryCounts(createEmptySearchModelInput({
      recipes: RECIPES,
      stockItems: [],
      searchQuery: '鶏',
      viewHistory: VIEW_HISTORY,
      favorites: FAVORITES,
      weeklyMenus: WEEKLY_MENUS,
      calendarEvents: CALENDAR_EVENTS,
      facets: {
        devices: ['healsio'],
        categories: ['スープ'],
        quick: true,
        seasonal: false,
      },
    }))).toEqual({
      'すべて': 1,
      'スープ': 1,
    })
  })
})

describe('recipe search static context helpers', () => {
  it('produces the same ranked results as the legacy one-shot builder', () => {
    const input = createEmptySearchModelInput({
      recipes: RECIPES,
      stockItems: [{ name: '鶏もも肉' }],
      searchQuery: '鶏',
      viewHistory: VIEW_HISTORY,
      favorites: FAVORITES,
      weeklyMenus: WEEKLY_MENUS,
      calendarEvents: CALENDAR_EVENTS,
      facets: {
        devices: ['hotcook'],
        categories: ['主菜'],
        quick: true,
        seasonal: false,
      },
    })

    const context = createRecipeSearchStaticContext(input)
    const legacyResults = buildRecipeSearchResults(input)
    const splitResults = buildRecipeSearchResultsFromContext(context, input.searchQuery, input.facets)

    expect(splitResults).toEqual(legacyResults)
  })

  it('keeps category counts identical when reusing the static context', () => {
    const input = createEmptySearchModelInput({
      recipes: RECIPES,
      stockItems: [],
      searchQuery: '鶏',
      viewHistory: VIEW_HISTORY,
      favorites: FAVORITES,
      weeklyMenus: WEEKLY_MENUS,
      calendarEvents: CALENDAR_EVENTS,
      facets: {
        devices: ['healsio'],
        categories: ['スープ'],
        quick: true,
        seasonal: false,
      },
    })

    const context = createRecipeSearchStaticContext(input)

    expect(
      buildFacetAwareCategoryCountsFromContext(context, input.searchQuery, input.facets),
    ).toEqual(buildFacetAwareCategoryCounts(input))
  })
})
