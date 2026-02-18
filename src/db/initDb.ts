import { db } from './db'
import type { Recipe } from './db'
import hotcookRecipes from '../data/recipes-hotcook.json'
import healsioRecipes from '../data/recipes-healsio.json'
import { STOCK_MASTER } from '../data/stockMaster'

export async function initDb() {
  // Init recipes (run once on first launch)
  const recipeCount = await db.recipes.count()
  if (recipeCount === 0) {
    const allRecipes = [
      ...hotcookRecipes,
      ...healsioRecipes,
    ] as Omit<Recipe, 'id'>[]
    await db.recipes.bulkAdd(allRecipes)
  }

  // Init stock from master (run once if stock table is empty)
  const stockCount = await db.stock.count()
  if (stockCount === 0) {
    await db.stock.bulkAdd(
      STOCK_MASTER.map((item) => ({
        name: item.name,
        unit: item.unit,
        inStock: false,
        quantity: 0,
      }))
    )
  }
}
