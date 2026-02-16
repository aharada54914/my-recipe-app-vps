import { describe, it, expect } from 'vitest'
import {
  formatQuantityVibe,
  adjustIngredients,
  calculateSalt,
  calculateSchedule,
  calculateMatchRate,
} from '../recipeUtils'
import type { Ingredient, CookingStep, SaltMode } from '../../db/db'

describe('formatQuantityVibe', () => {
  it('returns 適量 for unit 適量', () => {
    expect(formatQuantityVibe(0, '適量')).toBe('適量')
  })

  it('returns 0 + unit for zero value (non-適量)', () => {
    expect(formatQuantityVibe(0, 'g')).toBe('0g')
    expect(formatQuantityVibe(0, '個')).toBe('0個')
  })

  it('rounds g to nearest 1', () => {
    expect(formatQuantityVibe(123, 'g')).toBe('123g')
    expect(formatQuantityVibe(125, 'g')).toBe('125g')
    expect(formatQuantityVibe(200, 'g')).toBe('200g')
  })

  it('rounds ml to nearest 1', () => {
    expect(formatQuantityVibe(55, 'ml')).toBe('55ml')
    expect(formatQuantityVibe(600, 'ml')).toBe('600ml')
  })

  it('formats tablespoon fractions', () => {
    expect(formatQuantityVibe(0.5, '大さじ')).toBe('大さじ1/2')
    expect(formatQuantityVibe(1.5, '大さじ')).toBe('大さじ1と1/2')
    expect(formatQuantityVibe(2, '大さじ')).toBe('大さじ2')
  })

  it('formats teaspoon fractions', () => {
    expect(formatQuantityVibe(0.5, '小さじ')).toBe('小さじ1/2')
    expect(formatQuantityVibe(1, '小さじ')).toBe('小さじ1')
  })

  it('formats countable units with Japanese approximations', () => {
    expect(formatQuantityVibe(1, '個')).toBe('1個')
    expect(formatQuantityVibe(0.5, '個')).toBe('半個')
    expect(formatQuantityVibe(1.5, '本')).toBe('1本半')
    expect(formatQuantityVibe(1.2, '個')).toBe('1個強')
  })

  it('handles fallback for unknown units', () => {
    expect(formatQuantityVibe(3, 'カップ')).toBe('3カップ')
    expect(formatQuantityVibe(1.5, 'カップ')).toBe('1.5カップ')
  })
})

describe('adjustIngredients', () => {
  const baseIngredients: Ingredient[] = [
    { name: '肉', quantity: 200, unit: 'g', category: 'main' },
    { name: '塩', quantity: 0, unit: '適量', category: 'sub' },
    { name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' },
  ]

  it('scales quantities by ratio', () => {
    const result = adjustIngredients(baseIngredients, 2, 4)
    expect(result[0].quantity).toBe(400)
    expect(result[2].quantity).toBe(2)
  })

  it('skips 適量 ingredients', () => {
    const result = adjustIngredients(baseIngredients, 2, 4)
    expect(result[1].quantity).toBe(0)
    expect(result[1].unit).toBe('適量')
  })

  it('handles halving', () => {
    const result = adjustIngredients(baseIngredients, 4, 2)
    expect(result[0].quantity).toBe(100)
  })
})

describe('calculateSalt', () => {
  const modes: SaltMode[] = [0.6, 0.8, 1.2]

  it('calculates salt for standard mode (0.8%)', () => {
    const result = calculateSalt(1000, 0.8)
    expect(result.saltG).toBe(8)
    expect(result.soySauceMl).toBeGreaterThan(0)
    expect(result.misoG).toBeGreaterThan(0)
  })

  it('calculates correctly for all modes', () => {
    for (const mode of modes) {
      const result = calculateSalt(500, mode)
      expect(result.saltG).toBe(Math.round((500 * mode) / 100 * 10) / 10)
    }
  })

  it('rounds to 1 decimal place', () => {
    const result = calculateSalt(333, 0.6)
    const str = result.saltG.toString()
    const decimalParts = str.split('.')
    if (decimalParts.length > 1) {
      expect(decimalParts[1].length).toBeLessThanOrEqual(1)
    }
  })
})

describe('calculateSchedule', () => {
  it('works backward from target time', () => {
    const target = new Date('2024-12-25T18:00:00')
    const steps: CookingStep[] = [
      { name: '下ごしらえ', durationMinutes: 15 },
      { name: '調理', durationMinutes: 30, isDeviceStep: true },
      { name: '盛り付け', durationMinutes: 5 },
    ]

    const entries = calculateSchedule(target, steps)

    expect(entries).toHaveLength(3)
    expect(entries[2].end.getTime()).toBe(target.getTime())
    expect(entries[0].start.getTime()).toBe(
      target.getTime() - (15 + 30 + 5) * 60000
    )
  })

  it('handles empty steps', () => {
    const target = new Date('2024-12-25T18:00:00')
    const entries = calculateSchedule(target, [])
    expect(entries).toHaveLength(0)
  })
})

describe('calculateMatchRate', () => {
  it('returns percentage of matched ingredients', () => {
    const ingredients: Ingredient[] = [
      { name: '肉', quantity: 200, unit: 'g', category: 'main' },
      { name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' },
      { name: '醤油', quantity: 2, unit: '大さじ', category: 'sub' },
    ]
    const stock = new Set(['肉'])

    // 1 out of 3 total ingredients = 33%
    expect(calculateMatchRate(ingredients, stock)).toBe(33)
  })

  it('returns 0 when no main ingredients', () => {
    const ingredients: Ingredient[] = [
      { name: '醤油', quantity: 2, unit: '大さじ', category: 'sub' },
    ]
    expect(calculateMatchRate(ingredients, new Set())).toBe(0)
  })

  it('returns 100 when all main ingredients are in stock', () => {
    const ingredients: Ingredient[] = [
      { name: '肉', quantity: 200, unit: 'g', category: 'main' },
      { name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' },
    ]
    const stock = new Set(['肉', '玉ねぎ'])

    expect(calculateMatchRate(ingredients, stock)).toBe(100)
  })
})
