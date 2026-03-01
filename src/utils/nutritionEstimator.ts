/**
 * Ingredient-based nutrition estimator using the Japanese Food Composition Table (2020).
 * Estimates RecipeNutritionPerServing from a recipe's ingredient list.
 * source='estimated', confidence=0.35
 */
import type { Recipe, RecipeNutritionPerServing } from '../db/db'
import { NUTRITION_PATTERNS, type NutritionPer100g } from '../data/nutritionLookup'
import { normalizeIngredientName } from './ingredientNormalization'

// ─── Module-level constants ──────────────────────────────────────────────────

/**
 * Sized / named dish units that go beyond the basic serving units.
 * Defined at module level to avoid re-creating the object on every call.
 * unitGrams (ingredient-specific, from nutritionLookup) always takes priority
 * over these defaults — e.g. 白飯の茶碗:160g is preserved over the generic value.
 */
const SIZED_DISH_GRAMS: Record<string, number> = {
  '大皿': 300, '中皿': 200, '小皿': 120, '深皿': 250,
  '丼': 350, '丼杯分': 350,
  '茶碗': 160, 'お茶碗': 160, 'お茶碗杯分': 160,
}

const DEFAULT_PIECE_GRAMS: Record<string, number> = {
  '個': 60,
  '本': 100,
  '枚': 30,
  '切れ': 30,
  'パック': 120,
  '袋': 100,
  '缶': 190,
  '丁': 300,
  '片': 10,
  '尾': 60,
  '束': 100,
  '腹': 100,
  '玉': 200,
  '株': 150,
  '房': 100,
}

const NON_EDIBLE_INGREDIENT_KEYWORDS = [
  '容器サイズ',
  'アルミケース',
  '紙ケース',
  'アルミホイル',
  'クッキングシート',
  '竹串',
  '楊枝',
  '耐熱皿',
  'ラップ',
]

function isLikelyNonEdibleIngredient(name: string): boolean {
  return NON_EDIBLE_INGREDIENT_KEYWORDS.some((keyword) => name.includes(keyword))
}

function normalizeAscii(value: string): string {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/[／]/g, '/')
    .replace(/[×✕✖＊]/g, '×')
    .replace(/[〜～]/g, '~')
}

function parseQuantityValue(raw: number | string): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0

  const normalized = normalizeAscii(String(raw)).trim()
  if (!normalized || normalized === '適量') return 0

  const parseFraction = (token: string): number => {
    const trimmed = token.trim()
    if (!trimmed) return 0
    const frac = trimmed.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
    if (frac) {
      const numerator = Number.parseFloat(frac[1])
      const denominator = Number.parseFloat(frac[2])
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
        return numerator / denominator
      }
    }
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (normalized.includes('と')) {
    return normalized.split('と').reduce((sum, part) => sum + parseFraction(part), 0)
  }
  if (normalized.includes('・') && normalized.includes('/')) {
    return normalized.split('・').reduce((sum, part) => sum + parseFraction(part), 0)
  }
  return parseFraction(normalized)
}

function normalizeUnitAndQuantity(quantity: number, unit: string): { quantity: number, unit: string } {
  let q = Number.isFinite(quantity) ? quantity : 0
  let u = normalizeAscii(unit).replace(/\s+/g, '')

  // "人前×2パック", "パック×5パック" などの乗算を反映
  const multiplierMatches = [...u.matchAll(/[×xX]([0-9]+(?:\.[0-9]+)?)/g)]
  for (const match of multiplierMatches) {
    const mult = Number.parseFloat(match[1])
    if (Number.isFinite(mult) && mult > 0) q *= mult
  }
  if (multiplierMatches.length > 0) {
    u = u.replace(/[×xX][0-9]+(?:\.[0-9]+)?/g, '')
    u = u.replace(/^パックパック$/, 'パック')
    u = u.replace(/^人前パック$/, '人前')
  }

  // "人前1パック" のような表記揺れ
  const personPack = u.match(/^人前([0-9]+(?:\.[0-9]+)?)パック$/)
  if (personPack) {
    const mult = Number.parseFloat(personPack[1])
    if (Number.isFinite(mult) && mult > 0) q *= mult
    u = '人前'
  }

  // "/2個", "M/2個分" のように単位側へ分数が混在したケース
  const leadingFraction = u.match(/^([A-Za-z]?)[/／]([0-9]+(?:\.[0-9]+)?)(.+)$/)
  if (leadingFraction) {
    const denominator = Number.parseFloat(leadingFraction[2])
    if (Number.isFinite(denominator) && denominator > 0) q /= denominator
    u = `${leadingFraction[1]}${leadingFraction[3]}`
  }

  // "大さじと1/2", "大さじ・1/2"
  const addFractionTail = u.match(/^(.+?)(?:と|・)([0-9]+(?:\.[0-9]+)?)\/([0-9]+(?:\.[0-9]+)?)$/)
  if (addFractionTail) {
    const numerator = Number.parseFloat(addFractionTail[2])
    const denominator = Number.parseFloat(addFractionTail[3])
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      q += numerator / denominator
    }
    u = addFractionTail[1]
  }

  // "大さじ/2", "小さじ/3"
  const divideFractionTail = u.match(/^(.+)\/([0-9]+(?:\.[0-9]+)?)$/)
  if (divideFractionTail) {
    const denominator = Number.parseFloat(divideFractionTail[2])
    if (Number.isFinite(denominator) && denominator > 0) q /= denominator
    u = divideFractionTail[1]
  }

  // "と1/2カップ"
  const leadingAddFraction = u.match(/^と([0-9]+(?:\.[0-9]+)?)\/([0-9]+(?:\.[0-9]+)?)(.+)$/)
  if (leadingAddFraction) {
    const numerator = Number.parseFloat(leadingAddFraction[1])
    const denominator = Number.parseFloat(leadingAddFraction[2])
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      q += numerator / denominator
    }
    u = leadingAddFraction[3]
  }

  if (u === '少々' || u === '少量' || u === 'ひとつまみ' || u === 'ふたつまみ') {
    return { quantity: 0, unit: '少々' }
  }

  // おおまかな修飾語・範囲表記を除去
  u = u
    .replace(/^約/, '')
    .replace(/^正味/, '')
    .replace(/まで$/, '')
    .replace(/程度$/, '')
    .replace(/弱$/, '')
    .replace(/強$/, '')
    .replace(/以上$/, '')
  const rangeUnit = u.match(/^~?[0-9]+(?:\.[0-9]+)?(.+)$/)
  if (rangeUnit) u = rangeUnit[1]

  // "個分", "M個分", "本分" など
  u = u.replace(/^(M個|L個|S個|個|本|枚|片|杯|人前|人分|皿|皿分|膳|パック|袋|缶)分$/, '$1')

  // 小個/中個/大個 は倍率補正して個へ寄せる
  if (u === '小個') {
    q *= 0.8
    u = '個'
  } else if (u === '中個') {
    u = '個'
  } else if (u === '大個') {
    q *= 1.3
    u = '個'
  } else if (u === '小本') {
    q *= 0.8
    u = '本'
  } else if (u === '大本') {
    q *= 1.3
    u = '本'
  } else if (u === '小枚') {
    q *= 0.8
    u = '枚'
  } else if (u === '大枚') {
    q *= 1.3
    u = '枚'
  } else if (u === '小切れ') {
    q *= 0.8
    u = '切れ'
  } else if (u === '大尾') {
    q *= 1.3
    u = '尾'
  }

  if (u === 'ｇ') u = 'g'
  if (u === 'ｍL' || u === 'ｍＬ' || u === 'mＬ') u = 'mL'

  return { quantity: q, unit: u }
}

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
  if (u === 'ml' || u === 'mL' || u === 'cc') return quantity // density ≈ 1
  if (u === 'l' || u === 'L') return quantity * 1000
  if (u === 'dl' || u === 'dL') return quantity * 100

  // Japanese volume units
  if (u === '大さじ') return quantity * oosajiG
  if (u === '小さじ') return quantity * kosajiG
  if (u === 'カップ' || u === 'cup' || u === 'c') return quantity * 200
  if (u === '合') return quantity * 150 // rice: 1合 ≈ 150g uncooked

  // Person / serving / dish-based units (exact match only — endsWith would cause
  // false positives like '大皿' matching '皿' or '深皿分' matching '皿分')
  const servingUnits: Array<[string, number]> = [
    ['人前', 150], ['人分', 150], ['膳', 160],
    ['皿分', 180], ['皿', 180], ['杯', 180],
  ]
  for (const [su, defaultG] of servingUnits) {
    if (u === su) {
      return quantity * (unitGrams[u] ?? defaultG)
    }
  }

  // Sized / named dish units — unitGrams (ingredient-specific) takes priority.
  if (SIZED_DISH_GRAMS[u] !== undefined) {
    return quantity * (unitGrams[u] ?? SIZED_DISH_GRAMS[u])
  }

  // Piece-based units — exact match only.
  // endsWith caused false positives like '大袋'→'袋', '小缶'→'缶', '一束'→'束'.
  const pieceUnits = ['個', '本', '枚', '切れ', 'パック', '袋', '缶', '丁', '片', '尾', '束', '腹', '玉', '株', '房']
  for (const pu of pieceUnits) {
    if (u === pu) return quantity * (unitGrams[pu] ?? DEFAULT_PIECE_GRAMS[pu])
  }

  // Egg size suffix: L個, M個, S個 — intentional endsWith for sizing variants
  if (u.endsWith('個') || u.endsWith('個分')) {
    if (u.includes('L') || u.includes('LL')) return quantity * (unitGrams['個'] ?? 70)
    if (u.includes('S')) return quantity * (unitGrams['個'] ?? 50)
    return quantity * (unitGrams['個'] ?? 60)
  }

  if (u === 'かけ') return quantity * 5
  if (u === 'cm' || u === 'cm角') return quantity * 5

  // 適量・少々 → 0 (quantity should already be 0 but guard here)
  if (u === '適量' || u === '少々' || u === '少量' || u === 'ひとつまみ' || u === 'ふたつまみ') return 0

  // Unknown unit: fallback to 50g
  return quantity * 50
}

// ─── Ingredient name → lookup entry matching ────────────────────────────────

interface MatchedNutritionEntry {
  per100g: NutritionPer100g
  oosajiG: number
  kosajiG: number
  unitGrams: Partial<Record<string, number>>
  matchedKeyword: string
  foodCode: string
}

function toFallbackFoodCode(keyword: string): string {
  const normalized = keyword
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `kw:${normalized || 'unknown'}`
}

function findNutritionEntry(name: string): MatchedNutritionEntry | null {
  for (const { keywords, entry, foodCode } of NUTRITION_PATTERNS) {
    for (const kw of keywords) {
      if (name.includes(kw)) {
        return {
          per100g: entry.per100g,
          oosajiG: entry.oosajiG ?? 15,
          kosajiG: entry.kosajiG ?? 5,
          unitGrams: entry.unitGrams ?? {},
          matchedKeyword: kw,
          foodCode: foodCode ?? toFallbackFoodCode(kw),
        }
      }
    }
  }
  return null
}

// ─── Energy-based PFC fallback ───────────────────────────────────────────────
// When ingredient matching fails, estimate macros from known kcal using
// category-aware Japanese home-cooking PFC distribution. (C)

function energyBasedFallback(energyKcal: number, saltG: number | undefined, category: string): NutritionPer100g {
  const isSweets = category === 'スイーツ'
  const isMainDish = category === '主菜'
  const isSoup = category === 'スープ'

  // PFC caloric ratios by category (must sum to 1.0)
  let pRatio: number, fRatio: number, cRatio: number
  if (isSweets) {
    pRatio = 0.07; fRatio = 0.30; cRatio = 0.63 // high carb, moderate fat
  } else if (isMainDish) {
    pRatio = 0.22; fRatio = 0.32; cRatio = 0.46 // protein-rich
  } else if (isSoup) {
    pRatio = 0.14; fRatio = 0.22; cRatio = 0.64 // light, higher carb
  } else {
    pRatio = 0.16; fRatio = 0.28; cRatio = 0.56 // 副菜 / その他
  }

  return {
    energyKcal,
    proteinG: Math.round((energyKcal * pRatio / 4) * 10) / 10,
    fatG: Math.round((energyKcal * fRatio / 9) * 10) / 10,
    carbG: Math.round((energyKcal * cRatio / 4) * 10) / 10,
    saltEquivalentG: saltG ?? (isSweets ? 0.3 : isSoup ? 1.5 : 1.2),
    fiberG: isSweets ? 1.0 : isSoup ? 1.5 : 3.0,
    sugarG: isSweets ? Math.round(energyKcal * cRatio / 4 * 0.6 * 10) / 10 : 6.0,
    saturatedFatG: Math.round((energyKcal * fRatio / 9 * 0.35) * 10) / 10,
    potassiumMg: isSweets ? 120 : isSoup ? 280 : 380,
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

/**
 * Parse saltContent string (e.g. "2.0", "2.0g", "800mg") to grams of salt equivalent.
 * "mg" suffix is treated as sodium milligrams and converted to salt-equivalent grams (÷393).
 * Returns undefined when the value cannot be parsed or is non-positive.
 */
function parseSaltContent(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const normalized = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  const m = normalized.match(/(\d+(?:\.\d+)?)/)
  if (!m) return undefined
  const v = parseFloat(m[1])
  if (!Number.isFinite(v) || v <= 0) return undefined
  return /mg/i.test(raw) ? v / 393 : v
}

// Category-based default kcal per serving when no calorie data is available. (D)
const CATEGORY_DEFAULT_KCAL: Record<string, number> = {
  'スイーツ': 350,
  '主菜': 450,
  '副菜': 150,
  'スープ': 80,
}

export interface NutritionEstimationDiagnostics {
  totalIngredientCount: number
  matchedIngredientCount: number
  ingredientMatchRatio: number
  matchedWeightRatio: number
  usedFallback: boolean
  lowConfidence: boolean
  officialFoodCodeCount: number
  derivedFoodCodeCount: number
  matchedFoodCodes: string[]
  matchedKeywords: string[]
}

export interface NutritionEstimationResult {
  nutrition: RecipeNutritionPerServing
  diagnostics: NutritionEstimationDiagnostics
}

export function deriveEstimationConfidence(diagnostics: NutritionEstimationDiagnostics): number {
  if (diagnostics.usedFallback) return 0.28
  const weightScore = Math.min(Math.max(diagnostics.matchedWeightRatio, 0), 1)
  const ingredientScore = Math.min(Math.max(diagnostics.ingredientMatchRatio, 0), 1)
  const value = 0.3 + weightScore * 0.45 + ingredientScore * 0.2
  return Math.min(0.95, Math.max(0.35, Math.round(value * 100) / 100))
}

function estimateRecipeNutritionInternal(recipe: Recipe): NutritionEstimationResult {
  // E: clamp baseServings to a sane range (1–12) to guard against data anomalies
  const servings = Math.min(Math.max(recipe.baseServings > 0 ? recipe.baseServings : 2, 1), 12)
  const category = recipe.category ?? ''

  // Measured per-serving salt from the Healsio CSV (more accurate than ingredient estimates).
  // Computed once here and used in both the fallback and non-fallback return paths.
  const measuredSaltG = parseSaltContent(recipe.saltContent)

  // Accumulators
  let totalE = 0, totalP = 0, totalF = 0, totalC = 0, totalSalt = 0
  let totalFiber = 0, totalSugar = 0, totalSatFat = 0
  let totalK = 0, totalCa = 0, totalFe = 0, totalVitC = 0
  let matchedWeightG = 0
  let totalInputWeightG = 0
  let totalIngredientCount = 0
  let matchedIngredientCount = 0
  const matchedFoodCodes = new Set<string>()
  const matchedKeywords = new Set<string>()

  for (const ing of recipe.ingredients) {
    const normalizedName = normalizeIngredientName(ing.name)
    if (!normalizedName) continue
    if (isLikelyNonEdibleIngredient(normalizedName)) continue

    const rawQty = parseQuantityValue(ing.quantity)
    const normalized = normalizeUnitAndQuantity(rawQty, ing.unit)
    if (normalized.quantity <= 0) continue
    totalIngredientCount += 1

    const rawWeight = unitToGrams(
      normalized.quantity,
      normalized.unit,
      normalizedName,
      15,
      5,
      {}
    )
    if (rawWeight > 0) totalInputWeightG += rawWeight

    const found = findNutritionEntry(normalizedName)
    if (!found) continue

    const grams = unitToGrams(
      normalized.quantity,
      normalized.unit,
      normalizedName,
      found.oosajiG,
      found.kosajiG,
      found.unitGrams
    )
    if (grams <= 0) continue

    matchedIngredientCount += 1
    matchedFoodCodes.add(found.foodCode)
    matchedKeywords.add(found.matchedKeyword)

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
    : totalInputWeightG > 0
      ? Math.round((totalInputWeightG / servings) * 10) / 10
      : undefined

  // B: fallback when matched coverage is too thin
  const matchBaseWeight = totalInputWeightG > 0
    ? totalInputWeightG
    : recipe.totalWeightG > 0
      ? recipe.totalWeightG
      : 0
  const matchRatio = matchBaseWeight > 0 ? matchedWeightG / matchBaseWeight : 0
  const ingredientMatchRatio = totalIngredientCount > 0 ? matchedIngredientCount / totalIngredientCount : 0
  const useFallback =
    matchRatio < 0.15 ||
    matchedWeightG < 20 ||
    (matchBaseWeight > 0 && matchedWeightG < (matchBaseWeight / servings) * 0.25)

  const diagnosticsBase = {
    totalIngredientCount,
    matchedIngredientCount,
    ingredientMatchRatio,
    matchedWeightRatio: Number.isFinite(matchRatio) ? Math.max(0, matchRatio) : 0,
    officialFoodCodeCount: [...matchedFoodCodes].filter((code) => !code.startsWith('kw:')).length,
    derivedFoodCodeCount: [...matchedFoodCodes].filter((code) => code.startsWith('kw:')).length,
    matchedFoodCodes: [...matchedFoodCodes].sort(),
    matchedKeywords: [...matchedKeywords].sort(),
  }

  if (useFallback) {
    // D: category-aware default kcal when no calorie data exists
    const csvEnergy = recipe.nutritionPerServing?.energyKcal
      ?? parseCaloriesString(recipe.calories)
      ?? (recipe.totalWeightG > 0
        ? Math.round(recipe.totalWeightG / servings * 1.5)
        : (CATEGORY_DEFAULT_KCAL[category] ?? 400))

    // Salt priority: ingredient-computed → nutritionPerServing → parsedSaltContent
    const csvSalt = recipe.nutritionPerServing?.saltEquivalentG
      ?? (recipe.nutritionPerServing?.sodiumMg !== undefined
        ? recipe.nutritionPerServing.sodiumMg / 393
        : undefined)
      ?? measuredSaltG
    // A: prefer ingredient-computed salt when we matched enough weight
    const saltForFallback = (matchedWeightG >= 20 ? totalSalt / servings : undefined) ?? csvSalt

    const fb = energyBasedFallback(csvEnergy, saltForFallback, category)
    const nutrition: RecipeNutritionPerServing = {
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
    return {
      nutrition,
      diagnostics: {
        ...diagnosticsBase,
        usedFallback: true,
        lowConfidence: true,
      },
    }
  }

  const r = (v: number, dp = 1) => Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp)

  const nutrition: RecipeNutritionPerServing = {
    servingSizeG,
    energyKcal: Math.round(totalE / servings),
    proteinG: r(totalP / servings),
    fatG: r(totalF / servings),
    carbG: r(totalC / servings),
    // measuredSaltG (from Healsio CSV) is per-serving measured data; prefer over ingredient estimate.
    saltEquivalentG: measuredSaltG !== undefined ? r(measuredSaltG) : r(totalSalt / servings),
    fiberG: r(totalFiber / servings),
    sugarG: r(totalSugar / servings),
    saturatedFatG: r(totalSatFat / servings),
    potassiumMg: Math.round(totalK / servings),
    calciumMg: Math.round(totalCa / servings),
    ironMg: r(totalFe / servings),
    vitaminCMg: Math.round(totalVitC / servings),
  }
  const lowConfidence =
    diagnosticsBase.matchedWeightRatio < 0.45 ||
    diagnosticsBase.ingredientMatchRatio < 0.5
  return {
    nutrition,
    diagnostics: {
      ...diagnosticsBase,
      usedFallback: false,
      lowConfidence,
    },
  }
}

export function estimateRecipeNutritionDetailed(recipe: Recipe): NutritionEstimationResult {
  return estimateRecipeNutritionInternal(recipe)
}

export function estimateRecipeNutrition(recipe: Recipe): RecipeNutritionPerServing {
  return estimateRecipeNutritionInternal(recipe).nutrition
}
