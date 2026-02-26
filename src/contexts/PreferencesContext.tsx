import { useCallback, useEffect, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type UserPreferences } from '../db/db'
import { DEFAULT_PREFERENCES, PreferencesContext } from './preferencesContextDef'
import {
  getGeminiFeatureConfig,
  getGeminiFeatureConfigFromPreferences,
  getGeminiFeaturePreferenceUpdates,
  isDefaultGeminiFeatureConfig,
  setGeminiFeatureConfig,
} from '../lib/geminiSettings'

export type { PreferencesContextValue } from './preferencesContextDef'

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // Return null when loaded-but-empty to distinguish from undefined (still loading)
  const stored = useLiveQuery(async () => {
    const prefs = await db.userPreferences.toCollection().first()
    return prefs ?? null
  })

  // Auto-create default preferences if none exist
  useEffect(() => {
    if (stored === undefined) return // still loading
    if (stored === null) {
      db.userPreferences.add({ ...DEFAULT_PREFERENCES, updatedAt: new Date() })
    }
  }, [stored])

  useEffect(() => {
    if (stored === undefined || stored === null || !stored.id) return

    const prefsConfig = getGeminiFeatureConfigFromPreferences(stored)
    const legacyConfig = getGeminiFeatureConfig()
    const needsBackfill =
      typeof stored.geminiModelChat !== 'string' ||
      typeof stored.geminiModelRecipeImportText !== 'string' ||
      typeof stored.geminiModelRecipeImportUrl !== 'string' ||
      typeof stored.geminiModelImageIngredientExtract !== 'string' ||
      typeof stored.geminiModelStockRecipeSuggest !== 'string' ||
      typeof stored.geminiModelWeeklyMenuRefine !== 'string' ||
      typeof stored.geminiRetryEscalationForUrlAndImage !== 'boolean' ||
      typeof stored.geminiEstimatedDailyLimit !== 'number'

    const migratedConfig =
      needsBackfill && !isDefaultGeminiFeatureConfig(legacyConfig)
        ? legacyConfig
        : prefsConfig

    // Keep synchronous Gemini config readers working while DB-backed preferences are the source of truth.
    setGeminiFeatureConfig(migratedConfig)

    if (needsBackfill) {
      void db.userPreferences.update(stored.id, {
        ...getGeminiFeaturePreferenceUpdates(migratedConfig),
        updatedAt: new Date(),
      })
    }
  }, [stored])

  const preferences: UserPreferences = (stored !== null && stored !== undefined)
    ? stored
    : { ...DEFAULT_PREFERENCES, updatedAt: new Date() }

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
