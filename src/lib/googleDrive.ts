/**
 * Google Drive Backup/Restore
 *
 * Uses the Drive App Data folder (drive.appdata scope) to store a private JSON
 * backup that is invisible to users in their regular Drive file list.
 *
 * File: "my-recipe-app-backup.json" in the appdata folder.
 */

import { db } from '../db/db'
import type { StockItem, Favorite, UserNote, ViewHistory, WeeklyMenu, CalendarEventRecord, UserPreferences } from '../db/db'

const BACKUP_FILENAME = 'my-recipe-app-backup.json'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'

interface BackupData {
  version: 2
  exportedAt: string
  stock: StockItem[]
  favorites: Favorite[]
  userNotes: UserNote[]
  viewHistory: ViewHistory[]
  weeklyMenus: WeeklyMenu[]
  calendarEvents: CalendarEventRecord[]
  preferences: UserPreferences | null
}

async function driveGet(token: string, url: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
}

async function assertDriveOk(res: Response, context: string): Promise<void> {
  if (res.ok) return
  let detail = ''
  try {
    detail = await res.text()
  } catch {
    detail = ''
  }
  const suffix = detail ? `: ${detail.slice(0, 200)}` : ''
  throw new Error(`${context} failed (${res.status} ${res.statusText})${suffix}`)
}

async function findBackupFile(token: string): Promise<string | null> {
  const query = encodeURIComponent(`name='${BACKUP_FILENAME}' and trashed=false`)
  const res = await driveGet(
    token,
    `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${query}&fields=files(id)`,
  )
  await assertDriveOk(res, 'Google Drive file search')
  const json = (await res.json()) as { files: { id: string }[] }
  return json.files?.[0]?.id ?? null
}

/**
 * Collect all user-generated data from IndexedDB and back it up to Drive.
 */
export async function backupToGoogleDrive(token: string): Promise<void> {
  const [stock, favorites, userNotes, viewHistory, weeklyMenus, calendarEvents] =
    await Promise.all([
      db.stock.toArray(),
      db.favorites.toArray(),
      db.userNotes.toArray(),
      db.viewHistory.orderBy('viewedAt').reverse().limit(200).toArray(),
      db.weeklyMenus.toArray(),
      db.calendarEvents.toArray(),
    ])
  const preferences = (await db.userPreferences.toCollection().first()) ?? null

  const backup: BackupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    stock,
    favorites,
    userNotes,
    viewHistory,
    weeklyMenus,
    calendarEvents,
    preferences,
  }

  const body = JSON.stringify(backup)
  const existingId = await findBackupFile(token)

  if (existingId) {
    // Update existing file content
    const res = await fetch(`${DRIVE_UPLOAD_URL}/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    })
    await assertDriveOk(res, 'Google Drive backup update')
  } else {
    // Create new file with metadata + content (multipart)
    const metadata = JSON.stringify({
      name: BACKUP_FILENAME,
      parents: ['appDataFolder'],
    })
    const boundary = 'backup_boundary_001'
    const multipart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      body,
      `--${boundary}--`,
    ].join('\r\n')

    const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    })
    await assertDriveOk(res, 'Google Drive backup create')
  }
}

/**
 * Restore data from Google Drive backup into IndexedDB.
 * Returns true if a backup was found and restored.
 */
export async function restoreFromGoogleDrive(token: string): Promise<boolean> {
  const fileId = await findBackupFile(token)
  if (!fileId) return false

  const res = await driveGet(
    token,
    `${DRIVE_FILES_URL}/${fileId}?alt=media`,
  )
  await assertDriveOk(res, 'Google Drive backup download')

  let backup: BackupData
  try {
    backup = (await res.json()) as BackupData
  } catch {
    return false
  }

  // Restore stock (merge by name to avoid duplicates)
  if (backup.stock?.length) {
    for (const item of backup.stock) {
      const existing = await db.stock.where('name').equals(item.name).first()
      if (!existing) {
        const { id: _id, ...rest } = item
        await db.stock.add(rest as StockItem)
      }
    }
  }

  // Restore favorites (merge by recipeId)
  if (backup.favorites?.length) {
    for (const fav of backup.favorites) {
      const existing = await db.favorites.where('recipeId').equals(fav.recipeId).first()
      if (!existing) {
        const { id: _id, ...rest } = fav
        await db.favorites.add({ ...rest, addedAt: new Date(fav.addedAt) } as Favorite)
      }
    }
  }

  // Restore user notes (merge by recipeId)
  if (backup.userNotes?.length) {
    for (const note of backup.userNotes) {
      const existing = await db.userNotes.where('recipeId').equals(note.recipeId).first()
      if (!existing) {
        const { id: _id, ...rest } = note
        await db.userNotes.add({ ...rest, updatedAt: new Date(note.updatedAt) } as UserNote)
      }
    }
  }

  // Restore view history (add all missing)
  if (backup.viewHistory?.length) {
    const existingCount = await db.viewHistory.count()
    if (existingCount === 0) {
      for (const vh of backup.viewHistory) {
        const { id: _id, ...rest } = vh
        await db.viewHistory.add({ ...rest, viewedAt: new Date(vh.viewedAt) } as ViewHistory)
      }
    }
  }

  // Restore weekly menus (merge by weekStartDate)
  if (backup.weeklyMenus?.length) {
    for (const menu of backup.weeklyMenus) {
      const existing = await db.weeklyMenus.where('weekStartDate').equals(menu.weekStartDate).first()
      if (!existing) {
        const { id: _id, ...rest } = menu
        await db.weeklyMenus.add({
          ...rest,
          createdAt: new Date(menu.createdAt),
          updatedAt: new Date(menu.updatedAt),
        } as WeeklyMenu)
      }
    }
  }

  // Restore calendar events
  if (backup.calendarEvents?.length) {
    const existingCount = await db.calendarEvents.count()
    if (existingCount === 0) {
      for (const event of backup.calendarEvents) {
        const { id: _id, ...rest } = event
        await db.calendarEvents.add({
          ...rest,
          startTime: new Date(event.startTime),
          endTime: new Date(event.endTime),
          createdAt: new Date(event.createdAt),
        } as CalendarEventRecord)
      }
    }
  }

  // Restore preferences (only if none exist locally)
  if (backup.preferences) {
    const existing = await db.userPreferences.toCollection().first()
    if (!existing) {
      const { id: _id, ...rest } = backup.preferences
      await db.userPreferences.add({
        ...rest,
        updatedAt: new Date(backup.preferences.updatedAt),
      } as UserPreferences)
    }
  }

  return true
}
