import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  weeklyMenuFindFirst: vi.fn(),
  weeklyMenuFindMany: vi.fn(),
  recipeFindMany: vi.fn(),
}))

vi.mock('../db.js', () => ({
  prisma: {
    weeklyMenu: {
      findFirst: mocks.weeklyMenuFindFirst,
      findMany: mocks.weeklyMenuFindMany,
    },
    recipe: {
      findMany: mocks.recipeFindMany,
    },
  },
}))

vi.mock('../lib/date.js', () => ({
  getCurrentWeekMonday: vi.fn(() => '2026-04-06'),
  getLocalDateString: vi.fn(() => '2026-04-11'),
}))

import { getShoppingListData } from './shoppingList.js'
import { getWeeklyMenuData } from './weeklyMenu.js'

describe('weekly menu resources', () => {
  beforeEach(() => {
    mocks.weeklyMenuFindFirst.mockReset()
    mocks.weeklyMenuFindMany.mockReset()
    mocks.recipeFindMany.mockReset()
    mocks.recipeFindMany.mockResolvedValue([{ id: 10, title: '鶏の照り焼き' }])
  })

  it('uses exact weekStartDate lookup when a week is specified', async () => {
    mocks.weeklyMenuFindFirst.mockResolvedValue({
      weekStartDate: '2026-04-06',
      status: 'confirmed',
      items: [{ recipeId: 10, date: '2026-04-06', mainServings: 2 }],
    })

    const result = await getWeeklyMenuData({ userId: 'user-1', weekStartDate: '2026-04-06' })

    expect(mocks.weeklyMenuFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        weekStartDate: '2026-04-06',
      },
      orderBy: { updatedAt: 'desc' },
    })
    expect(result.weekStartDate).toBe('2026-04-06')
    expect(result.items[0]?.recipeTitle).toBe('鶏の照り焼き')
  })

  it('falls back to the most recent menu containing today when no week is specified', async () => {
    mocks.weeklyMenuFindMany.mockResolvedValue([
      {
        weekStartDate: '2026-04-06',
        status: 'confirmed',
        items: [{ recipeId: 10, date: '2026-04-08', mainServings: 2 }],
      },
      {
        weekStartDate: '2026-04-11',
        status: 'confirmed',
        items: [{ recipeId: 10, date: '2026-04-11', mainServings: 2 }],
      },
    ])

    const result = await getWeeklyMenuData({ userId: 'user-1' })

    expect(mocks.weeklyMenuFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { updatedAt: 'desc' },
      take: 24,
    })
    expect(result.weekStartDate).toBe('2026-04-11')
    expect(result.items).toHaveLength(1)
  })

  it('uses the current menu for shopping list lookup when no week is specified', async () => {
    mocks.weeklyMenuFindMany.mockResolvedValue([
      {
        weekStartDate: '2026-04-11',
        shoppingList: '玉ねぎ',
        status: 'confirmed',
        items: [{ recipeId: 10, date: '2026-04-11', mainServings: 2 }],
      },
    ])

    const result = await getShoppingListData({ userId: 'user-1' })

    expect(result.weekStartDate).toBe('2026-04-11')
    expect(result.shoppingList).toBe('玉ねぎ')
  })
})
