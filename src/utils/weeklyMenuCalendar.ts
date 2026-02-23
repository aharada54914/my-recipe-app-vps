/**
 * Weekly Menu Calendar Batch Registration
 *
 * Registers 7 days of meals to Google Calendar with cooking reminders.
 */

import { db, type WeeklyMenu, type Recipe, type UserPreferences } from '../db/db'
import { createCalendarEvent, type CalendarEventInput } from '../lib/googleCalendar'
import { format, parse, setHours, setMinutes, subMinutes } from 'date-fns'
import { adjustIngredients, formatQuantityVibe } from './recipeUtils'

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

  const formatIngredientsBlock = (recipe: Recipe, targetServings: number | undefined): string => {
    const servings = targetServings ?? recipe.baseServings
    const adjusted = adjustIngredients(recipe.ingredients, recipe.baseServings, servings)
    const rows = adjusted
      .map((ing) => `・${ing.name} ${formatQuantityVibe(ing.quantity, ing.unit)}`)
      .join('\n')

    return [
      `【${recipe.category}】${recipe.title}（${servings}人分）`,
      `調理時間: ${recipe.totalTimeMinutes}分`,
      recipe.sourceUrl ? `URL: ${recipe.sourceUrl}` : '',
      '材料:',
      rows,
    ].filter(Boolean).join('\n')
  }

  for (const item of menu.items) {
    const mainRecipe = recipeMap.get(item.recipeId)
    if (!mainRecipe) {
      result.errors.push(`レシピID ${item.recipeId} が見つかりません`)
      continue
    }
    const sideRecipe = item.sideRecipeId != null ? recipeMap.get(item.sideRecipeId) : undefined

    try {
      const eventDate = parse(item.date, 'yyyy-MM-dd', new Date())

      // Set meal time from preferences
      const startTime = setMinutes(setHours(eventDate, preferences.mealStartHour), preferences.mealStartMinute)
      const endTime = setMinutes(setHours(eventDate, preferences.mealEndHour), preferences.mealEndMinute)

      const descriptionParts = [
        `この予定は主菜と副菜/スープを1つのイベントにまとめています。`,
        '',
        formatIngredientsBlock(mainRecipe, item.mainServings),
      ]
      if (sideRecipe) {
        descriptionParts.push('', formatIngredientsBlock(sideRecipe, item.sideServings))
      }
      const description = descriptionParts.join('\n')

      // Calculate cooking reminder
      const reminders: CalendarEventInput['reminders'] = { useDefault: false }
      if (preferences.cookingNotifyEnabled) {
        const desiredMealTime = setMinutes(
          setHours(eventDate, preferences.desiredMealHour),
          preferences.desiredMealMinute
        )
        const cookingLeadMinutes = sideRecipe
          ? Math.max(mainRecipe.totalTimeMinutes, sideRecipe.totalTimeMinutes)
          : mainRecipe.totalTimeMinutes
        const cookingStartTime = subMinutes(desiredMealTime, cookingLeadMinutes)
        const minutesBefore = Math.max(
          0,
          Math.round((startTime.getTime() - cookingStartTime.getTime()) / 60000)
        )

        if (minutesBefore > 0 && minutesBefore <= 40320) {
          reminders.overrides = [{ method: 'popup', minutes: minutesBefore }]
        }
      }

      const summary = sideRecipe
        ? `夕食: ${mainRecipe.title} + ${sideRecipe.title}`
        : `夕食: ${mainRecipe.title}`

      const event: CalendarEventInput = {
        summary,
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
        `${mainRecipe.title}: ${err instanceof Error ? err.message : String(err)}`
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
