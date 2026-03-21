import { describe, expect, it } from 'vitest'
import { buildWeatherTags } from '../season-weather/weatherTagger'

describe('buildWeatherTags', () => {
  it('detects rain/storm from text and code', () => {
    const tags = buildWeatherTags({
      date: '2026-03-01',
      maxTempC: 18,
      minTempC: 9,
      precipitationMm: 7,
      weatherCode: '200',
      weatherText: '曇り時々雷雨',
    })
    expect(tags).toContain('storm')
    expect(tags).toContain('rain')
    expect(tags).toContain('cloudy')
  })

  it('adds night tag when hour is nighttime', () => {
    const tags = buildWeatherTags({
      date: '2026-03-01',
      maxTempC: 25,
      minTempC: 16,
      precipitationMm: 0,
      weatherCode: '100',
      weatherText: '晴れ',
    }, 22)
    expect(tags).toContain('night')
  })
})
