import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWeeklyWeatherForecast, parseTokyoWeeklyForecast } from '../season-weather/weatherProvider'

const START = new Date('2026-03-01T00:00:00Z')

describe('parseTokyoWeeklyForecast', () => {
  it('parses Tokyo area values from JMA-like payload', () => {
    const payload = [
      {
        timeSeries: [
          {
            timeDefines: ['2026-03-01T00:00:00+09:00', '2026-03-02T00:00:00+09:00'],
            areas: [
              {
                area: { name: '東京地方' },
                pops: ['60', '10'],
                humiditys: ['71', '58'],
              },
            ],
          },
          {
            timeDefines: ['2026-03-01T00:00:00+09:00', '2026-03-02T00:00:00+09:00'],
            areas: [
              {
                area: { name: '東京' },
                tempsMin: ['5', '6'],
                tempsMax: ['14', '13'],
              },
            ],
          },
        ],
      },
    ]

    const out = parseTokyoWeeklyForecast(payload, START)
    expect(out[0]).toMatchObject({ date: '2026-03-01', minTempC: 5, maxTempC: 14, precipitationMm: 6, humidityPercent: 71 })
    expect(out[1]).toMatchObject({ date: '2026-03-02', minTempC: 6, maxTempC: 13, precipitationMm: 1, humidityPercent: 58 })
    expect(out).toHaveLength(7)
  })
})

describe('getWeeklyWeatherForecast', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to synthetic values when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network')
    }))

    const out = await getWeeklyWeatherForecast(START)
    expect(out).toHaveLength(7)
    expect(out[0].date).toBe('2026-03-01')
    expect(out[6].date).toBe('2026-03-07')
  })
})
