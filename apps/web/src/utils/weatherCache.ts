const WEATHER_CACHE_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000

export interface WeatherSnapshot {
  temperatureC: number
  humidityPercent: number
  pressureHpa?: number
  rainMm?: number
  fetchedAt: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isWeatherCacheUsable(fetchedAtIso: string, now = new Date()): boolean {
  const fetched = new Date(fetchedAtIso)
  if (Number.isNaN(fetched.getTime())) return false
  return now.getTime() - fetched.getTime() <= WEATHER_CACHE_MAX_AGE_MS
}

export function sanitizeWeatherSnapshot(raw: Partial<WeatherSnapshot>): WeatherSnapshot | null {
  if (!isFiniteNumber(raw.temperatureC)) return null
  if (!isFiniteNumber(raw.humidityPercent)) return null

  return {
    temperatureC: raw.temperatureC,
    humidityPercent: raw.humidityPercent,
    pressureHpa: isFiniteNumber(raw.pressureHpa) ? raw.pressureHpa : undefined,
    rainMm: isFiniteNumber(raw.rainMm) ? raw.rainMm : undefined,
    fetchedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : new Date().toISOString(),
  }
}
