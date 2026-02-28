import type { Recipe, RecipeNutritionPerServing } from '../db/db'

export const REQUIRED_NUTRITION_FIELDS = [
  'servingSizeG',
  'energyKcal',
  'proteinG',
  'fatG',
  'carbG',
] as const

type RequiredNutritionField = typeof REQUIRED_NUTRITION_FIELDS[number]

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export interface RequiredNutritionCheckResult {
  ok: boolean
  missingFields: string[]
}

export function getMissingRequiredNutritionFields(
  nutrition: RecipeNutritionPerServing | undefined,
): string[] {
  if (!nutrition) return [...REQUIRED_NUTRITION_FIELDS, 'saltEquivalentG|sodiumMg']

  const missing: string[] = []
  for (const field of REQUIRED_NUTRITION_FIELDS) {
    if (!isFiniteNumber(nutrition[field as RequiredNutritionField])) {
      missing.push(field)
    }
  }

  const hasSaltEquivalent = isFiniteNumber(nutrition.saltEquivalentG)
  const hasSodium = isFiniteNumber(nutrition.sodiumMg)
  if (!hasSaltEquivalent && !hasSodium) {
    missing.push('saltEquivalentG|sodiumMg')
  }
  return missing
}

export function validateRequiredNutrition(
  recipe: Pick<Recipe, 'nutritionPerServing'>,
): RequiredNutritionCheckResult {
  const missingFields = getMissingRequiredNutritionFields(recipe.nutritionPerServing)
  return {
    ok: missingFields.length === 0,
    missingFields,
  }
}

export function formatMissingNutritionMessage(fields: string[]): string {
  if (fields.length === 0) return ''
  return `栄養項目が不足しています: ${fields.join(', ')}`
}
