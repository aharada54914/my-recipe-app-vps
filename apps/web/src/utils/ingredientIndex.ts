import { db } from '../db/db'

export interface IngredientInfo {
  name: string
  defaultUnit: string
}

/**
 * Build an ingredient index from all recipes in the database.
 * Iterates recipes one-by-one via .each() to avoid loading all into memory.
 * For each ingredient, counts unit occurrences and selects the most common
 * non-「適量」unit as the default.
 * Returns results sorted in Japanese 50音順.
 */
export async function buildIngredientIndex(): Promise<IngredientInfo[]> {
  // Map<ingredientName, Map<unit, count>>
  const unitCounts = new Map<string, Map<string, number>>()

  await db.recipes.each((recipe) => {
    for (const ing of recipe.ingredients) {
      const name = ing.name
      if (!name) continue

      let counts = unitCounts.get(name)
      if (!counts) {
        counts = new Map()
        unitCounts.set(name, counts)
      }
      const unit = (ing.quantity === '適量' || ing.unit === '適量' || ing.unit === '') ? '適量' : ing.unit
      counts.set(unit, (counts.get(unit) || 0) + 1)
    }
  })

  const result: IngredientInfo[] = []

  for (const [name, counts] of unitCounts) {
    // Find the most frequent non-適量 unit
    let bestUnit = '適量'
    let bestCount = 0

    for (const [unit, count] of counts) {
      if (unit !== '適量' && count > bestCount) {
        bestUnit = unit
        bestCount = count
      }
    }

    result.push({ name, defaultUnit: bestUnit })
  }

  // Sort by Japanese 50音順
  result.sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  return result
}
