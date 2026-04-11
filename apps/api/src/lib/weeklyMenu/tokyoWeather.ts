import type { MenuPlanningMode } from '@kitchen/shared-types'
import { buildPlanningWindowDates, getPlanningWindow } from './planningWindow.js'

export interface DiscordDailyWeather {
  date: string
  maxTempC: number
  minTempC: number
  precipitationMm: number
  humidityPercent?: number
  weatherCode?: string
  weatherText: string
}

interface ForecastAreaEntry {
  area?: { name?: string }
  weatherCodes?: string[]
  weathers?: string[]
  pops?: string[]
  humiditys?: string[]
  tempsMin?: string[]
  tempsMax?: string[]
  temps?: string[]
}

interface ForecastTimeSeries {
  timeDefines?: string[]
  areas?: ForecastAreaEntry[]
}

interface ForecastPart {
  timeSeries?: ForecastTimeSeries[]
}

const JMA_TOKYO_FORECAST_URL = 'https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json'

function toDateOnly(value: string): string {
  return value.slice(0, 10)
}

function parseNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function monthBaseTemp(month: number): number {
  if (month >= 6 && month <= 9) return 30
  if (month <= 2 || month === 12) return 9
  return 18
}

function buildSyntheticForecast(dates: string[]): DiscordDailyWeather[] {
  const firstDate = dates[0] ? new Date(`${dates[0]}T00:00:00+09:00`) : new Date()
  const month = firstDate.getMonth() + 1
  const baseTemp = monthBaseTemp(month)

  return dates.map((date, index) => {
    return {
      date,
      maxTempC: baseTemp + (index % 3),
      minTempC: baseTemp - 6 + (index % 2),
      precipitationMm: index % 4 === 0 ? 8 : 0,
      humidityPercent: 55 + (index % 3) * 5,
      weatherCode: index % 4 === 0 ? '300' : index % 3 === 0 ? '200' : '100',
      weatherText: index % 4 === 0 ? '雨' : index % 3 === 0 ? '曇り' : '晴れ',
    }
  })
}

function looksTokyoArea(name: string | undefined): boolean {
  return typeof name === 'string' && name.includes('東京')
}

function ensureForecastDefaults(dates: string[], partial: Map<string, Partial<DiscordDailyWeather>>): DiscordDailyWeather[] {
  const fallback = buildSyntheticForecast(dates)
  return fallback.map((day) => {
    const partialDay = partial.get(day.date)
    return {
      date: day.date,
      maxTempC: partialDay?.maxTempC ?? day.maxTempC,
      minTempC: partialDay?.minTempC ?? day.minTempC,
      precipitationMm: partialDay?.precipitationMm ?? day.precipitationMm,
      humidityPercent: partialDay?.humidityPercent ?? day.humidityPercent,
      weatherCode: partialDay?.weatherCode ?? day.weatherCode,
      weatherText: partialDay?.weatherText ?? day.weatherText,
    }
  })
}

function parseTokyoForecast(payload: unknown, dates: string[]): DiscordDailyWeather[] {
  if (!Array.isArray(payload)) return buildSyntheticForecast(dates)

  const daily = new Map<string, Partial<DiscordDailyWeather>>()

  for (const part of payload as ForecastPart[]) {
    for (const series of part.timeSeries ?? []) {
      const dates = (series.timeDefines ?? []).map(toDateOnly)
      for (const area of series.areas ?? []) {
        if (!looksTokyoArea(area.area?.name)) continue
        dates.forEach((date, index) => {
          const current = daily.get(date) ?? {}
          const pop = parseNumber(area.pops?.[index])
          const humidity = parseNumber(area.humiditys?.[index])
          const min = parseNumber(area.tempsMin?.[index] ?? area.temps?.[index])
          const max = parseNumber(area.tempsMax?.[index])

          if (pop != null) current.precipitationMm = Math.round(pop / 10)
          if (humidity != null) current.humidityPercent = humidity
          if (typeof area.weatherCodes?.[index] === 'string') current.weatherCode = area.weatherCodes[index]
          if (typeof area.weathers?.[index] === 'string') current.weatherText = area.weathers[index]
          if (min != null) current.minTempC = min
          if (max != null) current.maxTempC = max
          daily.set(date, current)
        })
      }
    }
  }

  return ensureForecastDefaults(dates, daily)
}

export async function getTokyoMenuForecast(params?: {
  referenceDate?: Date
  planningMode?: MenuPlanningMode
}): Promise<{
  planningMode: MenuPlanningMode
  weekStartDate: string
  endDate: string
  days: DiscordDailyWeather[]
}> {
  const planningWindow = getPlanningWindow(
    params?.planningMode ?? 'week',
    params?.referenceDate ?? new Date(),
  )
  const planningDates = buildPlanningWindowDates(planningWindow)
  let days = buildSyntheticForecast(planningDates)

  try {
    const response = await fetch(JMA_TOKYO_FORECAST_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`JMA forecast fetch failed: ${response.status}`)
    const payload = await response.json()
    days = parseTokyoForecast(payload, planningDates)
  } catch {
    days = buildSyntheticForecast(planningDates)
  }

  return {
    planningMode: planningWindow.planningMode,
    weekStartDate: planningWindow.startDateString,
    endDate: planningWindow.endDateString,
    days,
  }
}
