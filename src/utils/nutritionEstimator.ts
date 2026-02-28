/**
 * Ingredient-based nutrition estimator using the Japanese Food Composition Table (2020).
 * Estimates RecipeNutritionPerServing from a recipe's ingredient list.
 * source='estimated', confidence=0.35
 */
import type { Recipe, RecipeNutritionPerServing } from '../db/db'
import { NUTRITION_PATTERNS, type NutritionPer100g } from '../data/nutritionLookup'

// ─── Unit → grams conversion (Japanese cooking units) ───────────────────────

function unitToGrams(
  quantity: number,
  unit: string,
  _ingredientName: string,
  oosajiG: number,
  kosajiG: number,
  unitGrams: Partial<Record<string, number>>,
): number {
  if (quantity <= 0) return 0
  const u = unit.trim()

  // Direct weight/volume
  if (u === 'g' || u === 'G' || u === 'グラム') return quantity
  if (u === 'kg') return quantity * 1000
  if (u === 'ml' || u === 'mL' || u === 'cc' || u === 'l' || u === 'L') return quantity // density ≈ 1
  if (u === 'dl' || u === 'dL') return quantity * 100

  // Japanese volume units
  if (u === '大さじ') return quantity * oosajiG
  if (u === '小さじ') return quantity * kosajiG
  if (u === 'カップ' || u === 'cup' || u === 'c') return quantity * 200
  if (u === '合') return quantity * 150 // rice: 1合 ≈ 150g uncooked

  // Piece-based units — check ingredient-specific overrides first
  const pieceUnits = ['個', '本', '枚', '切れ', 'パック', '袋', '缶', '丁', '片', '尾', '束', '腹', '玉', '株', '房']
  for (const pu of pieceUnits) {
    if (u === pu || u.endsWith(pu)) {
      if (unitGrams[pu] !== undefined) return quantity * unitGrams[pu]!
    }
  }

  // Egg size suffix: L個, M個, S個
  if (u.endsWith('個')) {
    if (u.includes('L') || u.includes('LL')) return quantity * (unitGrams['個'] ?? 70)
    if (u.includes('S')) return quantity * (unitGrams['個'] ?? 50)
    return quantity * (unitGrams['個'] ?? 60)
  }

  // 適量・少々 → 0 (quantity should already be 0 but guard here)
  if (u === '適量' || u === '少々' || u === '少量' || u === 'ひとつまみ') return 0

  // Unknown unit: fallback to 50g
  return quantity * 50
}

// ─── Ingredient name → lookup entry matching ────────────────────────────────

function findNutritionEntry(name: string): { per100g: NutritionPer100g; oosajiG: number; kosajiG: number; unitGrams: Partial<Record<string, number>> } | null {
  for (const { keywords, entry } of NUTRITION_PATTERNS) {
    for (const kw of keywords) {
      if (name.includes(kw)) {
        return {
          per100g: entry.per100g,
          oosajiG: entry.oosajiG ?? 15,
          kosajiG: entry.kosajiG ?? 5,
          unitGrams: entry.unitGrams ?? {},
        }
      }
    }
  }
  return null
}

// ─── Energy-based PFC fallback ───────────────────────────────────────────────
// When ingredient matching fails, estimate macros from known kcal using
// typical Japanese home-cooking PFC distribution.

function energyBasedFallback(energyKcal: number, saltG: number | undefined, isSweets: boolean): NutritionPer100g {
  // Sweets have higher carbs; savory dishes have more protein
  const pRatio = isSweets ? 0.07 : 0.16
  const fRatio = isSweets ? 0.30 : 0.28
  const cRatio = isSweets ? 0.63 : 0.56

  return {
    energyKcal,
    proteinG: Math.round((energyKcal * pRatio / 4) * 10) / 10,
    fatG: Math.round((energyKcal * fRatio / 9) * 10) / 10,
    carbG: Math.round((energyKcal * cRatio / 4) * 10) / 10,
    saltEquivalentG: saltG ?? (isSweets ? 0.3 : 1.2),
    fiberG: isSweets ? 1.0 : 3.0,
    sugarG: isSweets ? Math.round(energyKcal * cRatio / 4 * 0.6 * 10) / 10 : 6.0,
    saturatedFatG: Math.round((energyKcal * fRatio / 9 * 0.35) * 10) / 10,
    potassiumMg: isSweets ? 120 : 380,
    calciumMg: isSweets ? 60 : 90,
    ironMg: isSweets ? 0.8 : 1.8,
    vitaminCMg: isSweets ? 2 : 15,
  }
}

// ─── Main estimation function ────────────────────────────────────────────────

function parseCaloriesString(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const m = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).match(/(\d+(?:\.\d+)?)/)
  if (!m) return undefined
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : undefined
}

export function estimateRecipeNutrition(recipe: Recipe): RecipeNutritionPerServing {
  const servings = (recipe.baseServings > 0 ? recipe.baseServings : 2)
  const isSweets = recipe.category === 'スイーツ'

  // Accumulators
  let totalE = 0, totalP = 0, totalF = 0, totalC = 0, totalSalt = 0
  let totalFiber = 0, totalSugar = 0, totalSatFat = 0
  let totalK = 0, totalCa = 0, totalFe = 0, totalVitC = 0
  let matchedWeightG = 0

  for (const ing of recipe.ingredients) {
    const rawQty = typeof ing.quantity === 'number' ? ing.quantity : parseFloat(String(ing.quantity))
    const qty = Number.isFinite(rawQty) ? rawQty : 0
    if (qty <= 0) continue

    const found = findNutritionEntry(ing.name)
    if (!found) continue

    const grams = unitToGrams(qty, ing.unit, ing.name, found.oosajiG, found.kosajiG, found.unitGrams)
    if (grams <= 0) continue

    const f = grams / 100
    const n = found.per100g
    totalE += n.energyKcal * f
    totalP += n.proteinG * f
    totalF += n.fatG * f
    totalC += n.carbG * f
    totalSalt += n.saltEquivalentG * f
    totalFiber += n.fiberG * f
    totalSugar += n.sugarG * f
    totalSatFat += n.saturatedFatG * f
    totalK += n.potassiumMg * f
    totalCa += n.calciumMg * f
    totalFe += n.ironMg * f
    totalVitC += n.vitaminCMg * f
    matchedWeightG += grams
  }

  // Determine serving size
  const servingSizeG = recipe.totalWeightG > 0
    ? Math.round((recipe.totalWeightG / servings) * 10) / 10
    : matchedWeightG > 0
      ? Math.round((matchedWeightG / servings) * 10) / 10
      : undefined

  // If insufficient match, fall back to calorie-based estimation
  const matchRatio = recipe.totalWeightG > 0 ? matchedWeightG / recipe.totalWeightG : 1
  const useFallback = matchRatio < 0.15 || matchedWeightG < 20

  if (useFallback) {
    // Use existing energyKcal from CSV if available; otherwise estimate from totalWeightG
    const csvEnergy = recipe.nutritionPerServing?.energyKcal
      ?? parseCaloriesString(recipe.calories)
      ?? (recipe.totalWeightG > 0 ? Math.round(recipe.totalWeightG / servings * 1.5) : 400)
    const csvSalt = recipe.nutritionPerServing?.saltEquivalentG
      ?? recipe.nutritionPerServing?.sodiumMg !== undefined
        ? (recipe.nutritionPerServing.sodiumMg! / 393)
        : undefined

    const fb = energyBasedFallback(csvEnergy, csvSalt, isSweets)
    return {
      servingSizeG,
      energyKcal: fb.energyKcal,
      proteinG: fb.proteinG,
      fatG: fb.fatG,
      carbG: fb.carbG,
      saltEquivalentG: fb.saltEquivalentG,
      fiberG: fb.fiberG,
      sugarG: fb.sugarG,
      saturatedFatG: fb.saturatedFatG,
      potassiumMg: fb.potassiumMg,
      calciumMg: fb.calciumMg,
      ironMg: fb.ironMg,
      vitaminCMg: fb.vitaminCMg,
    }
  }

  const r = (v: number, dp = 1) => Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp)

  return {
    servingSizeG,
    energyKcal: Math.round(totalE / servings),
    proteinG: r(totalP / servings),
    fatG: r(totalF / servings),
    carbG: r(totalC / servings),
    saltEquivalentG: r(totalSalt / servings),
    fiberG: r(totalFiber / servings),
    sugarG: r(totalSugar / servings),
    saturatedFatG: r(totalSatFat / servings),
    potassiumMg: Math.round(totalK / servings),
    calciumMg: Math.round(totalCa / servings),
    ironMg: r(totalFe / servings),
    vitaminCMg: Math.round(totalVitC / servings),
  }
}
