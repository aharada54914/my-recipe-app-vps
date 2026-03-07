import { describe, expect, it } from 'vitest'
import type { UserPreferences } from '../../db/db'
import { pickCanonicalPreferencesRecord } from '../preferencesRepository'

function makePreference(id: number, updatedAt: string, overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    id,
    appearanceMode: 'system',
    familyCalendarId: undefined,
    mealStartHour: 18,
    mealStartMinute: 0,
    mealEndHour: 19,
    mealEndMinute: 0,
    defaultCalendarId: undefined,
    weeklyMenuGenerationDay: 5,
    weeklyMenuGenerationHour: 18,
    weeklyMenuGenerationMinute: 0,
    shoppingListHour: 19,
    shoppingListMinute: 0,
    seasonalPriority: 'low',
    weeklyMenuCostMode: 'ignore',
    weeklyMenuLuxuryRewardDays: 2,
    lastPriceSyncAt: undefined,
    lastWeatherSyncAt: undefined,
    userPrompt: '',
    notifyWeeklyMenuDone: true,
    notifyShoppingListDone: true,
    cookingNotifyEnabled: true,
    cookingNotifyHour: 16,
    cookingNotifyMinute: 0,
    desiredMealHour: 18,
    desiredMealMinute: 0,
    tOpt: 22,
    weeklyBudgetYen: undefined,
    geminiModelChat: 'gemini-2.0-flash-lite',
    geminiModelRecipeImportText: 'gemini-2.0-flash-lite',
    geminiModelRecipeImportUrl: 'gemini-2.0-flash-lite',
    geminiModelImageIngredientExtract: 'gemini-2.0-flash',
    geminiModelStockRecipeSuggest: 'gemini-2.0-flash',
    geminiModelWeeklyMenuRefine: 'gemini-2.0-flash-lite',
    geminiRetryEscalationForUrlAndImage: true,
    geminiEstimatedDailyLimit: 40,
    updatedAt: new Date(updatedAt),
    ...overrides,
  }
}

describe('pickCanonicalPreferencesRecord', () => {
  it('returns the most recently updated preferences record', () => {
    const canonical = pickCanonicalPreferencesRecord([
      makePreference(1, '2026-03-07T10:00:00Z', { desiredMealHour: 18 }),
      makePreference(2, '2026-03-07T11:00:00Z', { desiredMealHour: 19 }),
    ])

    expect(canonical?.id).toBe(2)
    expect(canonical?.desiredMealHour).toBe(19)
  })

  it('uses the higher id as a tie-breaker when timestamps are equal', () => {
    const canonical = pickCanonicalPreferencesRecord([
      makePreference(4, '2026-03-07T11:00:00Z'),
      makePreference(7, '2026-03-07T11:00:00Z', { desiredMealMinute: 15 }),
    ])

    expect(canonical?.id).toBe(7)
    expect(canonical?.desiredMealMinute).toBe(15)
  })

  it('returns null when there are no records', () => {
    expect(pickCanonicalPreferencesRecord([])).toBeNull()
  })
})
