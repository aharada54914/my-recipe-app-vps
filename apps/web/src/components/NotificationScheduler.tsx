import { useEffect } from 'react'
import { usePreferences } from '../hooks/usePreferences'
import { db } from '../db/db'
import { showLocalNotification, getNotificationPermission } from '../utils/notifications'
import { getWeekStartDate } from '../utils/weeklyMenuSelector'
import { format } from 'date-fns'

const CHECK_INTERVAL_MS = 30000

function getTodayKey(prefix: string, date: Date): string {
  return `${prefix}_${format(date, 'yyyy-MM-dd')}`
}

export function NotificationScheduler() {
  const { preferences } = usePreferences()

  useEffect(() => {
    if (!preferences.cookingNotifyEnabled) return
    if (getNotificationPermission() !== 'granted') return

    let cancelled = false

    const tick = async () => {
      if (cancelled) return

      const now = new Date()
      const isTargetMinute =
        now.getHours() === preferences.cookingNotifyHour &&
        now.getMinutes() === preferences.cookingNotifyMinute

      if (!isTargetMinute) return

      const dedupeKey = `${getTodayKey('cook_notify', now)}_${preferences.cookingNotifyHour}:${preferences.cookingNotifyMinute}`
      if (localStorage.getItem(dedupeKey) === '1') return

      const weekStart = format(getWeekStartDate(now), 'yyyy-MM-dd')
      const today = format(now, 'yyyy-MM-dd')
      const menu = await db.weeklyMenus.where('weekStartDate').equals(weekStart).first()
      const todayItem = menu?.items.find((i) => i.date === today)

      if (!todayItem) {
        localStorage.setItem(dedupeKey, '1')
        return
      }

      const recipe = await db.recipes.get(todayItem.recipeId)
      const title = recipe?.title ?? '今日の献立'
      const body = recipe
        ? `${title} の調理を始める時間です。`
        : '今日の調理開始タイミングです。'

      const ok = await showLocalNotification({
        title: 'Kitchen App 調理開始通知',
        body,
        tag: `cooking_${today}`,
      })
      if (ok) localStorage.setItem(dedupeKey, '1')
    }

    tick()
    const timer = window.setInterval(tick, CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [
    preferences.cookingNotifyEnabled,
    preferences.cookingNotifyHour,
    preferences.cookingNotifyMinute,
  ])

  return null
}
