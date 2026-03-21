/**
 * Weekly Menu Calendar Batch Registration
 *
 * Registers 7 days of meals to Google Calendar with cooking reminders.
 */

import { db, type WeeklyMenu, type Recipe, type UserPreferences } from '../db/db'
import { createCalendarEvent, buildWeeklyShoppingEventInput, type CalendarEventInput } from '../lib/googleCalendar'
import { uploadQrImageToDrive } from '../lib/googleDrive'
import { encodeWeeklyMenuQr, buildMenuImportUrl } from './weeklyMenuQr'
import QRCode from 'qrcode'
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
 * Also generates a QR code, uploads it to Drive, and attaches it to the event.
 */
export async function registerShoppingListToCalendar(
  token: string,
  shoppingListText: string,
  date: Date,
  preferences: UserPreferences,
  menu?: WeeklyMenu,
  recipeMap?: Map<number, Recipe>,
): Promise<string | null> {
  const calendarId = preferences.defaultCalendarId ?? 'primary'
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const startTime = setMinutes(setHours(date, preferences.shoppingListHour), preferences.shoppingListMinute)

  const weekLabel = format(date, 'M/d')

  // Build QR import URL
  let importUrl = ''
  let driveFileUrl = ''

  if (menu && recipeMap && recipeMap.size > 0) {
    try {
      const encoded = encodeWeeklyMenuQr(menu.weekStartDate, menu.items, recipeMap)
      importUrl = buildMenuImportUrl(encoded)

      // Generate QR image PNG
      const pngDataUrl = await QRCode.toDataURL(importUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
      })

      // Upload to Drive (best-effort: don't fail the whole flow if this fails)
      try {
        const uploaded = await uploadQrImageToDrive(
          token,
          pngDataUrl,
          `weekly-menu-${menu.weekStartDate}.png`,
        )
        driveFileUrl = uploaded.webViewLink
      } catch {
        // Drive upload failed — proceed without image attachment
      }
    } catch {
      // QR generation failed — proceed without QR
    }
  }

  // Use new event builder if we have QR data, otherwise fall back to simple event
  let event: CalendarEventInput
  if (importUrl) {
    event = buildWeeklyShoppingEventInput({
      weekLabel,
      shoppingText: shoppingListText,
      importUrl,
      driveFileUrl,
      eventTime: startTime,
      timeZone,
    })
  } else {
    const endTime = new Date(startTime.getTime() + 5 * 60000)
    event = {
      summary: `🛒 週間買い物リスト (${weekLabel}〜)`,
      description: shoppingListText,
      start: { dateTime: startTime.toISOString(), timeZone },
      end: { dateTime: endTime.toISOString(), timeZone },
      reminders: { useDefault: true },
    }
  }

  try {
    const created = await createCalendarEvent(
      token,
      calendarId,
      event,
      driveFileUrl ? { supportsAttachments: true } : undefined,
    )
    return created.id
  } catch {
    return null
  }
}
