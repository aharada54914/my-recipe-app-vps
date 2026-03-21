import { google } from 'googleapis'
import { prisma } from '../db/client.ts'
import type { SortedShoppingList } from '@kitchen/shared-types'

function getOAuth2Client() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth environment variables are not configured')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

async function getAuthenticatedCalendar(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true },
  })

  if (!user?.googleAccessToken) {
    throw new Error('User has no Google tokens. Please re-authenticate.')
  }

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken ?? undefined,
  })

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token ?? undefined,
        },
      })
    }
  })

  return google.calendar({ version: 'v3', auth: oauth2Client })
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
  const calendar = await getAuthenticatedCalendar(userId)
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
