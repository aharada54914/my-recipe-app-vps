import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../db/db'
import { computeDiscomfortIndex, computeWeatherFit, normalizeDiscomfortIndex } from '../seasonWeather'

function makeRecipe(title: string, ingredients: string[]): Recipe {
  return {
    id: 1,
    title,
    recipeNumber: 'R-1',
    device: 'manual',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 500,
    ingredients: ingredients.map((name) => ({ name, quantity: 1, unit: '個', category: 'main' })),
    steps: [{ name: '調理', durationMinutes: 10 }],
    totalTimeMinutes: 10,
  }
}

describe('seasonWeather scoring', () => {
  it('normalizes discomfort index to 0..1', () => {
    const di = computeDiscomfortIndex(35, 80)
    const normalized = normalizeDiscomfortIndex(di)
    expect(normalized).toBeGreaterThanOrEqual(0)
    expect(normalized).toBeLessThanOrEqual(1)
  })

  it('prefers cooling dishes in hot and humid weather', () => {
    const weather = { temperatureC: 34, humidityPercent: 78, rainMm: 0 }
    const cool = makeRecipe('さっぱりマリネ', ['鶏むね肉', '酢'])
    const hotSoup = makeRecipe('濃厚鍋スープ', ['豚肉', '白菜'])

    expect(computeWeatherFit(cool, weather)).toBeGreaterThan(computeWeatherFit(hotSoup, weather))
  })

  it('boosts warming dishes with pressure drop lag compensation', () => {
    const soup = makeRecipe('鶏だしスープ', ['鶏肉', 'ねぎ'])
    const stirFry = makeRecipe('鶏肉炒め', ['鶏肉', 'ピーマン'])
    const weather = {
      temperatureC: 21,
      humidityPercent: 70,
      rainMm: 1,
      pressureDelta24h: -5,
      laggedDiNormalized: 0.28,
    }

    expect(computeWeatherFit(soup, weather)).toBeGreaterThan(computeWeatherFit(stirFry, weather))
  })
})
