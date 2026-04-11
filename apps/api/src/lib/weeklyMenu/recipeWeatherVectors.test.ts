import { describe, expect, it } from 'vitest'
import { computeUnifiedWeatherScore, type PlannerRecipeInput, type PlannerWeatherInput } from './recipeWeatherVectors.js'

const hotSummerDay: PlannerWeatherInput = {
  maxTempC: 34,
  precipitationMm: 0,
  weatherCode: '100',
  weatherText: '晴れ',
  date: '2026-08-01',
}

const coldWinterDay: PlannerWeatherInput = {
  maxTempC: 8,
  precipitationMm: 0,
  weatherCode: '200',
  weatherText: '曇り',
  date: '2026-01-15',
}

const coldDish: PlannerRecipeInput = {
  title: '冷やし中華',
  device: 'manual',
  ingredients: [],
}

const warmDish: PlannerRecipeInput = {
  title: '鍋料理',
  device: 'hotcook',
  ingredients: [],
}

describe('computeUnifiedWeatherScore', () => {
  it('scores a cold dish higher than a warm dish on a hot summer day', () => {
    const coldScore = computeUnifiedWeatherScore(coldDish, hotSummerDay)
    const warmScore = computeUnifiedWeatherScore(warmDish, hotSummerDay)
    expect(coldScore).toBeGreaterThan(warmScore)
  })

  it('scores a warm dish higher than a cold dish on a cold winter day', () => {
    const warmScore = computeUnifiedWeatherScore(warmDish, coldWinterDay)
    const coldScore = computeUnifiedWeatherScore(coldDish, coldWinterDay)
    expect(warmScore).toBeGreaterThan(coldScore)
  })

  it('always returns a score in the [0, 1] range', () => {
    const recipes: PlannerRecipeInput[] = [
      coldDish,
      warmDish,
      { title: 'カレーライス', device: 'hotcook', ingredients: [] },
      { title: '普通の炒め物', device: 'manual', ingredients: [] },
    ]

    const weathers: PlannerWeatherInput[] = [
      hotSummerDay,
      coldWinterDay,
      { maxTempC: 20, precipitationMm: 0, weatherCode: '101', weatherText: '晴れ時々曇り', date: '2026-05-01' },
      { maxTempC: 15, precipitationMm: 12, weatherCode: '300', weatherText: '雨', date: '2026-06-15' },
      { maxTempC: 40, precipitationMm: 0, weatherCode: '100', weatherText: '晴れ', date: '2026-07-20' },
      { maxTempC: -5, precipitationMm: 5, weatherCode: '400', weatherText: '雪', date: '2026-02-10' },
    ]

    for (const recipe of recipes) {
      for (const weather of weathers) {
        const score = computeUnifiedWeatherScore(recipe, weather)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      }
    }
  })

  it('returns a higher score for warm dish when tOpt is high (user prefers warmth)', () => {
    const scoreHighTOpt = computeUnifiedWeatherScore(warmDish, coldWinterDay, 28)
    const scoreLowTOpt = computeUnifiedWeatherScore(warmDish, coldWinterDay, 16)

    expect(scoreHighTOpt).toBeGreaterThan(scoreLowTOpt)
  })
})
