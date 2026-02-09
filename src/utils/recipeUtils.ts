import { subMinutes } from 'date-fns'
import type { Ingredient, SaltMode, SaltResult, CookingStep, ScheduleEntry, RecipeSchedule } from '../db/db'

/**
 * Format a quantity with Japanese vibes:
 * - g/ml → round to nearest 10g
 * - 個/本/株/片 → express with 半, 強, 約
 * - 大さじ/小さじ → fractions
 * - 適量 → return as-is
 */
export function formatQuantityVibe(value: number, unit: string): string {
  if (unit === '適量') return '適量'
  if (value === 0) return unit === '適量' ? '適量' : `0${unit}`

  // Weight / volume: round to nearest 10
  if (unit === 'g' || unit === 'ml') {
    const rounded = Math.round(value / 10) * 10
    return `${rounded}${unit}`
  }

  // Tablespoon / teaspoon: use fractions
  if (unit === '大さじ' || unit === '小さじ') {
    return formatSpoonFraction(value, unit)
  }

  // Countable units: express with Japanese approximations
  if (['個', '本', '株', '片', '皿分'].includes(unit)) {
    return formatCountable(value, unit)
  }

  // Fallback
  if (Number.isInteger(value)) return `${value}${unit}`
  return `${Math.round(value * 10) / 10}${unit}`
}

function formatSpoonFraction(value: number, unit: string): string {
  const whole = Math.floor(value)
  const frac = value - whole

  const fractionMap: [number, string][] = [
    [0.25, '1/4'],
    [0.33, '1/3'],
    [0.5, '1/2'],
    [0.67, '2/3'],
    [0.75, '3/4'],
  ]

  let fracStr = ''
  if (frac > 0.01) {
    const closest = fractionMap.reduce((prev, curr) =>
      Math.abs(curr[0] - frac) < Math.abs(prev[0] - frac) ? curr : prev
    )
    fracStr = closest[1]
  }

  if (whole === 0 && fracStr) return `${unit}${fracStr}`
  if (whole > 0 && fracStr) return `${unit}${whole}と${fracStr}`
  return `${unit}${whole}`
}

function formatCountable(value: number, unit: string): string {
  if (Number.isInteger(value)) return `${value}${unit}`

  const whole = Math.floor(value)
  const frac = value - whole

  // Exactly half
  if (Math.abs(frac - 0.5) < 0.01) {
    if (whole === 0) return `半${unit}`
    return `${whole}${unit}半`
  }

  // Slightly more than whole
  if (frac > 0 && frac <= 0.3) {
    return whole > 0 ? `${whole}${unit}強` : `約${Math.round(value * 10) / 10}${unit}`
  }

  // Roughly ¾ or other fractions
  if (frac > 0.3 && frac < 0.5) {
    return `約${whole > 0 ? whole + '.' : ''}5${unit}`
  }

  if (frac > 0.5) {
    return `約${whole + 1}${unit}`
  }

  return `約${Math.round(value * 10) / 10}${unit}`
}

/**
 * Scale ingredients based on servings ratio.
 */
export function adjustIngredients(
  ingredients: Ingredient[],
  baseServings: number,
  targetServings: number
): Ingredient[] {
  const ratio = targetServings / baseServings
  return ingredients.map((ing) => ({
    ...ing,
    quantity: ing.unit === '適量' ? ing.quantity : ing.quantity * ratio,
  }))
}

/**
 * Calculate salt/soy sauce/miso from total weight and salt mode.
 * - Salt = totalWeight × mode% → round to nearest 10g
 * - Soy sauce = salt / 0.16 / 1.17 → ml
 * - Miso = salt / 0.12 → g
 */
export function calculateSalt(totalWeightG: number, mode: SaltMode): SaltResult {
  const saltG = Math.round((totalWeightG * mode) / 100 / 10) * 10
  const soySauceMl = Math.round((saltG / 0.16 / 1.17) * 10) / 10
  const misoG = Math.round((saltG / 0.12) * 10) / 10
  return { saltG, soySauceMl, misoG }
}

/**
 * Calculate a schedule by working backwards from the target time.
 */
export function calculateSchedule(
  targetTime: Date,
  steps: CookingStep[]
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = []
  let currentEnd = targetTime

  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    const start = subMinutes(currentEnd, step.durationMinutes)
    entries.unshift({
      name: step.name,
      start,
      end: currentEnd,
      isDeviceStep: step.isDeviceStep ?? false,
    })
    currentEnd = start
  }

  return entries
}

/**
 * Calculate schedules for multiple recipes against a single target time.
 */
export function calculateMultiRecipeSchedule(
  targetTime: Date,
  recipesWithSteps: Array<{ recipeId: number; title: string; steps: CookingStep[] }>
): { targetTime: Date; recipes: RecipeSchedule[]; overallStart: Date } {
  const recipes: RecipeSchedule[] = recipesWithSteps.map((r, index) => ({
    recipeId: r.recipeId,
    recipeTitle: r.title,
    colorIndex: index,
    entries: calculateSchedule(targetTime, r.steps),
  }))

  const overallStart = recipes.reduce(
    (earliest, rs) => {
      const first = rs.entries[0]?.start ?? targetTime
      return first < earliest ? first : earliest
    },
    targetTime,
  )

  return { targetTime, recipes, overallStart }
}

/**
 * Calculate ingredient match rate based on stock.
 * Only considers 'main' category ingredients.
 */
export function calculateMatchRate(
  ingredients: Ingredient[],
  stockNames: Set<string>
): number {
  const mainIngredients = ingredients.filter((i) => i.category === 'main')
  if (mainIngredients.length === 0) return 0
  const matched = mainIngredients.filter((i) => stockNames.has(i.name)).length
  return Math.round((matched / mainIngredients.length) * 100)
}
