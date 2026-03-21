import { describe, expect, it } from 'vitest'
import { getMissingRequiredNutritionFields, validateRequiredNutrition } from '../nutritionValidation'

describe('nutritionValidation', () => {
  it('returns missing fields when nutrition is undefined', () => {
    const missing = getMissingRequiredNutritionFields(undefined)
    expect(missing).toContain('servingSizeG')
    expect(missing).toContain('saltEquivalentG|sodiumMg')
  })

  it('passes when required fields are present', () => {
    const result = validateRequiredNutrition({
      nutritionPerServing: {
        servingSizeG: 250,
        energyKcal: 480,
        proteinG: 22,
        fatG: 18,
        carbG: 46,
        saltEquivalentG: 2.4,
      },
    })
    expect(result.ok).toBe(true)
    expect(result.missingFields).toHaveLength(0)
  })

  it('accepts sodiumMg as alternative to saltEquivalentG', () => {
    const result = validateRequiredNutrition({
      nutritionPerServing: {
        servingSizeG: 250,
        energyKcal: 480,
        proteinG: 22,
        fatG: 18,
        carbG: 46,
        sodiumMg: 700,
      },
    })
    expect(result.ok).toBe(true)
  })
})
