import { createContext } from 'react'
import type { AppearanceMode, UserPreferences } from '../db/db'
import type { ResolvedTheme } from '../lib/theme'

export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id'> = {
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
  updatedAt: new Date(),
}

export interface PreferencesContextValue {
  preferences: UserPreferences
  resolvedTheme: ResolvedTheme
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => Promise<void>
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
  setAppearanceMode: (mode: AppearanceMode) => Promise<void>
  resetToDefaults: () => Promise<void>
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
