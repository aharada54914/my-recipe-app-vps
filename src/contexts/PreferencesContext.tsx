import { useCallback, useEffect, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type UserPreferences } from '../db/db'
import { DEFAULT_PREFERENCES, PreferencesContext } from './preferencesContextDef'

export type { PreferencesContextValue } from './preferencesContextDef'

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const stored = useLiveQuery(() => db.userPreferences.toCollection().first())

  // Auto-create default preferences if none exist
  useEffect(() => {
    if (stored === undefined) return // still loading
    if (stored === null || stored === undefined) {
      db.userPreferences.add({ ...DEFAULT_PREFERENCES, updatedAt: new Date() })
    }
  }, [stored])

  const preferences: UserPreferences = stored ?? { ...DEFAULT_PREFERENCES, updatedAt: new Date() }

  const updatePreference = useCallback(async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    if (!preferences.id) return
    await db.userPreferences.update(preferences.id, {
      [key]: value,
      updatedAt: new Date(),
    } as Partial<UserPreferences>)
  }, [preferences.id])

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!preferences.id) return
    await db.userPreferences.update(preferences.id, {
      ...updates,
      updatedAt: new Date(),
    })
  }, [preferences.id])

  const resetToDefaults = useCallback(async () => {
    if (!preferences.id) return
    await db.userPreferences.update(preferences.id, {
      ...DEFAULT_PREFERENCES,
      updatedAt: new Date(),
    })
  }, [preferences.id])

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, updatePreferences, resetToDefaults }}>
      {children}
    </PreferencesContext.Provider>
  )
}
