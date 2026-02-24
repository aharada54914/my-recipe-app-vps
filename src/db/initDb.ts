import { db } from './db'
import type { Recipe } from './db'
import hotcookRecipes from '../data/recipes-hotcook.json'
import healsioRecipes from '../data/recipes-healsio.json'
import { STOCK_MASTER } from '../data/stockMaster'

function normalizeCategory(category: string): string {
  if (category === 'ご飯もの') return '一品料理'
  if (category === 'デザート') return 'スイーツ'
  return category
}

function normalizeRecipeCategory<T extends { category?: string }>(recipe: T): T {
  return {
    ...recipe,
    category: normalizeCategory(recipe.category ?? ''),
  }
}

export async function initDb() {
  // Init recipes (run once on first launch)
  const recipeCount = await db.recipes.count()
  if (recipeCount === 0) {
    const allRecipes = [
      ...hotcookRecipes,
      ...healsioRecipes,
    ].map((recipe) => normalizeRecipeCategory(recipe)) as Omit<Recipe, 'id'>[]
    await db.recipes.bulkAdd(allRecipes)
  } else {
    // Safety migration for users whose DB was initialized before category rename was applied at import time.
    await db.recipes.toCollection().modify((recipe) => {
      recipe.category = normalizeCategory(recipe.category) as Recipe['category']
    })
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
