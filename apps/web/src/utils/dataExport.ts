import { db } from '../db/db'

interface ExportData {
  version: 1
  exportedAt: string
  tables: {
    recipes: unknown[]
    stock: unknown[]
    favorites: unknown[]
    userNotes: unknown[]
    viewHistory: unknown[]
  }
}

/**
 * Export all database tables to a JSON file and trigger download.
 */
export async function exportData(): Promise<void> {
  const [recipes, stock, favorites, userNotes, viewHistory] = await Promise.all([
    db.recipes.toArray(),
    db.stock.toArray(),
    db.favorites.toArray(),
    db.userNotes.toArray(),
    db.viewHistory.toArray(),
  ])

  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: { recipes, stock, favorites, userNotes, viewHistory },
  }

  const json = JSON.stringify(data)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `kitchen-app-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
