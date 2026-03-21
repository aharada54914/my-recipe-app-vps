import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserPreferences } from '../../db/db'
import { db } from '../../db/db'
import {
  pickCanonicalPreferencesRecord,
  syncStoredPreferencesFromRemote,
  updateRemotePreferences,
} from '../preferencesRepository'

const apiClientMocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  getToken: vi.fn(),
}))

vi.mock('../../lib/apiClient', () => apiClientMocks)

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
  beforeEach(async () => {
    apiClientMocks.apiGet.mockReset()
    apiClientMocks.apiPatch.mockReset()
    apiClientMocks.apiPost.mockReset()
    apiClientMocks.getToken.mockReset()
    await db.userPreferences.clear()
  })

  afterEach(async () => {
    await db.userPreferences.clear()
  })

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

  it('hydrates Dexie from remote preferences and preserves the canonical id', async () => {
    await db.userPreferences.add(makePreference(3, '2026-03-07T09:00:00Z', {
      desiredMealHour: 17,
      updatedAt: new Date('2026-03-07T09:00:00Z'),
    }))

    apiClientMocks.apiGet.mockResolvedValue({
      success: true,
      data: {
        ...makePreference(999, '2026-03-07T12:00:00Z', {
          desiredMealHour: 20,
          weeklyBudgetYen: 9000,
        }),
        id: undefined,
      },
    })

    const synced = await syncStoredPreferencesFromRemote()

    expect(synced.id).toBe(3)
    expect(synced.desiredMealHour).toBe(20)
    expect(synced.weeklyBudgetYen).toBe(9000)
    expect(synced.updatedAt).toBeInstanceOf(Date)

    const stored = await db.userPreferences.get(3)
    expect(stored?.desiredMealHour).toBe(20)
    expect(stored?.weeklyBudgetYen).toBe(9000)
  })

  it('sends only editable fields when updating remote preferences', async () => {
    await db.userPreferences.add(makePreference(5, '2026-03-07T09:00:00Z'))

    apiClientMocks.apiPatch.mockResolvedValue({
      success: true,
      data: {
        ...makePreference(999, '2026-03-07T13:00:00Z', {
          appearanceMode: 'dark',
          desiredMealHour: 21,
        }),
        id: undefined,
      },
    })

    const updated = await updateRemotePreferences({
      id: 5,
      appearanceMode: 'dark',
      desiredMealHour: 21,
      updatedAt: new Date('2026-03-07T13:00:00Z'),
      lastPriceSyncAt: new Date('2026-03-07T13:00:00Z'),
    })

    expect(apiClientMocks.apiPatch).toHaveBeenCalledWith('/api/preferences', {
      appearanceMode: 'dark',
      desiredMealHour: 21,
    })
    expect(updated.id).toBe(5)
    expect(updated.appearanceMode).toBe('dark')
    expect(updated.desiredMealHour).toBe(21)
  })
})
