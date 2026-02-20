import { describe, it, expect, vi } from 'vitest'

// Mock Dexie db and seasonal data before importing the module under test
vi.mock('../../db/db', () => ({
  db: {
    recipes: { count: vi.fn(), offset: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) },
    stock: { filter: vi.fn(() => ({ toArray: vi.fn(() => []) })) },
    weeklyMenus: { orderBy: vi.fn(() => ({ reverse: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })) },
    viewHistory: { orderBy: vi.fn(() => ({ reverse: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })) },
  },
}))

vi.mock('../../data/seasonalIngredients', () => ({
  getCurrentSeasonalIngredients: vi.fn(() => []),
}))

import { getWeekStartDate } from '../weeklyMenuSelector'

describe('getWeekStartDate', () => {
  it('returns the Sunday of the current week for a Sunday', () => {
    // 2026-01-04 is a Sunday
    const sunday = new Date('2026-01-04T12:00:00')
    const result = getWeekStartDate(sunday)
    expect(result.getDay()).toBe(0) // Sunday
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(4)
  })

  it('returns the preceding Sunday for a midweek date', () => {
    // 2026-01-07 is a Wednesday
    const wednesday = new Date('2026-01-07T10:00:00')
    const result = getWeekStartDate(wednesday)
    expect(result.getDay()).toBe(0) // Sunday
    expect(result.getDate()).toBe(4) // 2026-01-04
  })

  it('returns the preceding Sunday for a Saturday', () => {
    // 2026-01-10 is a Saturday
    const saturday = new Date('2026-01-10T23:00:00')
    const result = getWeekStartDate(saturday)
    expect(result.getDay()).toBe(0)
    expect(result.getDate()).toBe(4) // 2026-01-04
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
