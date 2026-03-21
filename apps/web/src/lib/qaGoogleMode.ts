import type { GoogleUser } from '../contexts/authContextDef'

const QA_GOOGLE_MODE_KEY = 'qa_google_mode_v1'
const QA_GOOGLE_DRIVE_BACKUP_KEY = 'qa_google_drive_backup_v1'
const QA_GOOGLE_CALENDAR_EVENTS_KEY = 'qa_google_calendar_events_v1'
const QA_GOOGLE_QUERY_PARAM = 'qa-google'
const QA_GOOGLE_TOKEN = 'qa-google-token'
const QA_GOOGLE_MODE_EVENT = 'qa-google-mode-change'

const QA_GOOGLE_USER: GoogleUser = {
  sub: 'qa-google-user',
  email: 'qa-google@example.com',
  name: 'QA Google',
}

export interface QaGoogleSummary {
  hasMockBackup: boolean
  calendarEventCount: number
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined'
}

function readStorage(key: string): string | null {
  if (!canUseStorage()) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  if (!canUseStorage()) return
  try {
    if (value == null) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, value)
  } catch {
    // ignore storage errors
  }
}

function notifyQaGoogleModeChanged(): void {
  if (!canUseStorage()) return
  window.dispatchEvent(new Event(QA_GOOGLE_MODE_EVENT))
}

export function syncQaGoogleModeFromUrl(): boolean {
  if (!canUseStorage()) return false

  const params = new URLSearchParams(window.location.search)
  const raw = params.get(QA_GOOGLE_QUERY_PARAM)
  if (raw == null) return isQaGoogleModeEnabled()

  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'on', 'enable', 'enabled'].includes(normalized)) {
    setQaGoogleModeEnabled(true)
    return true
  }

  if (['0', 'false', 'off', 'disable', 'disabled'].includes(normalized)) {
    setQaGoogleModeEnabled(false)
    return false
  }

  return isQaGoogleModeEnabled()
}

export function setQaGoogleModeUrl(enabled: boolean): void {
  if (!canUseStorage()) return

  const url = new URL(window.location.href)
  if (enabled) {
    url.searchParams.set(QA_GOOGLE_QUERY_PARAM, '1')
  } else {
    url.searchParams.delete(QA_GOOGLE_QUERY_PARAM)
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function isQaGoogleModeEnabled(): boolean {
  return readStorage(QA_GOOGLE_MODE_KEY) === '1'
}

export function setQaGoogleModeEnabled(enabled: boolean): void {
  writeStorage(QA_GOOGLE_MODE_KEY, enabled ? '1' : null)
  notifyQaGoogleModeChanged()
}

export function getQaGoogleMockToken(): string {
  return QA_GOOGLE_TOKEN
}

export function isQaGoogleToken(token: string | null | undefined): boolean {
  return token === QA_GOOGLE_TOKEN
}

export function getQaGoogleMockUser(): GoogleUser {
  return QA_GOOGLE_USER
}

export function getQaGoogleDriveBackup(): string | null {
  return readStorage(QA_GOOGLE_DRIVE_BACKUP_KEY)
}

export function setQaGoogleDriveBackup(value: string): void {
  writeStorage(QA_GOOGLE_DRIVE_BACKUP_KEY, value)
}

export function clearQaGoogleDriveBackup(): void {
  writeStorage(QA_GOOGLE_DRIVE_BACKUP_KEY, null)
}

export function readQaGoogleCalendarEvents(): string | null {
  return readStorage(QA_GOOGLE_CALENDAR_EVENTS_KEY)
}

export function writeQaGoogleCalendarEvents(value: string): void {
  writeStorage(QA_GOOGLE_CALENDAR_EVENTS_KEY, value)
}

export function clearQaGoogleCalendarEvents(): void {
  writeStorage(QA_GOOGLE_CALENDAR_EVENTS_KEY, null)
}

export function clearQaGoogleModeState(): void {
  setQaGoogleModeEnabled(false)
  clearQaGoogleDriveBackup()
  clearQaGoogleCalendarEvents()
}

export function getQaGoogleSummary(): QaGoogleSummary {
  const rawEvents = readQaGoogleCalendarEvents()
  let calendarEventCount = 0

  if (rawEvents) {
    try {
      const parsed = JSON.parse(rawEvents)
      calendarEventCount = Array.isArray(parsed) ? parsed.length : 0
    } catch {
      calendarEventCount = 0
    }
  }

  return {
    hasMockBackup: !!getQaGoogleDriveBackup(),
    calendarEventCount,
  }
}

export function getQaGoogleModeEventName(): string {
  return QA_GOOGLE_MODE_EVENT
}
