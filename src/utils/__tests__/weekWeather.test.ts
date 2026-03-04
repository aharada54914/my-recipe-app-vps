import { describe, expect, it } from 'vitest'
import { filterForecastForWeek, getWeekDateStrings, isCompleteForecastForWeek } from '../season-weather/weekWeather'
import type { DailyWeather } from '../season-weather/weatherProvider'

describe('weekWeather helpers', () => {
  const weekStart = new Date('2026-02-22')

  const make = (date: string): DailyWeather => ({
    date,
    maxTempC: 20,
    minTempC: 10,
    precipitationMm: 0,
  })

  it('returns seven expected dates for a week', () => {
    const dates = getWeekDateStrings(weekStart)
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2026-02-22')
    expect(dates[6]).toBe('2026-02-28')
  })

  it('filters out forecast entries that do not belong to target week', () => {
    const filtered = filterForecastForWeek([
      make('2026-02-22'),
      make('2026-02-25'),
      make('2026-03-01'),
    ], weekStart)

    expect(filtered.map((v) => v.date)).toEqual(['2026-02-22', '2026-02-25'])
  })

  it('checks completeness only when all seven target dates exist', () => {
    const complete = getWeekDateStrings(weekStart).map(make)
    const incomplete = complete.slice(0, 6)

    expect(isCompleteForecastForWeek(complete, weekStart)).toBe(true)
    expect(isCompleteForecastForWeek(incomplete, weekStart)).toBe(false)
  })
})
