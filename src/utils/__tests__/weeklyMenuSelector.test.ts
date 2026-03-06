import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRecipesToArray } = vi.hoisted(() => ({
  mockRecipesToArray: vi.fn<() => Promise<import('../../db/db').Recipe[]>>(),
}))

vi.mock('../../db/db', () => {
  const mockPrimaryKeys = vi.fn(async () => {
    const recipes = await mockRecipesToArray()
    return recipes.map((r) => r.id!)
  })
  const mockBulkGet = vi.fn(async (ids: number[]) => {
    const recipes = await mockRecipesToArray()
    return ids.map((id) => recipes.find((r) => r.id === id))
  })
  return {
    db: {
      recipes: {
        toArray: mockRecipesToArray,
        limit: vi.fn(() => ({ toArray: vi.fn(() => []) })),
        orderBy: vi.fn(() => ({ primaryKeys: mockPrimaryKeys })),
        bulkGet: mockBulkGet,
      },
      stock: { filter: vi.fn(() => ({ toArray: vi.fn(() => []) })) },
      weeklyMenus: { orderBy: vi.fn(() => ({ reverse: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })) },
      viewHistory: { orderBy: vi.fn(() => ({ reverse: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })) },
      userPreferences: { limit: vi.fn(() => ({ first: vi.fn(() => Promise.resolve(undefined)) })) },
      recipeFeatureMatrix: { bulkPut: vi.fn(() => Promise.resolve()), bulkGet: vi.fn(() => Promise.resolve([])) },
    },
  }
})

vi.mock('../../data/seasonalIngredients', () => ({
  getCurrentSeasonalIngredients: vi.fn(() => []),
}))


const { mockGetWeeklyWeatherForecast } = vi.hoisted(() => ({
  mockGetWeeklyWeatherForecast: vi.fn(),
}))

vi.mock('../season-weather/weatherProvider', () => ({
  getWeeklyWeatherForecast: mockGetWeeklyWeatherForecast,
}))
import { getWeekStartDate, selectWeeklyMenu } from '../weeklyMenuSelector'
import type { Recipe } from '../../db/db'

function makeRecipe(
  id: number,
  device: Recipe['device'],
  category: Recipe['category'] = '主菜',
  title?: string,
  ingredients?: string[],
): Recipe {
  return {
    id,
    title: title ?? `${device}-${id}`,
    recipeNumber: `R-${id}`,
    device,
    category,
    baseServings: 2,
    totalWeightG: 500,
    ingredients: (ingredients ?? ['玉ねぎ']).map((name) => ({ name, quantity: 1, unit: '個', category: 'main' })),
    steps: [{ name: '調理', durationMinutes: 10 }],
    totalTimeMinutes: 10,
  }
}

describe('getWeekStartDate', () => {
  it('returns the Sunday of the current week for a Sunday', () => {
    const sunday = new Date('2026-01-04T12:00:00')
    const result = getWeekStartDate(sunday)
    expect(result.getDay()).toBe(0)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(4)
  })

  it('returns the preceding Sunday for a midweek date', () => {
    const wednesday = new Date('2026-01-07T10:00:00')
    const result = getWeekStartDate(wednesday)
    expect(result.getDay()).toBe(0)
    expect(result.getDate()).toBe(4)
  })

  it('returns the preceding Sunday for a Saturday', () => {
    const saturday = new Date('2026-01-10T23:00:00')
    const result = getWeekStartDate(saturday)
    expect(result.getDay()).toBe(0)
    expect(result.getDate()).toBe(4)
  })

  it('sets time to midnight', () => {
    const date = new Date('2026-01-07T15:30:00')
    const result = getWeekStartDate(date)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it('does not mutate the original date', () => {
    const date = new Date('2026-01-07T10:00:00')
    const original = date.getTime()
    getWeekStartDate(date)
    expect(date.getTime()).toBe(original)
  })


})

describe('selectWeeklyMenu device balance', () => {
  beforeEach(() => {
    mockRecipesToArray.mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(0.9999)
    mockGetWeeklyWeatherForecast.mockReset()
    mockGetWeeklyWeatherForecast.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps hotcook in the weekly main dishes even when healsio candidates are dominant', async () => {
    const mains: Recipe[] = [
      ...Array.from({ length: 3 }, (_, i) => makeRecipe(i + 1, 'hotcook')),
      ...Array.from({ length: 18 }, (_, i) => makeRecipe(i + 101, 'healsio')),
    ]
    const sides: Recipe[] = Array.from({ length: 8 }, (_, i) => makeRecipe(i + 201, 'healsio', '副菜'))

    mockRecipesToArray.mockResolvedValue([...mains, ...sides])

    const menu = await selectWeeklyMenu(new Date('2026-02-22'), {
      seasonalPriority: 'medium',
      userPrompt: '',
      desiredMealHour: 18,
      desiredMealMinute: 0,
    })

    const selectedMainIds = menu.map((item) => item.recipeId)
    const selectedMains = mains.filter((recipe) => selectedMainIds.includes(recipe.id!))
    const hotcookCount = selectedMains.filter((recipe) => recipe.device === 'hotcook').length

    expect(menu).toHaveLength(7)
    expect(hotcookCount).toBeGreaterThan(0)
  })

  it('avoids repeating the same primary ingredient right after a locked day when alternatives exist', async () => {
    const porkMains = Array.from(
      { length: 6 },
      (_, i) => makeRecipe(i + 1, 'manual', '主菜', `豚肉メイン${i + 1}`, ['豚肉', '玉ねぎ'])
    )
    const fishMains = Array.from(
      { length: 6 },
      (_, i) => makeRecipe(i + 101, 'manual', '主菜', `鮭メイン${i + 1}`, ['鮭', '大根'])
    )

    mockRecipesToArray.mockResolvedValue([...porkMains, ...fishMains])

    const menu = await selectWeeklyMenu(new Date('2026-02-22'), {
      seasonalPriority: 'medium',
      userPrompt: '',
      desiredMealHour: 18,
      desiredMealMinute: 0,
    }, [
      { recipeId: porkMains[0].id!, date: '2026-02-22', mealType: 'dinner', locked: true },
    ])

    const secondDayMain = [...porkMains, ...fishMains].find((r) => r.id === menu[1]?.recipeId)
    expect(secondDayMain?.title).toContain('鮭')
  })

  it('prefers soup-style side dishes for heavy mains when base scores are tied', async () => {
    const mains = Array.from(
      { length: 7 },
      (_, i) => makeRecipe(i + 1, 'manual', '主菜', `豚バラ主菜${i + 1}`, ['豚バラ肉', '玉ねぎ'])
    )
    const sides = [
      makeRecipe(201, 'manual', '副菜', 'ほうれん草の和え物', ['ほうれん草']),
      makeRecipe(202, 'manual', 'スープ', 'わかめスープ', ['わかめ', 'ねぎ']),
      ...Array.from({ length: 6 }, (_, i) => makeRecipe(203 + i, 'manual', '副菜', `副菜${i + 1}`, ['キャベツ'])),
    ]

    mockRecipesToArray.mockResolvedValue([...mains, ...sides])

    const menu = await selectWeeklyMenu(new Date('2026-02-22'), {
      seasonalPriority: 'medium',
      userPrompt: '',
      desiredMealHour: 18,
      desiredMealMinute: 0,
    })

    expect(menu[0]?.sideRecipeId).toBe(202)
  })

  it('prefers color-diverse main dish after a locked red main dish', async () => {
    const lockedRed = makeRecipe(1, 'manual', '主菜', 'トマトチキン', ['鶏肉', 'トマト'])
    const redCandidate = makeRecipe(2, 'manual', '主菜', '赤パプリカチキン', ['鶏肉', '赤パプリカ'])
    const greenCandidate = makeRecipe(3, 'manual', '主菜', 'ブロッコリーチキン', ['鶏肉', 'ブロッコリー'])
    const fillers = Array.from({ length: 6 }, (_, i) => makeRecipe(10 + i, 'manual', '主菜', `鶏の塩焼き${i + 1}`, ['鶏肉', '塩']))

    mockRecipesToArray.mockResolvedValue([lockedRed, redCandidate, greenCandidate, ...fillers])

    const menu = await selectWeeklyMenu(new Date('2026-02-22'), {
      seasonalPriority: 'medium',
      userPrompt: '',
      desiredMealHour: 18,
      desiredMealMinute: 0,
    }, [
      { recipeId: 1, date: '2026-02-22', mealType: 'dinner', locked: true },
    ])

    expect(menu[1]?.recipeId).toBe(3)
  })

  it('uses preloaded weather on regenerate and skips new weather fetch', async () => {
    const mains: Recipe[] = Array.from({ length: 8 }, (_, i) => makeRecipe(i + 1, 'manual'))
    mockRecipesToArray.mockResolvedValue(mains)

    const preloadedWeather = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-02-${String(22 + i).padStart(2, '0')}`,
      maxTempC: 20,
      minTempC: 10,
      precipitationMm: 0,
    }))

    await selectWeeklyMenu(new Date('2026-02-22'), {
      seasonalPriority: 'medium',
      userPrompt: '',
      desiredMealHour: 18,
      desiredMealMinute: 0,
      preloadedWeather,
    })

    expect(mockGetWeeklyWeatherForecast).not.toHaveBeenCalled()
  })


  it('falls back gracefully when seasonalPriority is missing in legacy preferences', async () => {
    const mains: Recipe[] = Array.from({ length: 8 }, (_, i) => makeRecipe(i + 1, 'manual'))
    mockRecipesToArray.mockResolvedValue(mains)

    const menu = await selectWeeklyMenu(new Date('2026-02-22'), {
      seasonalPriority: undefined as unknown as 'low',
      userPrompt: '',
      desiredMealHour: 18,
      desiredMealMinute: 0,
    })

    expect(menu).toHaveLength(7)
  })


  it('fills missing days from top-ranked mains when unique candidates are insufficient', async () => {
    const mains: Recipe[] = [
      makeRecipe(1, 'manual', '主菜', 'A'),
      makeRecipe(2, 'manual', '主菜', 'B'),
      makeRecipe(3, 'manual', '主菜', 'C'),
    ]
    mockRecipesToArray.mockResolvedValue(mains)

    const menu = await selectWeeklyMenu(new Date('2026-02-22'), {
      seasonalPriority: 'medium',
      userPrompt: '',
      desiredMealHour: 18,
      desiredMealMinute: 0,
    }, [
      { recipeId: 1, date: '2026-02-22', mealType: 'dinner', locked: true },
      { recipeId: 2, date: '2026-02-23', mealType: 'dinner', locked: true },
      { recipeId: 3, date: '2026-02-24', mealType: 'dinner', locked: true },
    ])

    expect(menu).toHaveLength(7)
    expect(new Set(menu.map((item) => item.date)).size).toBe(7)
  })

  it('fetches weather for target week when preloaded weather dates are from another week', async () => {
    const mains: Recipe[] = Array.from({ length: 8 }, (_, i) => makeRecipe(i + 1, 'manual'))
    mockRecipesToArray.mockResolvedValue(mains)

    const stalePreloadedWeather = [
      { date: '2026-03-01', maxTempC: 20, minTempC: 10, precipitationMm: 0 },
      { date: '2026-03-02', maxTempC: 21, minTempC: 11, precipitationMm: 1 },
    ]

    await selectWeeklyMenu(new Date('2026-02-22'), {
      seasonalPriority: 'medium',
      userPrompt: '',
      desiredMealHour: 18,
      desiredMealMinute: 0,
      preloadedWeather: stalePreloadedWeather,
    })

    expect(mockGetWeeklyWeatherForecast).toHaveBeenCalledTimes(1)
  })

})
