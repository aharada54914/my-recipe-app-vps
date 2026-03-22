import { google } from 'googleapis'
import { prisma } from '../db/client.js'
import {
  type Ingredient,
  type SortedShoppingList,
  type WeeklyMenuItem,
} from '@kitchen/shared-types'
import { normalizeUserPreferences } from './userPreferences.js'

function buildCalendarOAuth2Client() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']
  return clientId && clientSecret && redirectUri
    ? new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    : new google.auth.OAuth2()
}

async function getAuthenticatedCalendar(userId: string) {
  const user = await resolveCalendarUser(userId)

  const oauth2Client = buildCalendarOAuth2Client()
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken ?? undefined,
  })

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token ?? undefined,
        },
      })
    }
  })

  return {
    calendar: google.calendar({ version: 'v3', auth: oauth2Client }),
    preferences: normalizeUserPreferences(user.preferences),
  }
}

async function resolveCalendarUser(userId: string): Promise<{
  id: string
  googleAccessToken: string
  googleRefreshToken: string | null
  preferences: unknown
}> {
  const directUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      preferences: true,
    },
  })

  if (directUser?.googleAccessToken) {
    return directUser as {
      id: string
      googleAccessToken: string
      googleRefreshToken: string | null
      preferences: unknown
    }
  }

  const fallbackUsers = await prisma.user.findMany({
    where: {
      googleAccessToken: {
        not: null,
      },
    },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      preferences: true,
    },
  })

  if (fallbackUsers.length === 1 && fallbackUsers[0]?.googleAccessToken) {
    return fallbackUsers[0] as {
      id: string
      googleAccessToken: string
      googleRefreshToken: string | null
      preferences: unknown
    }
  }

  if (fallbackUsers.length > 1) {
    throw new Error('Google連携済みユーザーが複数います。DiscordユーザーとGoogleアカウントの明示的な紐付けが必要です。')
  }

  throw new Error('User has no Google tokens. Please re-authenticate.')
}

function formatIngredientLines(
  ingredients: Ingredient[],
  baseServings: number,
  targetServings: number,
): string {
  if (ingredients.length === 0) return '材料情報なし'

  return ingredients
    .slice(0, 12)
    .map((ingredient) => {
      const rawQuantity = ingredient.quantity
      const adjustedQuantity = typeof rawQuantity === 'number'
        ? Math.round((rawQuantity * targetServings / baseServings) * 10) / 10
        : rawQuantity
      return `・${ingredient.name} ${adjustedQuantity}${ingredient.unit}`
    })
    .join('\n')
}

export async function registerWeeklyMenuToFamilyCalendar(input: {
  userId: string
  weekStartDate: string
  items: WeeklyMenuItem[]
}): Promise<{
  calendarId: string
  registeredCount: number
  eventIds: string[]
  errors: string[]
}> {
  const { calendar, preferences } = await getAuthenticatedCalendar(input.userId)
  const familyCalendarId = preferences.familyCalendarId?.trim()

  if (!familyCalendarId) {
    throw new Error('家族カレンダーが未設定です。設定 → 接続 で登録先を選んでください。')
  }

  const recipeIds = [
    ...input.items.map((item) => item.recipeId),
    ...input.items.flatMap((item) => item.sideRecipeId != null ? [item.sideRecipeId] : []),
  ]
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: {
      id: true,
      title: true,
      category: true,
      baseServings: true,
      totalTimeMinutes: true,
      ingredients: true,
      sourceUrl: true,
    },
  })
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]))

  const eventIds: string[] = []
  const errors: string[] = []

  for (const item of input.items) {
    const mainRecipe = recipeMap.get(item.recipeId)
    if (!mainRecipe) {
      errors.push(`レシピID ${item.recipeId} が見つかりません`)
      continue
    }
    const sideRecipe = item.sideRecipeId != null ? recipeMap.get(item.sideRecipeId) : undefined
    const summary = sideRecipe
      ? `夕食: ${mainRecipe.title} + ${sideRecipe?.title ?? ''}`.trim()
      : `夕食: ${mainRecipe.title}`
    const description = [
      `${item.date} の夕食予定`,
      `人数: ${item.mainServings ?? mainRecipe.baseServings}人分`,
      '',
      `【主菜】${mainRecipe.title}`,
      formatIngredientLines(
        Array.isArray(mainRecipe.ingredients) ? mainRecipe.ingredients as Ingredient[] : [],
        mainRecipe.baseServings,
        item.mainServings ?? mainRecipe.baseServings,
      ),
      ...(mainRecipe.sourceUrl ? ['', `URL: ${mainRecipe.sourceUrl}`] : []),
      ...(sideRecipe ? [
        '',
        `【副菜】${sideRecipe.title}`,
        formatIngredientLines(
          Array.isArray(sideRecipe.ingredients) ? sideRecipe.ingredients as Ingredient[] : [],
          sideRecipe.baseServings,
          item.sideServings ?? sideRecipe.baseServings,
        ),
      ] : []),
    ].join('\n')

    const startDateTime = `${item.date}T${String(preferences.mealStartHour).padStart(2, '0')}:${String(preferences.mealStartMinute).padStart(2, '0')}:00+09:00`
    const endDateTime = `${item.date}T${String(preferences.mealEndHour).padStart(2, '0')}:${String(preferences.mealEndMinute).padStart(2, '0')}:00+09:00`

    try {
      const event = await calendar.events.insert({
        calendarId: familyCalendarId,
        requestBody: {
          summary,
          description,
          start: {
            dateTime: startDateTime,
            timeZone: 'Asia/Tokyo',
          },
          end: {
            dateTime: endDateTime,
            timeZone: 'Asia/Tokyo',
          },
          reminders: {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: 60 }],
          },
        },
      })
      if (event.data.id) {
        eventIds.push(event.data.id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${mainRecipe.title}: ${message}`)
    }
  }

  return {
    calendarId: familyCalendarId,
    registeredCount: eventIds.length,
    eventIds,
    errors,
  }
}

function formatShoppingListDescription(sortedList: SortedShoppingList): string {
  const lines: string[] = [
    `買い物リスト (${sortedList.weekStartDate}~)`,
    '',
  ]

  for (const group of sortedList.categories) {
    lines.push(`--- ${group.category} ---`)
    for (const item of group.items) {
      lines.push(`  [ ] ${item.name} ${item.quantity}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export async function registerShoppingListToCalendar(
  userId: string,
  sortedList: SortedShoppingList,
  scheduledDate: string,
  scheduledTime?: string,
): Promise<{ eventId: string; htmlLink: string }> {
  const { calendar } = await getAuthenticatedCalendar(userId)
  const description = formatShoppingListDescription(sortedList)

  const startTime = scheduledTime ?? '10:00'
  const [hours, minutes] = startTime.split(':').map(Number)
  const endHours = (hours ?? 10) + 1

  const startDateTime = `${scheduledDate}T${String(hours ?? 10).padStart(2, '0')}:${String(minutes ?? 0).padStart(2, '0')}:00`
  const endDateTime = `${scheduledDate}T${String(endHours).padStart(2, '0')}:${String(minutes ?? 0).padStart(2, '0')}:00`

  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `買い物リスト (${sortedList.weekStartDate}~)`,
      description,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Tokyo',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
        ],
      },
    },
  })

  return {
    eventId: event.data.id ?? '',
    htmlLink: event.data.htmlLink ?? '',
  }
}
