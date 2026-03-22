import { describe, expect, it } from 'vitest'
import { resolveFamilyCalendarTarget } from '../weeklyMenuCalendar'

describe('resolveFamilyCalendarTarget', () => {
  it('returns the configured family calendar id', () => {
    expect(resolveFamilyCalendarTarget({
      familyCalendarId: 'family-calendar-id',
    } as never)).toBe('family-calendar-id')
  })

  it('throws when family calendar is missing', () => {
    expect(() => resolveFamilyCalendarTarget({} as never)).toThrow(/家族カレンダーが未設定/)
  })
})
