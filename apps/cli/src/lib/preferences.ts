import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient, type User } from '@prisma/client'
import type { InputJsonValue } from '@prisma/client/runtime/library'
import {
  EditableUserPreferencesSchema,
  USER_PREFERENCES_DEFAULTS,
  UserPreferencesSchema,
  type EditableUserPreferences,
  type UserPreferences,
} from '@kitchen/shared-types'

const prisma = new PrismaClient()

const EDITABLE_PREFERENCE_KEYS = [
  'appearanceMode',
  'familyCalendarId',
  'mealStartHour',
  'mealStartMinute',
  'mealEndHour',
  'mealEndMinute',
  'defaultCalendarId',
  'weeklyMenuGenerationDay',
  'weeklyMenuGenerationHour',
  'weeklyMenuGenerationMinute',
  'shoppingListHour',
  'shoppingListMinute',
  'seasonalPriority',
  'weeklyMenuCostMode',
  'weeklyMenuLuxuryRewardDays',
  'userPrompt',
  'notifyWeeklyMenuDone',
  'notifyShoppingListDone',
  'cookingNotifyEnabled',
  'cookingNotifyHour',
  'cookingNotifyMinute',
  'desiredMealHour',
  'desiredMealMinute',
  'tOpt',
  'weeklyBudgetYen',
  'geminiModelChat',
  'geminiModelRecipeImportText',
  'geminiModelRecipeImportUrl',
  'geminiModelImageIngredientExtract',
  'geminiModelStockRecipeSuggest',
  'geminiModelWeeklyMenuRefine',
  'geminiRetryEscalationForUrlAndImage',
  'geminiEstimatedDailyLimit',
] as const satisfies ReadonlyArray<keyof EditableUserPreferences>

const BOOLEAN_KEYS = new Set<EditablePreferenceKey>([
  'notifyWeeklyMenuDone',
  'notifyShoppingListDone',
  'cookingNotifyEnabled',
  'geminiRetryEscalationForUrlAndImage',
])

const NUMBER_KEYS = new Set<EditablePreferenceKey>([
  'mealStartHour',
  'mealStartMinute',
  'mealEndHour',
  'mealEndMinute',
  'weeklyMenuGenerationDay',
  'weeklyMenuGenerationHour',
  'weeklyMenuGenerationMinute',
  'shoppingListHour',
  'shoppingListMinute',
  'weeklyMenuLuxuryRewardDays',
  'cookingNotifyHour',
  'cookingNotifyMinute',
  'desiredMealHour',
  'desiredMealMinute',
  'tOpt',
  'weeklyBudgetYen',
  'geminiEstimatedDailyLimit',
])

const OPTIONAL_STRING_KEYS = new Set<EditablePreferenceKey>([
  'familyCalendarId',
  'defaultCalendarId',
])

type EditablePreferenceKey = typeof EDITABLE_PREFERENCE_KEYS[number]

export type UserIdentifier = {
  email?: string
  id?: string
}

type UserWithPreferences = Pick<User, 'id' | 'email' | 'name' | 'preferences'>

export function listEditablePreferenceKeys(): EditablePreferenceKey[] {
  return [...EDITABLE_PREFERENCE_KEYS]
}

export async function getUserPreferences(identifier: UserIdentifier): Promise<{
  user: UserWithPreferences
  preferences: UserPreferences
}> {
  const user = await findUserOrThrow(identifier)
  return {
    user,
    preferences: normalizeUserPreferences(user.preferences),
  }
}

export async function setUserPreference(
  identifier: UserIdentifier,
  key: EditablePreferenceKey,
  rawValue: string,
): Promise<UserPreferences> {
  assertEditablePreferenceKey(key)
  const value = parseEditablePreferenceValue(key, rawValue)
  return updateUserPreferences(identifier, { [key]: value } satisfies Partial<EditableUserPreferences>)
}

export async function updateUserPreferences(
  identifier: UserIdentifier,
  updates: Partial<EditableUserPreferences>,
): Promise<UserPreferences> {
  const user = await findUserOrThrow(identifier)
  const nextPreferences = UserPreferencesSchema.parse({
    ...normalizeUserPreferences(user.preferences),
    ...EditableUserPreferencesSchema.parse(updates),
    updatedAt: new Date(),
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      preferences: toJsonRecord(nextPreferences),
    },
  })

  return nextPreferences
}

export async function resetUserPreferences(identifier: UserIdentifier): Promise<UserPreferences> {
  const user = await findUserOrThrow(identifier)
  const nextPreferences = UserPreferencesSchema.parse({
    ...USER_PREFERENCES_DEFAULTS,
    updatedAt: new Date(),
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      preferences: toJsonRecord(nextPreferences),
    },
  })

  return nextPreferences
}

export async function editUserPreferencesInEditor(identifier: UserIdentifier): Promise<UserPreferences> {
  const { user, preferences } = await getUserPreferences(identifier)
  const editableSnapshot = pickEditablePreferences(preferences)
  const tempDir = await mkdtemp(join(tmpdir(), 'kitchen-prefs-'))
  const filePath = join(tempDir, `${sanitizeFileName(user.email)}-preferences.json`)
  const editor = process.env['EDITOR'] || 'vi'

  try {
    await writeFile(filePath, `${JSON.stringify(editableSnapshot, null, 2)}\n`, 'utf8')
    const result = spawnSync(editor, [filePath], { stdio: 'inherit' })

    if (result.status !== 0) {
      throw new Error(`Editor exited with status ${result.status ?? 'unknown'}`)
    }

    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<EditableUserPreferences>
    return updateUserPreferences(identifier, parsed)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export function formatPreferencesForDisplay(preferences: UserPreferences): string {
  return JSON.stringify(preferences, null, 2)
}

function normalizeUserPreferences(raw: unknown): UserPreferences {
  return UserPreferencesSchema.parse({
    ...USER_PREFERENCES_DEFAULTS,
    ...(isRecord(raw) ? raw : {}),
  })
}

async function findUserOrThrow(identifier: UserIdentifier): Promise<UserWithPreferences> {
  if (!identifier.email && !identifier.id) {
    throw new Error('Specify either --user <email> or --id <google-sub>.')
  }

  const user = await prisma.user.findFirst({
    where: identifier.email
      ? { email: identifier.email }
      : { id: identifier.id },
    select: {
      id: true,
      email: true,
      name: true,
      preferences: true,
    },
  })

  if (!user) {
    throw new Error('User not found.')
  }

  return user
}

function parseEditablePreferenceValue(key: EditablePreferenceKey, rawValue: string): EditableUserPreferences[EditablePreferenceKey] {
  const trimmed = rawValue.trim()

  if (OPTIONAL_STRING_KEYS.has(key) && isNullishLiteral(trimmed)) {
    return undefined
  }

  if (BOOLEAN_KEYS.has(key)) {
    return parseBooleanLiteral(trimmed) as EditableUserPreferences[EditablePreferenceKey]
  }

  if (NUMBER_KEYS.has(key)) {
    if (isNullishLiteral(trimmed)) {
      return undefined as EditableUserPreferences[EditablePreferenceKey]
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid numeric value for ${key}: ${rawValue}`)
    }
    return parsed as EditableUserPreferences[EditablePreferenceKey]
  }

  return trimmed as EditableUserPreferences[EditablePreferenceKey]
}

function assertEditablePreferenceKey(key: string): asserts key is EditablePreferenceKey {
  if (EDITABLE_PREFERENCE_KEYS.includes(key as EditablePreferenceKey)) return
  throw new Error(`Unknown preference key: ${key}`)
}

function parseBooleanLiteral(rawValue: string): boolean {
  const normalized = rawValue.trim().toLowerCase()

  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false

  throw new Error(`Invalid boolean value: ${rawValue}`)
}

function pickEditablePreferences(preferences: UserPreferences): Partial<EditableUserPreferences> {
  const snapshot: Partial<Record<EditablePreferenceKey, EditableUserPreferences[EditablePreferenceKey] | undefined>> = {}

  for (const key of EDITABLE_PREFERENCE_KEYS) {
    snapshot[key] = preferences[key] as EditableUserPreferences[typeof key]
  }

  return snapshot as Partial<EditableUserPreferences>
}

function isNullishLiteral(value: string): boolean {
  return value === '' || value === 'null' || value === 'undefined'
}

function toJsonRecord(value: UserPreferences): InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as InputJsonValue
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
