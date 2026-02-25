/**
 * Google Calendar REST API v3 client.
 * Uses fetch() directly — no external library required.
 * Requires a Google OAuth access token.
 */

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// --- Types ---

export interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
  accessRole?: string
}

export interface CalendarEventInput {
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  reminders?: {
    useDefault: boolean
    overrides?: { method: string; minutes: number }[]
  }
  attachments?: Array<{
    fileUrl: string
    title: string
    mimeType: string
  }>
}

export interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
}

export class GoogleCalendarError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'GoogleCalendarError'
    this.status = status
  }
}

// --- Helper ---

async function gcalFetch<T>(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    throw new GoogleCalendarError(
      `Google Calendar API error: ${res.status} ${res.statusText}`,
      res.status,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// --- API Functions ---

/**
 * List calendars the user has access to.
 */
export async function listCalendars(token: string): Promise<CalendarListEntry[]> {
  const data = await gcalFetch<{ items?: CalendarListEntry[] }>(
    token,
    '/users/me/calendarList',
  )
  return data.items ?? []
}

/**
 * Create a calendar event.
 */
export async function createCalendarEvent(
  token: string,
  calendarId: string,
  event: CalendarEventInput,
  options?: { supportsAttachments?: boolean },
): Promise<CalendarEvent> {
  const params = options?.supportsAttachments ? '?supportsAttachments=true' : ''
  return gcalFetch<CalendarEvent>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events${params}`,
    {
      method: 'POST',
      body: JSON.stringify(event),
    },
  )
}

/**
 * Delete a calendar event.
 */
export async function deleteCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await gcalFetch<void>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  )
}

/**
 * List events from a calendar within a time range.
 */
export async function listEvents(
  token: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  })

  const data = await gcalFetch<{ items?: CalendarEvent[] }>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  )
  return data.items ?? []
}

/**
 * Build a meal event input for Google Calendar.
 */
export function buildMealEventInput(
  recipeTitle: string,
  ingredientsSummary: string,
  startTime: Date,
  endTime: Date,
  sourceUrl?: string,
  reminderMinutes?: number,
): CalendarEventInput {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  let description = `材料:\n${ingredientsSummary}`
  if (sourceUrl) {
    description += `\n\nレシピURL: ${sourceUrl}`
  }

  const event: CalendarEventInput = {
    summary: `夕食: ${recipeTitle}`,
    description,
    start: { dateTime: startTime.toISOString(), timeZone: tz },
    end: { dateTime: endTime.toISOString(), timeZone: tz },
    reminders: { useDefault: false, overrides: [] },
  }

  if (reminderMinutes != null && event.reminders?.overrides) {
    event.reminders.overrides.push({ method: 'popup', minutes: reminderMinutes })
  }

  return event
}

/**
 * Build a shopping list event input for Google Calendar.
 */
export function buildShoppingListEventInput(
  recipeTitle: string,
  missingItems: string,
  eventTime: Date,
): CalendarEventInput {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const endTime = new Date(eventTime.getTime() + 5 * 60 * 1000) // 5 minutes

  return {
    summary: `買い物リスト: ${recipeTitle}`,
    description: `${recipeTitle} の買い物リスト\n${missingItems}`,
    start: { dateTime: eventTime.toISOString(), timeZone: tz },
    end: { dateTime: endTime.toISOString(), timeZone: tz },
    reminders: { useDefault: true },
  }
}

/**
 * Build a weekly shopping list event with QR code attachment.
 * importUrl: the ?import-menu=<base64> URL embedded in event description.
 * driveFileUrl: Google Drive webViewLink for the QR image attachment.
 */
export function buildWeeklyShoppingEventInput({
  weekLabel,
  shoppingText,
  importUrl,
  driveFileUrl,
  eventTime,
  timeZone,
}: {
  weekLabel: string
  shoppingText: string
  importUrl: string
  driveFileUrl: string
  eventTime: Date
  timeZone: string
}): CalendarEventInput {
  const endTime = new Date(eventTime.getTime() + 5 * 60 * 1000)

  const description = [
    shoppingText,
    '',
    '---',
    `📱 週間献立をアプリで受け取る:`,
    importUrl,
  ].join('\n')

  const event: CalendarEventInput = {
    summary: `🛒 週間買い物リスト (${weekLabel})`,
    description,
    start: { dateTime: eventTime.toISOString(), timeZone },
    end: { dateTime: endTime.toISOString(), timeZone },
    reminders: { useDefault: true },
  }

  if (driveFileUrl) {
    event.attachments = [{
      fileUrl: driveFileUrl,
      title: `献立QR_${weekLabel}.png`,
      mimeType: 'image/png',
    }]
  }

  return event
}
