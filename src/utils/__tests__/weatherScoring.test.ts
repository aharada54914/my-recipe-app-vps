import { describe, expect, it } from 'vitest'
import { computeWeatherComfortScore } from '../season-weather/weatherScoring'
import type { Recipe } from '../../db/db'

const baseRecipe: Recipe = {
  id: 1,
  title: '冷しゃぶサラダ',
  recipeNumber: 'T-1',
  device: 'manual',
  category: '主菜',
  baseServings: 2,
  totalWeightG: 400,
  ingredients: [{ name: '豚肉', quantity: 200, unit: 'g', category: 'main' }],
  steps: [{ name: '作る', durationMinutes: 10 }],
  totalTimeMinutes: 15,
}

describe('computeWeatherComfortScore', () => {
  it('scores chilled dish higher in hot weather', () => {
    const hot = { date: '2026-08-01', maxTempC: 33, minTempC: 27, precipitationMm: 0 }
    const cool = { date: '2026-01-01', maxTempC: 8, minTempC: 2, precipitationMm: 0 }
    expect(computeWeatherComfortScore(baseRecipe, hot)).toBeGreaterThan(computeWeatherComfortScore(baseRecipe, cool))
  })
})
