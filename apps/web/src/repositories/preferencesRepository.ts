import { db, type UserPreferences } from '../db/db'
import { DEFAULT_PREFERENCES } from '../contexts/preferencesContextDef'

export function mergeWithDefaultPreferences(
  stored: Partial<UserPreferences> | null | undefined,
): UserPreferences {
  return stored != null
    ? { ...DEFAULT_PREFERENCES, ...stored }
    : { ...DEFAULT_PREFERENCES, updatedAt: new Date() }
}

function getPreferencesUpdatedAtValue(record: Partial<UserPreferences>): number {
  if (record.updatedAt instanceof Date) return record.updatedAt.getTime()
  if (typeof record.updatedAt === 'string' || typeof record.updatedAt === 'number') {
    const timestamp = new Date(record.updatedAt).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
  }
  return 0
}

export function pickCanonicalPreferencesRecord(
  records: Array<Partial<UserPreferences> & { id?: number }>,
): (Partial<UserPreferences> & { id?: number }) | null {
  if (records.length === 0) return null

  return [...records].sort((left, right) => {
    const byUpdatedAt = getPreferencesUpdatedAtValue(right) - getPreferencesUpdatedAtValue(left)
    if (byUpdatedAt !== 0) return byUpdatedAt
    return (right.id ?? 0) - (left.id ?? 0)
  })[0] ?? null
}

async function getAllPreferenceRecords(): Promise<UserPreferences[]> {
  return db.userPreferences.toArray()
}

async function dedupePreferencesRecords(records: UserPreferences[]): Promise<UserPreferences | null> {
  const canonical = pickCanonicalPreferencesRecord(records)
  if (!canonical?.id) return canonical as UserPreferences | null

  const duplicateIds = records
    .map((record) => record.id)
    .filter((id): id is number => id != null && id !== canonical.id)

  if (duplicateIds.length === 0) return canonical as UserPreferences

  await db.transaction('rw', db.userPreferences, async () => {
    await db.userPreferences.bulkDelete(duplicateIds)
  })

  return canonical as UserPreferences
}

export async function getStoredPreferences(): Promise<UserPreferences | null> {
  const records = await getAllPreferenceRecords()
  const canonical = await dedupePreferencesRecords(records)
  return canonical ?? null
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
  const records = await getAllPreferenceRecords()
  const canonical = await dedupePreferencesRecords(records)
  const targetId = canonical?.id ?? id

  if (targetId == null) {
    await ensurePreferencesRecord()
    return updateStoredPreferences(id, updates)
  }

  await db.userPreferences.update(targetId, {
    ...updates,
    updatedAt: new Date(),
  })
}

export async function resetStoredPreferences(id: number): Promise<void> {
  const records = await getAllPreferenceRecords()
  const canonical = await dedupePreferencesRecords(records)
  const targetId = canonical?.id ?? id

  if (targetId == null) {
    await ensurePreferencesRecord()
    return resetStoredPreferences(id)
  }

  await db.userPreferences.update(targetId, {
    ...DEFAULT_PREFERENCES,
    updatedAt: new Date(),
  })
}
