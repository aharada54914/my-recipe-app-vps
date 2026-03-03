import type { Recipe } from '../../db/db'
import type { DailyWeather } from './weatherProvider'

function thermalFit(recipe: Recipe, weather: DailyWeather): number {
  const title = recipe.title
  if (weather.maxTempC >= 28) {
    if (/冷|サラダ|さっぱり/.test(title)) return 1
    if (/煮込み|鍋/.test(title)) return 0.3
    return 0.6
  }
  if (weather.maxTempC <= 12) {
    if (/煮込み|鍋|スープ/.test(title)) return 1
    if (/冷|サラダ/.test(title)) return 0.4
    return 0.7
  }
  return 0.7
}

function cookingLoadFit(recipe: Recipe, weather: DailyWeather): number {
  const minutes = recipe.totalTimeMinutes ?? 30
  if (weather.maxTempC >= 30) return minutes <= 20 ? 1 : 0.5
  return minutes <= 40 ? 0.8 : 0.6
}

function shoppingBurdenFit(recipe: Recipe, weather: DailyWeather): number {
  if (weather.precipitationMm < 5) return 0.7
  const mainCount = recipe.ingredients.filter((i) => i.category === 'main').length
  return mainCount <= 5 ? 1 : 0.6
}

export function computeWeatherComfortScore(recipe: Recipe, weather: DailyWeather): number {
  const score =
    0.45 * thermalFit(recipe, weather) +
    0.3 * cookingLoadFit(recipe, weather) +
    0.25 * shoppingBurdenFit(recipe, weather)
  return Math.round(score * 100) / 100
}
