import { describe, expect, it } from 'vitest'
import { buildPlanningWindowDates, getPlanningWindow } from './planningWindow.js'

describe('getPlanningWindow', () => {
  it('returns the current day through Sunday for week mode', () => {
    const window = getPlanningWindow('week', new Date('2026-04-11T12:00:00+09:00'))

    expect(window.startDateString).toBe('2026-04-11')
    expect(window.endDateString).toBe('2026-04-12')
    expect(window.dayCount).toBe(2)
    expect(buildPlanningWindowDates(window)).toEqual(['2026-04-11', '2026-04-12'])
  })

  it('returns seven days when the reference date is Monday in week mode', () => {
    const window = getPlanningWindow('week', new Date('2026-04-06T09:00:00+09:00'))

    expect(window.startDateString).toBe('2026-04-06')
    expect(window.endDateString).toBe('2026-04-12')
    expect(window.dayCount).toBe(7)
  })

  it('returns a single day for Sunday in week mode', () => {
    const window = getPlanningWindow('week', new Date('2026-04-12T09:00:00+09:00'))

    expect(window.startDateString).toBe('2026-04-12')
    expect(window.endDateString).toBe('2026-04-12')
    expect(window.dayCount).toBe(1)
  })

  it('returns a single day in day mode', () => {
    const window = getPlanningWindow('day', new Date('2026-04-11T12:00:00+09:00'))

    expect(window.startDateString).toBe('2026-04-11')
    expect(window.endDateString).toBe('2026-04-11')
    expect(window.dayCount).toBe(1)
  })
})
