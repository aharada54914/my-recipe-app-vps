import { db, type WeeklyMenuDailyCandidateLog } from '../db/db'
import {
  WEEKLY_MENU_SELECTOR_STRATEGY,
  WEEKLY_MENU_WEIGHT_PROFILE_VERSION,
} from './weeklyMenuWeightProfile'
import { WEATHER_MODEL_VERSION } from './season-weather/weatherScoring'
import type { WeeklyMenuCostMode } from '../db/db'

interface GenerationLogInput {
  weekStartDate: string
  costMode: WeeklyMenuCostMode
  lockedCount: number
  dailyCandidates: WeeklyMenuDailyCandidateLog[]
}

export async function logWeeklyMenuGeneration(input: GenerationLogInput): Promise<void> {
  await db.weeklyMenuSelectionLogs.add({
    eventType: 'generation',
    weekStartDate: input.weekStartDate,
    strategy: WEEKLY_MENU_SELECTOR_STRATEGY,
    weatherModelVersion: WEATHER_MODEL_VERSION,
    weightProfileVersion: WEEKLY_MENU_WEIGHT_PROFILE_VERSION,
    createdAt: new Date(),
    costMode: input.costMode,
    lockedCount: input.lockedCount,
    dailyCandidates: input.dailyCandidates,
  })
}

interface SwapLogInput {
  weekStartDate: string
  dayIndex: number
  role: 'main' | 'side'
  replacedRecipeId: number
  selectedRecipeId: number
}

export async function logWeeklyMenuSwap(input: SwapLogInput): Promise<void> {
  await db.weeklyMenuSelectionLogs.add({
    eventType: 'swap',
    weekStartDate: input.weekStartDate,
    strategy: WEEKLY_MENU_SELECTOR_STRATEGY,
    weatherModelVersion: WEATHER_MODEL_VERSION,
    weightProfileVersion: WEEKLY_MENU_WEIGHT_PROFILE_VERSION,
    createdAt: new Date(),
    dayIndex: input.dayIndex,
    role: input.role,
    replacedRecipeId: input.replacedRecipeId,
    selectedRecipeId: input.selectedRecipeId,
  })
}

export async function getWeeklyMenuSelectionLogsForExport() {
  return db.weeklyMenuSelectionLogs.orderBy('createdAt').reverse().toArray()
}
