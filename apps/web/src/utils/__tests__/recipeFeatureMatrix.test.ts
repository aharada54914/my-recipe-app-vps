import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngredientFeatureRecord, Recipe, RecipeNutritionMeta } from '../../db/db'

const { mockState, mockBulkPut, mockWhere } = vi.hoisted(() => {
  const mockState = {
    records: [] as IngredientFeatureRecord[],
    failBulkPut: false,
  }

  const mockBulkPut = vi.fn(async (records: IngredientFeatureRecord[]) => {
    if (mockState.failBulkPut) {
      throw new Error("ConstraintError: Unable to add key to index 'recipeId'")
    }

    for (const record of records) {
      const nextId = mockState.records.length + 1
      mockState.records.push({ ...record, id: nextId })
    }
  })

  const mockWhere = vi.fn((indexName: string) => {
    if (indexName !== 'recipeId') {
      throw new Error(`Unexpected index lookup: ${indexName}`)
    }

    return {
      anyOf: (recipeIds: number[]) => ({
        toArray: async () => mockState.records.filter((record) => recipeIds.includes(record.recipeId)),
      }),
    }
  })

  return { mockState, mockBulkPut, mockWhere }
})

vi.mock('../../db/db', () => ({
  db: {
    recipeFeatureMatrix: {
      where: mockWhere,
      bulkPut: mockBulkPut,
    },
  },
}))

import { buildRecipeFeatureRecord, ensureRecipeFeatureMatrix } from '../recipeFeatureMatrix'

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
  beforeEach(() => {
    mockState.records = []
    mockState.failBulkPut = false
    mockBulkPut.mockClear()
    mockWhere.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses same confidence rule for CSV and Gemini recipes', () => {
    const csvRecord = buildRecipeFeatureRecord(makeRecipe({ isUserAdded: false }))
    const geminiNutritionMeta: RecipeNutritionMeta = { confidence: 0.1, lowConfidence: true }
    const geminiRecord = buildRecipeFeatureRecord(makeRecipe({
      isUserAdded: true,
      nutritionMeta: geminiNutritionMeta,
    }))

    expect(csvRecord?.confidence).toBe(1)
    expect(geminiRecord?.confidence).toBe(0.2)
  })

  it('derives price signal from recipe text uniformly', () => {
    const luxuryRecord = buildRecipeFeatureRecord(makeRecipe({ title: '和牛ステーキ' }))
    const savingRecord = buildRecipeFeatureRecord(makeRecipe({ title: '鶏むねともやし炒め' }))

    expect(luxuryRecord?.priceSignalScore).toBeLessThan(savingRecord?.priceSignalScore ?? 0)
  })

  it('reuses existing feature records by recipeId without inserting duplicates', async () => {
    mockState.records = [
      {
        id: 10,
        recipeId: 1,
        confidence: 1,
        source: 'csv',
        updatedAt: new Date('2026-03-07T00:00:00Z'),
        seasonalityScore: 0.5,
        priceSignalScore: 0.9,
      },
    ]

    const result = await ensureRecipeFeatureMatrix([makeRecipe({ id: 1 })])

    expect(mockWhere).toHaveBeenCalledWith('recipeId')
    expect(mockBulkPut).not.toHaveBeenCalled()
    expect(result.get(1)?.id).toBe(10)
  })

  it('deduplicates input recipes and continues when cache persistence fails', async () => {
    mockState.failBulkPut = true

    const recipe = makeRecipe({ id: 7, title: '重複テスト' })

    const result = await ensureRecipeFeatureMatrix([recipe, recipe])

    expect(mockBulkPut).toHaveBeenCalledTimes(1)
    expect(mockBulkPut.mock.calls[0]?.[0]).toHaveLength(1)
    expect(result.size).toBe(1)
    expect(result.get(7)?.recipeId).toBe(7)
  })
})
