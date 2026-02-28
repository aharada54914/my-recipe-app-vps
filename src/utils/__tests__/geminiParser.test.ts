import { describe, it, expect } from 'vitest'
import { validateParsedRecipe } from '../geminiParser'

describe('validateParsedRecipe', () => {
  const validData = {
    title: 'テスト料理',
    device: 'hotcook',
    category: '主菜',
    baseServings: 4,
    totalWeightG: 800,
    ingredients: [
      { name: '肉', quantity: 200, unit: 'g', category: 'main' },
    ],
    steps: [
      { name: '下ごしらえ', durationMinutes: 10 },
    ],
    totalTimeMinutes: 10,
  }

  it('validates correct data', () => {
    const result = validateParsedRecipe(validData)
    expect(result.title).toBe('テスト料理')
    expect(result.device).toBe('hotcook')
    expect(result.category).toBe('主菜')
    expect(result.baseServings).toBe(4)
    expect(result.ingredients).toHaveLength(1)
    expect(result.steps).toHaveLength(1)
  })

  it('throws for non-object', () => {
    expect(() => validateParsedRecipe(null)).toThrow()
    expect(() => validateParsedRecipe('string')).toThrow()
  })

  it('throws for missing title', () => {
    expect(() => validateParsedRecipe({ ...validData, title: undefined })).toThrow('title')
  })

  it('throws for empty ingredients', () => {
    expect(() => validateParsedRecipe({ ...validData, ingredients: [] })).toThrow('ingredients')
  })

  it('throws for empty steps', () => {
    expect(() => validateParsedRecipe({ ...validData, steps: [] })).toThrow('steps')
  })

  it('defaults device to manual for invalid value', () => {
    const result = validateParsedRecipe({ ...validData, device: 'invalid' })
    expect(result.device).toBe('manual')
  })

  it('defaults category to 主菜 for invalid value', () => {
    const result = validateParsedRecipe({ ...validData, category: 'invalid' })
    expect(result.category).toBe('主菜')
  })

  it('defaults baseServings to 2 when missing', () => {
    const result = validateParsedRecipe({ ...validData, baseServings: undefined })
    expect(result.baseServings).toBe(2)
  })

  it('defaults totalWeightG to 500 when missing', () => {
    const result = validateParsedRecipe({ ...validData, totalWeightG: undefined })
    expect(result.totalWeightG).toBe(500)
  })

  it('calculates totalTimeMinutes from steps when missing', () => {
    const data = {
      ...validData,
      totalTimeMinutes: undefined,
      steps: [
        { name: 'A', durationMinutes: 10 },
        { name: 'B', durationMinutes: 20 },
      ],
    }
    const result = validateParsedRecipe(data)
    expect(result.totalTimeMinutes).toBe(30)
  })

  it('validates ingredient fields', () => {
    const data = {
      ...validData,
      ingredients: [{ name: 123, quantity: 'not a number', unit: 'g', category: 'main' }],
    }
    expect(() => validateParsedRecipe(data)).toThrow('ingredients[0].name')
  })

  it('validates step fields', () => {
    const data = {
      ...validData,
      steps: [{ name: '', durationMinutes: 10 }],
    }
    expect(() => validateParsedRecipe(data)).toThrow('steps[0].name')
  })

  it('defaults ingredient category to main for invalid value', () => {
    const data = {
      ...validData,
      ingredients: [{ name: '肉', quantity: 200, unit: 'g', category: 'invalid' }],
    }
    const result = validateParsedRecipe(data)
    expect(result.ingredients[0].category).toBe('main')
  })

  it('preserves optional flag on ingredients', () => {
    const data = {
      ...validData,
      ingredients: [{ name: '肉', quantity: 200, unit: 'g', category: 'main', optional: true }],
    }
    const result = validateParsedRecipe(data)
    expect(result.ingredients[0].optional).toBe(true)
  })

  it('preserves isDeviceStep flag on steps', () => {
    const data = {
      ...validData,
      steps: [{ name: '調理', durationMinutes: 30, isDeviceStep: true }],
    }
    const result = validateParsedRecipe(data)
    expect(result.steps[0].isDeviceStep).toBe(true)
  })

  it('preserves nutritionPerServing when provided', () => {
    const data = {
      ...validData,
      nutritionPerServing: {
        servingSizeG: 280,
        energyKcal: 420,
        proteinG: 24,
        fatG: 16,
        carbG: 38,
        saltEquivalentG: 2.1,
      },
    }
    const result = validateParsedRecipe(data)
    expect(result.nutritionPerServing?.energyKcal).toBe(420)
    expect(result.nutritionPerServing?.proteinG).toBe(24)
  })
})
