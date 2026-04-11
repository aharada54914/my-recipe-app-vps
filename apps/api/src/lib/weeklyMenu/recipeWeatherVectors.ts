import type { JsonValue } from '@prisma/client/runtime/library'
import { WARM_TITLE_RE, COLD_TITLE_RE, SPICE_KEYWORDS_RE, solarFactor } from './recipeKeywords.js'

export interface PlannerRecipeInput {
  title: string
  device: string
  ingredients: JsonValue
}

export interface PlannerWeatherInput {
  date: string
  maxTempC: number
  minTempC?: number
  precipitationMm: number
  humidityPercent?: number
  weatherCode?: string
  weatherText: string
}

interface RecipeWeatherVec {
  wTemp: number   // 0-1: cold/warm dish alignment
  wWater: number  // 0-1: hydration/soup content
  wSpice: number  // 0-1: spice/warming level
  wCarb: number   // 0-1: carbohydrate density
}

function getDayOfYear(dateString: string): number {
  const d = new Date(`${dateString}T00:00:00+09:00`)
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function extractIngredientText(ingredients: JsonValue): string {
  if (!Array.isArray(ingredients)) return ''
  return ingredients
    .map((item) => {
      if (typeof item !== 'object' || item == null || Array.isArray(item)) return ''
      const name = (item as { name?: unknown }).name
      return typeof name === 'string' ? name : ''
    })
    .join(' ')
}

// ---- Phase C: 4-factor operational scoring ----

function thermalFit(recipe: PlannerRecipeInput, weather: PlannerWeatherInput): number {
  const code = weather.weatherCode ?? '101'
  const solar = solarFactor(code)
  const apparentTemp = weather.maxTempC + (solar - 0.5) * 4
  const delta = 22 - apparentTemp  // positive = colder than 22°C → want warm food
  const weatherDemand = Math.max(-1, Math.min(1, delta / 20))

  const isColdDish = COLD_TITLE_RE.test(recipe.title)
  const isWarmDish = WARM_TITLE_RE.test(recipe.title)

  if (isColdDish) return Math.max(0, Math.min(1, 0.5 - 0.5 * weatherDemand))
  if (isWarmDish) return Math.max(0, Math.min(1, 0.5 + 0.5 * weatherDemand))
  return Math.max(0, Math.min(1, 0.5 + delta / 40))
}

function cookingLoadFit(recipe: PlannerRecipeInput, weather: PlannerWeatherInput): number {
  const hot = weather.maxTempC >= 28
  const humid = (weather.humidityPercent ?? 60) >= 75
  const isHotcook = recipe.device === 'hotcook'
  const isManual = recipe.device === 'manual'

  if (hot && humid) return isHotcook ? 0.9 : isManual ? 0.3 : 0.5
  if (weather.maxTempC <= 14) return isHotcook ? 0.85 : 0.5
  return 0.6
}

function shoppingBurdenFit(recipe: PlannerRecipeInput, weather: PlannerWeatherInput): number {
  const rainy = weather.precipitationMm >= 3
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 5
  if (rainy) {
    // prefer recipes with fewer unique ingredients on rainy days
    return ingredientCount <= 4 ? 0.9 : ingredientCount <= 7 ? 0.6 : 0.3
  }
  return 0.6
}

function waterFit(recipe: PlannerRecipeInput, weather: PlannerWeatherInput): number {
  const hot = weather.maxTempC >= 28
  const isSoup = /(スープ|汁|みそ汁|ポタージュ|ポワレ)/.test(recipe.title)
  if (hot) return isSoup ? 0.9 : 0.4
  return isSoup ? 0.5 : 0.6
}

function computeWeatherComfortScore(recipe: PlannerRecipeInput, weather: PlannerWeatherInput): number {
  return (
    thermalFit(recipe, weather) * 0.40 +
    cookingLoadFit(recipe, weather) * 0.25 +
    shoppingBurdenFit(recipe, weather) * 0.20 +
    waterFit(recipe, weather) * 0.15
  )
}

// ---- Phase D: 4D demand/feature vectors ----

function computeWeatherDemandVec(
  weather: PlannerWeatherInput,
  tOpt: number = 22,
  dayOfYear?: number,
): RecipeWeatherVec {
  const code = weather.weatherCode ?? '101'
  const solar = solarFactor(code)
  const apparentTemp = weather.maxTempC + (solar - 0.5) * 4
  const delta = tOpt - apparentTemp  // positive = colder → want warm food
  const tempDemand = Math.max(-1, Math.min(1, delta / 20))

  // Circannual carb baseline: higher in autumn (day ~280 = Oct 7)
  const doy = dayOfYear ?? getDayOfYear(weather.date)
  const carbBaseline = 0.15 * Math.cos((2 * Math.PI / 365) * (doy - 280))

  const rainy = weather.precipitationMm >= 3
  const hot = apparentTemp >= 28

  return {
    wTemp: Math.max(0, Math.min(1, 0.5 + 0.5 * tempDemand)),
    wWater: hot ? 0.8 : rainy ? 0.5 : 0.3,
    wSpice: Math.max(0, Math.min(1, 0.5 + 0.3 * tempDemand)),
    wCarb: Math.max(0, Math.min(1, 0.5 + carbBaseline)),
  }
}

function computeRecipeFeatureVec(recipe: PlannerRecipeInput): RecipeWeatherVec {
  const title = recipe.title
  const ingredientText = extractIngredientText(recipe.ingredients)
  const haystack = `${title} ${ingredientText}`

  const isWarm = WARM_TITLE_RE.test(title)
  const isCold = COLD_TITLE_RE.test(title)
  const isSoup = /(スープ|汁|みそ汁|ポタージュ)/.test(title)
  const isSpicy = SPICE_KEYWORDS_RE.test(haystack)
  const isCarb = /(ごはん|パスタ|うどん|そば|ラーメン|ご飯|丼|カレー|炒飯|チャーハン|リゾット|雑炊)/.test(title)

  return {
    wTemp: isWarm ? 0.9 : isCold ? 0.1 : 0.5,
    wWater: isSoup ? 0.9 : isCold ? 0.7 : 0.3,
    wSpice: isSpicy ? 0.8 : 0.2,
    wCarb: isCarb ? 0.8 : 0.3,
  }
}

function dotProduct(a: RecipeWeatherVec, b: RecipeWeatherVec): number {
  // Sum of products, normalized by 4 dimensions to stay in [0, 1] range
  return (a.wTemp * b.wTemp + a.wWater * b.wWater + a.wSpice * b.wSpice + a.wCarb * b.wCarb) / 4
}

/**
 * Unified weather score combining:
 * - 70%: alignment between weather demand vector and recipe feature vector
 * - 30%: operational comfort score (4-factor continuous)
 * Returns a value in [0, 1].
 */
export function computeUnifiedWeatherScore(
  recipe: PlannerRecipeInput,
  weather: PlannerWeatherInput,
  tOpt: number = 22,
  dayOfYear?: number,
): number {
  const demandVec = computeWeatherDemandVec(weather, tOpt, dayOfYear)
  const featureVec = computeRecipeFeatureVec(recipe)
  const alignment = dotProduct(demandVec, featureVec)
  const operational = computeWeatherComfortScore(recipe, weather)
  return Math.round((0.7 * alignment + 0.3 * operational) * 1000) / 1000
}
