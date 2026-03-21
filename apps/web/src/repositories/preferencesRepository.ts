import { db, type UserPreferences } from '../db/db'
import { DEFAULT_PREFERENCES } from '../contexts/preferencesContextDef'
import { apiGet, apiPatch, apiPost, getToken } from '../lib/apiClient'
import {
  EditableUserPreferencesSchema,
  type ApiResponse,
  type EditableUserPreferences,
  type UserPreferences as RemoteUserPreferences,
  UserPreferencesSchema,
} from '@kitchen/shared-types'

export function mergeWithDefaultPreferences(
  stored: Partial<UserPreferences> | null | undefined,
): UserPreferences {
  return stored != null
    ? { ...DEFAULT_PREFERENCES, ...stored }
    : { ...DEFAULT_PREFERENCES, updatedAt: new Date() }
}

function normalizeRemotePreferences(
  remote: RemoteUserPreferences,
  currentId?: number,
): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...remote,
    id: currentId,
    lastPriceSyncAt: remote.lastPriceSyncAt ? new Date(remote.lastPriceSyncAt) : undefined,
    lastWeatherSyncAt: remote.lastWeatherSyncAt ? new Date(remote.lastWeatherSyncAt) : undefined,
    updatedAt: new Date(remote.updatedAt),
  }
}

async function writeCanonicalPreferencesRecord(
  nextPreferences: Omit<UserPreferences, 'id'>,
): Promise<UserPreferences> {
  const records = await getAllPreferenceRecords()
  const canonical = await dedupePreferencesRecords(records)

  if (canonical?.id != null) {
    await db.userPreferences.put({
      ...nextPreferences,
      id: canonical.id,
    })
    return {
      ...nextPreferences,
      id: canonical.id,
    }
  }

  const id = await db.userPreferences.add(nextPreferences)
  return {
    ...nextPreferences,
    id,
  }
}

function stripPreferenceId(preferences: UserPreferences): Omit<UserPreferences, 'id'> {
  const { id: _id, ...nextPreferences } = preferences
  return nextPreferences
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
  return writeCanonicalPreferencesRecord(nextPreferences)
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

export function hasRemotePreferencesSession(): boolean {
  const token = getToken()
  return typeof token === 'string' && token.length > 0
}

export async function syncStoredPreferencesFromRemote(): Promise<UserPreferences> {
  const response = await apiGet<ApiResponse<RemoteUserPreferences>>('/api/preferences')
  const parsed = UserPreferencesSchema.parse(response.data)
  const existing = await getStoredPreferences()
  const normalized = normalizeRemotePreferences(parsed, existing?.id)
  return writeCanonicalPreferencesRecord(stripPreferenceId(normalized))
}

function sanitizeEditablePreferences(
  updates: Partial<UserPreferences>,
): EditableUserPreferences {
  const { id: _id, updatedAt: _updatedAt, lastPriceSyncAt: _lastPriceSyncAt, lastWeatherSyncAt: _lastWeatherSyncAt, ...editable } = updates
  return EditableUserPreferencesSchema.parse(editable)
}

export async function updateRemotePreferences(
  updates: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const editableUpdates = sanitizeEditablePreferences(updates)
  const response = await apiPatch<ApiResponse<RemoteUserPreferences>>('/api/preferences', editableUpdates)
  const parsed = UserPreferencesSchema.parse(response.data)
  const existing = await getStoredPreferences()
  const normalized = normalizeRemotePreferences(parsed, existing?.id)
  return writeCanonicalPreferencesRecord(stripPreferenceId(normalized))
}

export async function resetRemotePreferences(): Promise<UserPreferences> {
  const response = await apiPost<ApiResponse<RemoteUserPreferences>>('/api/preferences/reset', {})
  const parsed = UserPreferencesSchema.parse(response.data)
  const existing = await getStoredPreferences()
  const normalized = normalizeRemotePreferences(parsed, existing?.id)
  return writeCanonicalPreferencesRecord(stripPreferenceId(normalized))
}
