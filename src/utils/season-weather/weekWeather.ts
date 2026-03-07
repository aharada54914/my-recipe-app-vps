import { addDays, format } from 'date-fns'
import type { DailyWeather } from './weatherProvider'

export function getWeekDateStrings(weekStartDate: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStartDate, i), 'yyyy-MM-dd'))
}

export function filterForecastForWeek(forecast: DailyWeather[], weekStartDate: Date): DailyWeather[] {
  const allowed = new Set(getWeekDateStrings(weekStartDate))
  return forecast.filter((item) => allowed.has(item.date))
}

export function isCompleteForecastForWeek(forecast: DailyWeather[], weekStartDate: Date): boolean {
  const weekDates = getWeekDateStrings(weekStartDate)
  const available = new Set(filterForecastForWeek(forecast, weekStartDate).map((item) => item.date))
  return weekDates.every((date) => available.has(date))
}

function cloneForecastForDate(seed: DailyWeather | undefined, date: string): DailyWeather {
  return {
    date,
    maxTempC: seed?.maxTempC ?? 0,
    minTempC: seed?.minTempC ?? 0,
    precipitationMm: seed?.precipitationMm ?? 0,
    humidityPercent: seed?.humidityPercent,
    weatherCode: seed?.weatherCode,
    weatherText: seed?.weatherText,
  }
}

export function buildDisplayForecastForWeek(forecast: DailyWeather[], weekStartDate: Date): DailyWeather[] {
  const weekDates = getWeekDateStrings(weekStartDate)
  const weeklyForecast = filterForecastForWeek(forecast, weekStartDate)
  const byDate = new Map(weeklyForecast.map((item) => [item.date, item] as const))

  return weekDates.map((date, index) => {
    const exact = byDate.get(date)
    if (exact) return exact

    const previous = [...weekDates.slice(0, index)].reverse().map((candidate) => byDate.get(candidate)).find(Boolean)
    const next = weekDates.slice(index + 1).map((candidate) => byDate.get(candidate)).find(Boolean)
    return cloneForecastForDate(previous ?? next, date)
  })
}
