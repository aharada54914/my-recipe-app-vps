import { db } from '../db/db'

interface ImportData {
  version: number
  tables: {
    recipes?: unknown[]
    stock?: unknown[]
    favorites?: unknown[]
    userNotes?: unknown[]
    viewHistory?: unknown[]
  }
}

export type ImportMode = 'overwrite' | 'merge'

/**
 * Validate that the file content is a valid backup JSON.
 */
function validate(data: unknown): data is ImportData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (typeof d.version !== 'number') return false
  if (typeof d.tables !== 'object' || d.tables === null) return false
  return true
}

/**
 * Read a JSON file and import its data into the database.
 * - overwrite: clear all tables then insert imported data
 * - merge: add imported data, skipping entries with conflicting keys
 */
export async function importData(file: File, mode: ImportMode): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!validate(data)) {
      return { success: false, message: 'バックアップファイルの形式が正しくありません' }
    }

    const { tables } = data

    if (mode === 'overwrite') {
      await db.transaction('rw', [db.recipes, db.stock, db.favorites, db.userNotes, db.viewHistory], async () => {
        await Promise.all([
          db.recipes.clear(),
          db.stock.clear(),
          db.favorites.clear(),
          db.userNotes.clear(),
          db.viewHistory.clear(),
        ])

        if (tables.recipes?.length) await db.recipes.bulkAdd(tables.recipes as never[])
        if (tables.stock?.length) await db.stock.bulkAdd(tables.stock as never[])
        if (tables.favorites?.length) await db.favorites.bulkAdd(tables.favorites as never[])
        if (tables.userNotes?.length) await db.userNotes.bulkAdd(tables.userNotes as never[])
        if (tables.viewHistory?.length) await db.viewHistory.bulkAdd(tables.viewHistory as never[])
      })
    } else {
      // Merge mode: bulkPut upserts by primary key
      await db.transaction('rw', [db.recipes, db.stock, db.favorites, db.userNotes, db.viewHistory], async () => {
        if (tables.recipes?.length) await db.recipes.bulkPut(tables.recipes as never[])
        if (tables.stock?.length) await db.stock.bulkPut(tables.stock as never[])
        if (tables.favorites?.length) await db.favorites.bulkPut(tables.favorites as never[])
        if (tables.userNotes?.length) await db.userNotes.bulkPut(tables.userNotes as never[])
        if (tables.viewHistory?.length) await db.viewHistory.bulkPut(tables.viewHistory as never[])
      })
    }

    return { success: true, message: 'データを復元しました' }
  } catch {
    return { success: false, message: 'ファイルの読み込みに失敗しました' }
  }
}
