import type { InputJsonValue } from '@prisma/client/runtime/library'
import {
  EditableUserPreferencesSchema,
  USER_PREFERENCES_DEFAULTS,
  UserPreferencesSchema,
  type EditableUserPreferences,
  type UserPreferences,
} from '@kitchen/shared-types'

export function normalizeUserPreferences(raw: unknown): UserPreferences {
  return UserPreferencesSchema.parse({
    ...USER_PREFERENCES_DEFAULTS,
    ...(isRecord(raw) ? raw : {}),
  })
}

export function buildUpdatedUserPreferences(
  current: unknown,
  updates: Partial<EditableUserPreferences>,
): UserPreferences {
  const parsedUpdates = EditableUserPreferencesSchema.parse(updates)

  return UserPreferencesSchema.parse({
    ...normalizeUserPreferences(current),
    ...parsedUpdates,
    updatedAt: new Date(),
  })
}

export function createDefaultUserPreferences(): UserPreferences {
  return UserPreferencesSchema.parse({
    ...USER_PREFERENCES_DEFAULTS,
    updatedAt: new Date(),
  })
}

export function toUserPreferencesJson(preferences: UserPreferences): InputJsonValue {
  return JSON.parse(JSON.stringify(preferences)) as InputJsonValue
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
