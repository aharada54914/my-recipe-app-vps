import type { UserPreferences } from '../db/db'
import { updateStoredPreferences } from '../repositories/preferencesRepository'
import {
  getGeminiFeatureConfig,
  getGeminiFeatureConfigFromPreferences,
  getGeminiFeaturePreferenceUpdates,
  isDefaultGeminiFeatureConfig,
  setGeminiFeatureConfig,
} from '../lib/geminiSettings'
import { runStartupPriceSync } from '../utils/cost/startupPriceSync'

function resolveGeminiBackfillConfig(stored: UserPreferences) {
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

  return { migratedConfig, needsBackfill }
}

export async function runPreferencesStartupTasks(stored: UserPreferences): Promise<void> {
  const { migratedConfig, needsBackfill } = resolveGeminiBackfillConfig(stored)

  // Keep synchronous Gemini readers aligned with DB-backed preferences.
  setGeminiFeatureConfig(migratedConfig)

  if (needsBackfill && stored.id != null) {
    await updateStoredPreferences(stored.id, getGeminiFeaturePreferenceUpdates(migratedConfig))
  }

  if (stored.id == null) return

  const result = await runStartupPriceSync(stored.lastPriceSyncAt)
  if (!result.synced) return

  await updateStoredPreferences(stored.id, {
    lastPriceSyncAt: new Date(),
  })
}
