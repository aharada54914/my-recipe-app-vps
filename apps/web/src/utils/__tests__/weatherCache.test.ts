import { describe, expect, it } from 'vitest'
import { isWeatherCacheUsable, sanitizeWeatherSnapshot } from '../weatherCache'

describe('weatherCache', () => {
  it('accepts cache entries up to 2 days old', () => {
    const now = new Date('2026-03-10T12:00:00.000Z')
    const oneDayAgo = new Date('2026-03-09T12:00:00.000Z').toISOString()
    const threeDaysAgo = new Date('2026-03-07T12:00:00.000Z').toISOString()

    expect(isWeatherCacheUsable(oneDayAgo, now)).toBe(true)
    expect(isWeatherCacheUsable(threeDaysAgo, now)).toBe(false)
  })

  it('sanitizes weather snapshots and drops invalid numeric payloads', () => {
    const valid = sanitizeWeatherSnapshot({
      temperatureC: 26,
      humidityPercent: 72,
      pressureHpa: 1008,
      rainMm: 1.2,
      fetchedAt: '2026-03-10T09:00:00.000Z',
    })
    expect(valid).not.toBeNull()
    expect(valid?.temperatureC).toBe(26)

    const invalid = sanitizeWeatherSnapshot({
      temperatureC: Number.NaN,
      humidityPercent: 72,
    })
    expect(invalid).toBeNull()
  })
})
