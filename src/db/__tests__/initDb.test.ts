import { describe, expect, it } from 'vitest'
import { shouldRunNutritionMaintenance } from '../initDb'

describe('shouldRunNutritionMaintenance', () => {
  it('runs on first boot when recipes are newly seeded', () => {
    expect(shouldRunNutritionMaintenance(0, 'v7')).toBe(true)
  })

  it('runs when stored estimator version is stale', () => {
    expect(shouldRunNutritionMaintenance(12, 'v6')).toBe(true)
  })

  it('skips when recipes exist and estimator version is current', () => {
    expect(shouldRunNutritionMaintenance(12, 'v7')).toBe(false)
  })
})
