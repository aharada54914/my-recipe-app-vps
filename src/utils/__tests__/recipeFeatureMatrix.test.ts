import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../db/db'
import { buildRecipeFeatureRecord } from '../recipeFeatureMatrix'

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 1,
    title: '鶏むね肉サラダ',
    recipeNumber: 'R-1',
    device: 'manual',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 500,
    ingredients: [{ name: '鶏むね肉', quantity: 1, unit: '枚', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 10 }],
    totalTimeMinutes: 10,
    ...overrides,
  }
}

describe('recipeFeatureMatrix', () => {
  it('uses same confidence rule for CSV and Gemini recipes', () => {
    const csvRecord = buildRecipeFeatureRecord(makeRecipe({ isUserAdded: false }))
    const geminiRecord = buildRecipeFeatureRecord(makeRecipe({
      isUserAdded: true,
      nutritionMeta: { confidence: 0.1, lowConfidence: true } as any,
    }))

    expect(csvRecord?.confidence).toBe(1)
    expect(geminiRecord?.confidence).toBe(0.2)
  })

  it('derives price signal from recipe text uniformly', () => {
    const luxuryRecord = buildRecipeFeatureRecord(makeRecipe({ title: '和牛ステーキ' }))
    const savingRecord = buildRecipeFeatureRecord(makeRecipe({ title: '鶏むねともやし炒め' }))

    expect(luxuryRecord?.priceSignalScore).toBeLessThan(savingRecord?.priceSignalScore ?? 0)
  })
})
