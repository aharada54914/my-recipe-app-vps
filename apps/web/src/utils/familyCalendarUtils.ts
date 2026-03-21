/**
 * Family calendar utilities.
 * Reads events from a family calendar and generates meal suggestion hints.
 */

import { listEvents } from '../lib/googleCalendar'

export interface FamilyEvent {
  summary: string
  date: Date
  isAllDay: boolean
  startTime?: string
  endTime?: string
}

export interface MealSuggestionHint {
  date: Date
  suggestion: string
  reason: string
}

/**
 * Fetch family schedule from Google Calendar for a given date range.
 */
export async function getFamilySchedule(
  token: string,
  calendarId: string,
  startDate: Date,
  endDate: Date,
): Promise<FamilyEvent[]> {
  const events = await listEvents(token, calendarId, startDate, endDate)

  return events.map((event) => {
    const isAllDay = !!event.start.date && !event.start.dateTime
    const startDt = event.start.dateTime ?? event.start.date ?? ''

    return {
      summary: event.summary ?? '',
      date: new Date(startDt),
      isAllDay,
      startTime: event.start.dateTime
        ? new Date(event.start.dateTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : undefined,
      endTime: event.end.dateTime
        ? new Date(event.end.dateTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : undefined,
    }
  })
}

/**
 * Analyze family schedule and generate meal suggestion hints.
 */
export function analyzeFamilySchedule(events: FamilyEvent[]): MealSuggestionHint[] {
  const dateMap = new Map<string, FamilyEvent[]>()

  for (const event of events) {
    const key = event.date.toISOString().slice(0, 10)
    const existing = dateMap.get(key) ?? []
    existing.push(event)
    dateMap.set(key, existing)
  }

  const hints: MealSuggestionHint[] = []

  for (const [dateStr, dayEvents] of dateMap) {
    const date = new Date(dateStr)

    // Check for all-day events (e.g. trips, outings)
    const hasAllDay = dayEvents.some((e) => e.isAllDay)
    if (hasAllDay) {
      hints.push({
        date,
        suggestion: '作り置き・翌日用レシピを推奨',
        reason: '終日予定があります',
      })
      continue
    }

    // Check for evening events (after 16:00)
    const hasEveningEvent = dayEvents.some((e) => {
      if (!e.startTime) return false
      const hour = parseInt(e.startTime.split(':')[0], 10)
      return hour >= 16
    })

    if (hasEveningEvent) {
      hints.push({
        date,
        suggestion: '時短レシピを推奨',
        reason: '夕方以降に予定があります',
      })
      continue
    }

    // Check for busy days (3+ events)
    if (dayEvents.length >= 3) {
      hints.push({
        date,
        suggestion: '簡単レシピを推奨',
        reason: `${dayEvents.length}件の予定があります`,
      })
      continue
    }

    // Free day
    if (dayEvents.length === 0) {
      hints.push({
        date,
        suggestion: 'じっくり料理もOK',
        reason: '予定なし',
      })
    }
  }

  return hints.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Get a date range for the next 7 days starting from a given date.
 */
export function getWeekRange(startDate: Date): { start: Date; end: Date } {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}
