import { getLocalDateString } from '../lib/date.js'
import { getWeeklyMenuData, type TodayMenuResourceData } from './weeklyMenu.js'

export async function getTodayMenuData(userId: string): Promise<TodayMenuResourceData> {
  const today = getLocalDateString()
  const weeklyMenu = await getWeeklyMenuData({ userId })
  const item = weeklyMenu.items.find((entry) => entry.date === today) ?? null

  return {
    userId,
    weekStartDate: weeklyMenu.weekStartDate,
    date: today,
    item,
    ...(item == null ? { message: weeklyMenu.message ?? '今日の献立は未設定です。' } : {}),
  }
}

export async function readTodayMenuResource(userId: string): Promise<string> {
  return JSON.stringify(await getTodayMenuData(userId), null, 2)
}
