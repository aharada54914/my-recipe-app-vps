import { db } from './db'
import type { Recipe } from './db'
import hotcookRecipes from '../data/recipes-hotcook.json'
import healsioRecipes from '../data/recipes-healsio.json'

export async function initDb() {
  const count = await db.recipes.count()
  if (count > 0) return

  // Bulk-insert pre-built recipe data
  const allRecipes = [
    ...hotcookRecipes,
    ...healsioRecipes,
  ] as Omit<Recipe, 'id'>[]

  await db.recipes.bulkAdd(allRecipes)
}
