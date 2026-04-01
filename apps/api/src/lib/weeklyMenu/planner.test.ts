import { describe, expect, it } from 'vitest'
import { USER_PREFERENCES_DEFAULTS } from '@kitchen/shared-types'
import { buildWeeklyMenuProposalItems, type PlannerForecastDay, type PlannerRecipeRecord } from './planner.js'

const FORECAST: PlannerForecastDay[] = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-03-${String(16 + index).padStart(2, '0')}`,
  weatherText: index % 2 === 0 ? '雨' : '晴れ',
  maxTempC: index % 2 === 0 ? 12 : 24,
  precipitationMm: index % 2 === 0 ? 8 : 0,
}))

const RECIPES: PlannerRecipeRecord[] = [
  {
    id: 1,
    title: '鶏もも肉のトマト煮込み',
    device: 'hotcook',
    category: '主菜',
    baseServings: 2,
    totalTimeMinutes: 40,
    ingredients: [{ name: '鶏もも肉' }, { name: 'トマト缶' }],
  },
  {
    id: 2,
    title: '鮭ときのこのホイル焼き',
    device: 'healsio',
    category: '主菜',
    baseServings: 2,
    totalTimeMinutes: 28,
    ingredients: [{ name: '鮭' }, { name: 'きのこ' }],
  },
  {
    id: 3,
    title: '豚しゃぶサラダ',
    device: 'manual',
    category: '一品料理',
    baseServings: 2,
    totalTimeMinutes: 18,
    ingredients: [{ name: '豚肉' }, { name: 'レタス' }],
  },
  {
    id: 4,
    title: '豆腐ハンバーグ',
    device: 'manual',
    category: '主菜',
    baseServings: 2,
    totalTimeMinutes: 25,
    ingredients: [{ name: '豆腐' }, { name: '鶏ひき肉' }],
  },
  {
    id: 5,
    title: '牛肉のすき煮',
    device: 'hotcook',
    category: '主菜',
    baseServings: 2,
    totalTimeMinutes: 35,
    ingredients: [{ name: '牛肉' }, { name: 'ねぎ' }],
  },
  {
    id: 6,
    title: 'ほうれん草のおひたし',
    device: 'manual',
    category: '副菜',
    baseServings: 2,
    totalTimeMinutes: 10,
    ingredients: [{ name: 'ほうれん草' }],
  },
  {
    id: 7,
    title: 'ミネストローネ',
    device: 'hotcook',
    category: 'スープ',
    baseServings: 4,
    totalTimeMinutes: 20,
    ingredients: [{ name: 'トマト缶' }, { name: 'にんじん' }],
  },
]

describe('buildWeeklyMenuProposalItems', () => {
  it('avoids repeating the same main recipe across the week when enough candidates exist', () => {
    const items = buildWeeklyMenuProposalItems({
      recipes: RECIPES,
      forecastDays: FORECAST,
      requestedServings: 3,
      preferences: { ...USER_PREFERENCES_DEFAULTS, updatedAt: new Date() },
      stockNames: new Set(['鶏もも肉', 'トマト缶', '豆腐']),
      expiringStockNames: new Set(['豆腐']),
      recentRecipeIds: new Set<number>(),
      favoriteRecipeIds: new Set<number>([4]),
    })

    expect(new Set(items.map((item) => item.recipeId)).size).toBe(5)
    expect(items.filter((item) => item.sideRecipeId != null).length).toBeGreaterThanOrEqual(2)
    expect(items.every((item) => item.mainCandidates.length >= 1)).toBe(true)
    expect(items.some((item) => item.mainCandidates.length >= 2)).toBe(true)
  })

  it('respects globally excluded recipes when rebuilding a day', () => {
    const initial = buildWeeklyMenuProposalItems({
      recipes: RECIPES,
      forecastDays: FORECAST,
      requestedServings: 3,
      preferences: { ...USER_PREFERENCES_DEFAULTS, updatedAt: new Date() },
      stockNames: new Set(['鶏もも肉', 'トマト缶', '豆腐']),
      expiringStockNames: new Set(['豆腐']),
      recentRecipeIds: new Set<number>(),
      favoriteRecipeIds: new Set<number>([4]),
    })

    const excludedRecipeId = initial[0]?.recipeId
    const rebuilt = buildWeeklyMenuProposalItems({
      recipes: RECIPES,
      forecastDays: FORECAST,
      requestedServings: 3,
      preferences: { ...USER_PREFERENCES_DEFAULTS, updatedAt: new Date() },
      stockNames: new Set(['鶏もも肉', 'トマト缶', '豆腐']),
      expiringStockNames: new Set(['豆腐']),
      recentRecipeIds: new Set<number>(),
      favoriteRecipeIds: new Set<number>([4]),
      existingItems: initial,
      replaceDayIndex: 0,
      globalExcludedRecipeIds: new Set<number>([excludedRecipeId]),
    })

    expect(rebuilt[0]?.recipeId).not.toBe(excludedRecipeId)
    expect(rebuilt[0]?.excludedRecipeIds).toContain(excludedRecipeId)
  })

  it('prioritizes fish recipes when fish_more preset is requested', () => {
    const items = buildWeeklyMenuProposalItems({
      recipes: RECIPES,
      forecastDays: FORECAST,
      requestedServings: 3,
      preferences: { ...USER_PREFERENCES_DEFAULTS, updatedAt: new Date() },
      stockNames: new Set(['鮭', 'きのこ']),
      expiringStockNames: new Set<string>(),
      recentRecipeIds: new Set<number>(),
      favoriteRecipeIds: new Set<number>(),
      preset: 'fish_more',
    })

    expect(items[0]?.mainCandidates[0]?.proteinGroup).toBe('fish')
    expect(items.some((item) => item.recipeTitle.includes('鮭'))).toBe(true)
  })

  it('can avoid the same main protein when rebuilding a day', () => {
    const initial = buildWeeklyMenuProposalItems({
      recipes: RECIPES,
      forecastDays: FORECAST,
      requestedServings: 3,
      preferences: { ...USER_PREFERENCES_DEFAULTS, updatedAt: new Date() },
      stockNames: new Set(['鶏もも肉', 'トマト缶', '豆腐']),
      expiringStockNames: new Set<string>(),
      recentRecipeIds: new Set<number>(),
      favoriteRecipeIds: new Set<number>(),
    })

    const rebuilt = buildWeeklyMenuProposalItems({
      recipes: RECIPES,
      forecastDays: FORECAST,
      requestedServings: 3,
      preferences: { ...USER_PREFERENCES_DEFAULTS, updatedAt: new Date() },
      stockNames: new Set(['鶏もも肉', 'トマト缶', '豆腐']),
      expiringStockNames: new Set<string>(),
      recentRecipeIds: new Set<number>(),
      favoriteRecipeIds: new Set<number>(),
      existingItems: initial,
      replaceDayIndex: 0,
      replaceTarget: 'main',
      avoidProteinGroups: new Set([initial[0]?.mainCandidates[0]?.proteinGroup]),
    })

    expect(rebuilt[0]?.mainCandidates[rebuilt[0]?.currentMainCandidateIndex ?? 0]?.proteinGroup).not.toBe(
      initial[0]?.mainCandidates[0]?.proteinGroup,
    )
  })
})
