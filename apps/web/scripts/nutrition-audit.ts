import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Recipe } from '../src/db/db'
import { estimateRecipeNutritionDetailed } from '../src/utils/nutritionEstimator'
import { NUTRITION_PATTERNS, NUTRITION_REFERENCE } from '../src/data/nutritionLookup'
import { normalizeIngredientName } from '../src/utils/ingredientNormalization'

interface RawRecipe {
  id?: number
  title: string
  nutritionPerServing?: Record<string, unknown>
  ingredients: Array<{ name: string, quantity: number | string, unit: string, category: 'main' | 'sub' }>
  [key: string]: unknown
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

const THRESHOLD = {
  nutrition5Coverage: 0.95,
  nutrition7Coverage: 0.95,
  ingredientMatchRate: 0.85,
} as const

const N5_FIELDS = ['servingSizeG', 'energyKcal', 'proteinG', 'fatG', 'carbG'] as const
const N7_EXTRA_FIELDS = ['fiberG', 'sugarG', 'saturatedFatG', 'potassiumMg', 'calciumMg', 'ironMg', 'vitaminCMg'] as const
const NON_EDIBLE_INGREDIENT_KEYWORDS = ['容器サイズ', 'アルミケース', 'アルミホイル', 'クッキングシート', '竹串', '楊枝', '耐熱皿', 'ラップ'] as const

function isLikelyNonEdibleIngredient(name: string): boolean {
  return NON_EDIBLE_INGREDIENT_KEYWORDS.some((keyword) => name.includes(keyword))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNutrition5Ready(nutrition: Record<string, unknown> | undefined): boolean {
  if (!nutrition) return false
  for (const field of N5_FIELDS) {
    if (!isFiniteNumber(nutrition[field])) return false
  }
  return isFiniteNumber(nutrition.saltEquivalentG) || isFiniteNumber(nutrition.sodiumMg)
}

function isNutrition7Ready(nutrition: Record<string, unknown> | undefined): boolean {
  if (!isNutrition5Ready(nutrition)) return false
  if (!nutrition) return false
  for (const field of N7_EXTRA_FIELDS) {
    if (!isFiniteNumber(nutrition[field])) return false
  }
  return true
}

function loadRecipes(): RawRecipe[] {
  const hotcookPath = path.join(ROOT, 'src/data/recipes-hotcook.json')
  const healsioPath = path.join(ROOT, 'src/data/recipes-healsio.json')
  const hotcook = JSON.parse(fs.readFileSync(hotcookPath, 'utf8')) as RawRecipe[]
  const healsio = JSON.parse(fs.readFileSync(healsioPath, 'utf8')) as RawRecipe[]
  return [...hotcook, ...healsio]
}

function ingredientMatchesLookup(name: string): boolean {
  const normalized = normalizeIngredientName(name)
  if (!normalized) return false
  for (const { keywords } of NUTRITION_PATTERNS) {
    if (keywords.some((kw) => normalized.includes(kw))) return true
  }
  return false
}

function buildUnmatchedIngredients(recipes: RawRecipe[]): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const name = ingredient.name.trim()
      if (!name) continue
      if (isLikelyNonEdibleIngredient(name)) continue
      if (ingredientMatchesLookup(name)) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function main(): void {
  const recipes = loadRecipes()
  const total = recipes.length

  let nutrition5Ready = 0
  let nutrition7Ready = 0
  let ingredientTotal = 0
  let ingredientMatched = 0

  let outlierEnergyLow = 0
  let outlierEnergyHigh = 0
  let outlierSaltHigh = 0
  let outlierProteinHigh = 0
  let fallbackCount = 0
  let lowConfidenceCount = 0
  let officialFoodCodeHits = 0
  let derivedFoodCodeHits = 0

  for (const recipe of recipes) {
    const { nutrition: generated, diagnostics } = estimateRecipeNutritionDetailed(recipe as Recipe)
    if (isNutrition5Ready(generated as unknown as Record<string, unknown>)) nutrition5Ready += 1
    if (isNutrition7Ready(generated as unknown as Record<string, unknown>)) nutrition7Ready += 1
    if (diagnostics.usedFallback) fallbackCount += 1
    if (diagnostics.lowConfidence) lowConfidenceCount += 1

    if ((generated.energyKcal ?? 0) < 20) outlierEnergyLow += 1
    if ((generated.energyKcal ?? 0) > 1400) outlierEnergyHigh += 1
    if ((generated.saltEquivalentG ?? 0) > 10) outlierSaltHigh += 1
    if ((generated.proteinG ?? 0) > 80) outlierProteinHigh += 1
    officialFoodCodeHits += diagnostics.officialFoodCodeCount
    derivedFoodCodeHits += diagnostics.derivedFoodCodeCount

    for (const ingredient of recipe.ingredients) {
      if (isLikelyNonEdibleIngredient(ingredient.name)) continue
      ingredientTotal += 1
      if (ingredientMatchesLookup(ingredient.name)) ingredientMatched += 1
    }
  }

  const nutrition5Coverage = total > 0 ? nutrition5Ready / total : 0
  const nutrition7Coverage = total > 0 ? nutrition7Ready / total : 0
  const ingredientMatchRate = ingredientTotal > 0 ? ingredientMatched / ingredientTotal : 0
  const topUnmatched = buildUnmatchedIngredients(recipes).slice(0, 20)

  console.log('=== Nutrition Audit ===')
  console.log(`reference: ${NUTRITION_REFERENCE.label}`)
  console.log(`recipes: ${total}`)
  console.log(`nutrition5 coverage: ${(nutrition5Coverage * 100).toFixed(1)}% (${nutrition5Ready}/${total})`)
  console.log(`nutrition7 coverage: ${(nutrition7Coverage * 100).toFixed(1)}% (${nutrition7Ready}/${total})`)
  console.log(`ingredient match rate: ${(ingredientMatchRate * 100).toFixed(1)}% (${ingredientMatched}/${ingredientTotal})`)
  console.log(`fallback recipes: ${fallbackCount}`)
  console.log(`low-confidence recipes: ${lowConfidenceCount}`)
  console.log(`foodCode hits: official=${officialFoodCodeHits}, derived=${derivedFoodCodeHits}`)
  console.log('outliers:')
  console.log(`  energy < 20 kcal: ${outlierEnergyLow}`)
  console.log(`  energy > 1400 kcal: ${outlierEnergyHigh}`)
  console.log(`  saltEquivalentG > 10g: ${outlierSaltHigh}`)
  console.log(`  proteinG > 80g: ${outlierProteinHigh}`)
  if (topUnmatched.length > 0) {
    console.log('top unmatched ingredients:')
    for (const [name, count] of topUnmatched) {
      console.log(`  ${name}: ${count}`)
    }
  }

  const failed =
    nutrition5Coverage < THRESHOLD.nutrition5Coverage ||
    nutrition7Coverage < THRESHOLD.nutrition7Coverage ||
    ingredientMatchRate < THRESHOLD.ingredientMatchRate

  if (failed) {
    console.error('\n❌ nutrition audit failed thresholds')
    console.error(`required: n5>=${THRESHOLD.nutrition5Coverage * 100}%, n7>=${THRESHOLD.nutrition7Coverage * 100}%, match>=${THRESHOLD.ingredientMatchRate * 100}%`)
    process.exitCode = 1
    return
  }

  console.log('\n✅ nutrition audit passed')
}

main()
