import { describe, expect, it } from 'vitest'
import { getWeatherPresentation, resolvePrimaryWeatherState } from '../season-weather/weatherPresentation'

describe('weatherPresentation', () => {
  it('prioritizes storm over generic cloud/rain tags', () => {
    const weather = {
      date: '2026-03-08',
      maxTempC: 14,
      minTempC: 4,
      precipitationMm: 4,
      weatherCode: '200',
      weatherText: '曇り時々雷雨',
    }

    expect(resolvePrimaryWeatherState(weather)).toBe('storm')
    expect(getWeatherPresentation(weather)).toMatchObject({
      variant: 'storm',
      label: '曇り時々雷雨',
      shortLabel: '雷',
    })
  })

  it('keeps sunny days in a simple readable state', () => {
    const weather = {
      date: '2026-03-09',
      maxTempC: 18,
      minTempC: 8,
      precipitationMm: 0,
      weatherCode: '100',
      weatherText: '晴れ',
    }

    expect(resolvePrimaryWeatherState(weather)).toBe('sunny')
    expect(getWeatherPresentation(weather)).toMatchObject({
      variant: 'sunny',
      label: '晴れ',
      shortLabel: '晴',
    })
  })

  it('falls back to concise built-in labels when raw weather text is long', () => {
    const weather = {
      date: '2026-03-10',
      maxTempC: 7,
      minTempC: 1,
      precipitationMm: 1,
      weatherCode: '400',
      weatherText: '雪のちくもりところにより風',
    }

    expect(getWeatherPresentation(weather)).toMatchObject({
      variant: 'snow',
      label: '雪',
      shortLabel: '雪',
    })
  })
})
