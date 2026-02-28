import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGenerateGeminiText } = vi.hoisted(() => ({
  mockGenerateGeminiText: vi.fn(),
}))

vi.mock('../../lib/geminiClient', () => ({
  generateGeminiText: mockGenerateGeminiText,
  extractJsonObjectText: (text: string) => text,
}))

import { generateRecipesFromIngredients } from '../geminiMenuGenerator'

function recipeJson(title: string, withNutrition = true): string {
  return JSON.stringify({
    recipes: [
      {
        title,
        device: 'manual',
        category: '主菜',
        baseServings: 2,
        totalWeightG: 600,
        ingredients: [
          { name: '鶏肉', quantity: 200, unit: 'g', category: 'main', optional: false },
          { name: '玉ねぎ', quantity: 1, unit: '個', category: 'main', optional: false },
          { name: '醤油', quantity: 1, unit: '大さじ', category: 'sub', optional: false },
        ],
        steps: [
          { name: '切る', durationMinutes: 5, isDeviceStep: false },
          { name: '焼く', durationMinutes: 10, isDeviceStep: false },
        ],
        ...(withNutrition
          ? {
              nutritionPerServing: {
                servingSizeG: 300,
                energyKcal: 480,
                proteinG: 24,
                fatG: 17,
                carbG: 42,
                saltEquivalentG: 2.1,
              },
            }
          : {}),
        totalTimeMinutes: 15,
      },
    ],
  })
}

describe('generateRecipesFromIngredients', () => {
  beforeEach(() => {
    mockGenerateGeminiText.mockReset()
  })

  it('returns recipes when nutrition fields are present', async () => {
    mockGenerateGeminiText.mockResolvedValue(recipeJson('栄養ありレシピ'))
    const recipes = await generateRecipesFromIngredients(['鶏肉', '玉ねぎ'])
    expect(recipes).toHaveLength(1)
    expect(recipes[0].nutritionPerServing?.proteinG).toBe(24)
    expect(mockGenerateGeminiText).toHaveBeenCalledTimes(1)
  })

  it('retries with repair prompt when nutrition fields are missing', async () => {
    mockGenerateGeminiText
      .mockResolvedValueOnce(recipeJson('初回欠損レシピ', false))
      .mockResolvedValueOnce(recipeJson('修正後レシピ', true))

    const recipes = await generateRecipesFromIngredients(['鶏肉', '玉ねぎ'])

    expect(recipes).toHaveLength(1)
    expect(recipes[0].nutritionPerServing?.energyKcal).toBe(480)
    expect(mockGenerateGeminiText).toHaveBeenCalledTimes(2)
  })
})
