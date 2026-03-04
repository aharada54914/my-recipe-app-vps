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
