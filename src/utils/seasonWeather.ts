import type { Recipe, WeatherCacheItem } from '../db/db'
import { db } from '../db/db'
import { isWeatherCacheUsable } from './weatherCache'

export interface WeatherContext {
  temperatureC: number
  humidityPercent: number
  pressureDelta24h?: number
  rainMm?: number
  laggedDiNormalized?: number
}

export function computeDiscomfortIndex(temperatureC: number, humidityPercent: number): number {
  return 0.81 * temperatureC + 0.01 * humidityPercent * (0.99 * temperatureC - 14.3) + 46.3
}

export function normalizeDiscomfortIndex(di: number): number {
  const min = 40
  const max = 85
  const norm = (di - min) / (max - min)
  return Math.max(0, Math.min(1, norm))
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function computeLagCompensatedDiNorm(entries: WeatherCacheItem[]): number {
  const now = entries.at(-1)
  if (!now) return 0.5

  const currentDiNorm = normalizeDiscomfortIndex(computeDiscomfortIndex(now.temperatureC, now.humidityPercent))
  const prev1 = entries.at(-2)
  const prev2 = entries.at(-3)

  const prev1Norm = prev1 ? normalizeDiscomfortIndex(computeDiscomfortIndex(prev1.temperatureC, prev1.humidityPercent)) : currentDiNorm
  const prev2Norm = prev2 ? normalizeDiscomfortIndex(computeDiscomfortIndex(prev2.temperatureC, prev2.humidityPercent)) : prev1Norm

  const weighted = currentDiNorm * 0.6 + prev1Norm * 0.3 + prev2Norm * 0.1
  const nonlinear = sigmoid((weighted - 0.5) * 4)
  return Math.max(0, Math.min(1, nonlinear))
}

export function computeWeatherFit(recipe: Recipe, weather: WeatherContext | null): number {
  if (!weather) return 0

  const rawDi = computeDiscomfortIndex(weather.temperatureC, weather.humidityPercent)
  const diNorm = weather.laggedDiNormalized ?? normalizeDiscomfortIndex(rawDi)

  const text = `${recipe.title} ${recipe.ingredients.map((i) => i.name).join(' ')}`

  let score = 0
  const hasSoupOrStew = /スープ|汁|鍋|煮/.test(text)
  const hasCooling = /サラダ|冷|酢|レモン|梅|和え|マリネ/.test(text)
  const hasSpice = /カレー|唐辛子|豆板醤|キムチ/.test(text)

  if (diNorm >= 0.7) {
    if (hasCooling) score += 6 + (diNorm - 0.7) * 4
    if (hasSpice) score += 2
    if (hasSoupOrStew) score -= 3
  } else if (diNorm <= 0.35) {
    if (hasSoupOrStew) score += 6 + (0.35 - diNorm) * 4
    if (hasCooling) score -= 2
  } else {
    if (hasSoupOrStew) score += 1
    if (hasCooling) score += 1
  }

  if ((weather.rainMm ?? 0) > 3) {
    const ingredientCount = recipe.ingredients.length
    score += ingredientCount <= 8 ? 1.5 : -1.5
  }

  const pressureDelta = weather.pressureDelta24h ?? 0
  if (pressureDelta <= -4 && /鍋|汁|スープ/.test(text)) score += 1.2

  return score
}

export async function getRecentWeatherContext(): Promise<WeatherContext | null> {
  const entries = await db.weatherCache.orderBy('fetchedAt').reverse().limit(3).toArray()
  if (entries.length === 0) return null

  const latest = entries[0]
  if (!isWeatherCacheUsable(latest.fetchedAt.toISOString())) return null

  const oneDayAgo = entries.find((entry) => latest.fetchedAt.getTime() - entry.fetchedAt.getTime() >= 18 * 60 * 60 * 1000)
  const pressureDelta24h = oneDayAgo?.pressureHpa != null && latest.pressureHpa != null
    ? latest.pressureHpa - oneDayAgo.pressureHpa
    : undefined

  return {
    temperatureC: latest.temperatureC,
    humidityPercent: latest.humidityPercent,
    rainMm: latest.rainMm,
    pressureDelta24h,
    laggedDiNormalized: computeLagCompensatedDiNorm(entries.reverse()),
  }
}
