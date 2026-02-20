import { createContext } from 'react'
import type { UserPreferences } from '../db/db'

export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id'> = {
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
  userPrompt: '',
  notifyWeeklyMenuDone: true,
  notifyShoppingListDone: true,
  cookingNotifyEnabled: true,
  cookingNotifyHour: 16,
  cookingNotifyMinute: 0,
  desiredMealHour: 18,
  desiredMealMinute: 0,
  updatedAt: new Date(),
}

export interface PreferencesContextValue {
  preferences: UserPreferences
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => Promise<void>
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
  resetToDefaults: () => Promise<void>
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
