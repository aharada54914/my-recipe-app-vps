/**
 * Weekly Menu Calendar Batch Registration
 *
 * Registers 7 days of meals to Google Calendar with cooking reminders.
 */

import { db, type WeeklyMenu, type Recipe, type UserPreferences } from '../db/db'
import { createCalendarEvent, type CalendarEventInput } from '../lib/googleCalendar'
import { format, parse, setHours, setMinutes, subMinutes } from 'date-fns'

interface RegistrationResult {
  registered: number
  errors: string[]
}

/**
 * Register all weekly menu items to Google Calendar.
 * Also creates cooking start reminders if enabled.
 */
export async function registerWeeklyMenuToCalendar(
  token: string,
  menu: WeeklyMenu,
  recipes: Recipe[],
  preferences: UserPreferences
): Promise<RegistrationResult> {
  const result: RegistrationResult = { registered: 0, errors: [] }

  const calendarId = preferences.defaultCalendarId ?? 'primary'
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const recipeMap = new Map(recipes.map(r => [r.id!, r]))

  for (const item of menu.items) {
    const recipe = recipeMap.get(item.recipeId)
    if (!recipe) {
      result.errors.push(`レシピID ${item.recipeId} が見つかりません`)
      continue
    }

    try {
      const eventDate = parse(item.date, 'yyyy-MM-dd', new Date())

      // Set meal time from preferences
      const startTime = setMinutes(setHours(eventDate, preferences.mealStartHour), preferences.mealStartMinute)
      const endTime = setMinutes(setHours(eventDate, preferences.mealEndHour), preferences.mealEndMinute)

      // Build description with ingredients
      const ingredientList = recipe.ingredients
        .map(ing => `・${ing.name} ${typeof ing.quantity === 'number' && ing.quantity > 0 ? `${ing.quantity}${ing.unit}` : ing.unit}`)
        .join('\n')

      const description = [
        `調理時間: ${recipe.totalTimeMinutes}分`,
        recipe.sourceUrl ? `レシピURL: ${recipe.sourceUrl}` : '',
        '',
        '材料:',
        ingredientList,
      ].filter(Boolean).join('\n')

      // Calculate cooking reminder
      const reminders: CalendarEventInput['reminders'] = { useDefault: false }
      if (preferences.cookingNotifyEnabled) {
        const desiredMealTime = setMinutes(
          setHours(eventDate, preferences.desiredMealHour),
          preferences.desiredMealMinute
        )
        const cookingStartTime = subMinutes(desiredMealTime, recipe.totalTimeMinutes)
        const minutesBefore = Math.max(
          0,
          Math.round((startTime.getTime() - cookingStartTime.getTime()) / 60000)
        )

        if (minutesBefore > 0 && minutesBefore <= 40320) {
          reminders.overrides = [{ method: 'popup', minutes: minutesBefore }]
        }
      }

      const event: CalendarEventInput = {
        summary: `夕食: ${recipe.title}`,
        description,
        start: { dateTime: startTime.toISOString(), timeZone },
        end: { dateTime: endTime.toISOString(), timeZone },
        reminders,
      }

      const created = await createCalendarEvent(token, calendarId, event)

      // Save to local DB
      await db.calendarEvents.add({
        recipeId: item.recipeId,
        googleEventId: created.id,
        calendarId,
        eventType: 'meal',
        startTime,
        endTime,
        createdAt: new Date(),
      })

      result.registered++
    } catch (err) {
      result.errors.push(
        `${recipe.title}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // Update menu status
  if (menu.id != null) {
    await db.weeklyMenus.update(menu.id, {
      status: 'registered',
      updatedAt: new Date(),
    })
  }

  return result
}

/**
 * Register a consolidated shopping list as a calendar event.
 */
export async function registerShoppingListToCalendar(
  token: string,
  shoppingListText: string,
  date: Date,
  preferences: UserPreferences
): Promise<string | null> {
  const calendarId = preferences.defaultCalendarId ?? 'primary'
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const startTime = setMinutes(setHours(date, preferences.shoppingListHour), preferences.shoppingListMinute)
  const endTime = new Date(startTime.getTime() + 5 * 60000) // 5 minutes

  const event: CalendarEventInput = {
    summary: `🛒 週間買い物リスト (${format(date, 'M/d')}〜)`,
    description: shoppingListText,
    start: { dateTime: startTime.toISOString(), timeZone },
    end: { dateTime: endTime.toISOString(), timeZone },
    reminders: { useDefault: true },
  }

  try {
    const created = await createCalendarEvent(token, calendarId, event)
    return created.id
  } catch {
    return null
  }
}
