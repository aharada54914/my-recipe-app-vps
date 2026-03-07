import { db, type UserPreferences } from '../db/db'
import { DEFAULT_PREFERENCES } from '../contexts/preferencesContextDef'

export function mergeWithDefaultPreferences(
  stored: Partial<UserPreferences> | null | undefined,
): UserPreferences {
  return stored != null
    ? { ...DEFAULT_PREFERENCES, ...stored }
    : { ...DEFAULT_PREFERENCES, updatedAt: new Date() }
}

export async function getStoredPreferences(): Promise<UserPreferences | null> {
  const prefs = await db.userPreferences.toCollection().first()
  return prefs ?? null
}

export async function ensurePreferencesRecord(): Promise<UserPreferences> {
  const existing = await getStoredPreferences()
  if (existing) return mergeWithDefaultPreferences(existing)

  const nextPreferences: Omit<UserPreferences, 'id'> = {
    ...DEFAULT_PREFERENCES,
    updatedAt: new Date(),
  }
  const id = await db.userPreferences.add(nextPreferences)
  return { ...nextPreferences, id }
}

export async function updateStoredPreferences(id: number, updates: Partial<UserPreferences>): Promise<void> {
  await db.userPreferences.update(id, {
    ...updates,
    updatedAt: new Date(),
  })
}

export async function resetStoredPreferences(id: number): Promise<void> {
  await db.userPreferences.update(id, {
    ...DEFAULT_PREFERENCES,
    updatedAt: new Date(),
  })
}
