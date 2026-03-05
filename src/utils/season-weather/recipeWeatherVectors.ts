/**
 * recipeWeatherVectors.ts — Phase 2: レシピ × 気象4次元ベクトル
 *
 * レシピの材料・栄養・調理特性から 4D 属性ベクトルを算出する。
 * 天気需要ベクトルとのドット積でスコアリングし、スコア識別率を
 * Phase 1 の ~35% から ~50% へ引き上げる。
 *
 * ベクトル定義:
 *   x_temp  [0,1] 温料理強度  (鍋/スープ/煮込み系=高, サラダ/冷製=低)
 *   x_water [0,1] 汁物・水分  (汁物/スープ系=高, 炒め/揚げ=低)
 *   x_spice [0,1] 辛み強度    (唐辛子/キムチ/カレー系=高)
 *   x_carb  [0,1] 糖質密度    (carbG/50 で正規化、栄養未取得時=0.5)
 */

import type { Recipe } from '../../db/db'
import { WARM_TITLE_RE, COLD_TITLE_RE, SPICE_KEYWORDS_RE } from './recipeKeywords'

/** レシピの気象属性ベクトル (x_temp, x_water, x_spice, x_carb) */
export type RecipeWeatherVec = [number, number, number, number]

// ── キーワードセット ─────────────────────────────────────────────────────────

const SOUP_INGREDIENTS = /だし|スープ|ブイヨン|コンソメ|みそ汁|お吸い物|ポタージュ|チャウダー|湯|水[（(]多め/
/** RecipeCategory === 'スープ' の場合に汁物スコアを加算 */
const SOUP_CATEGORY = 'スープ' as const

// ── 各次元の計算 ──────────────────────────────────────────────────────────────

/**
 * x_temp: 温料理強度
 * 鍋/スープ/煮込み系タイトル → 高い / 冷製系タイトル → 低い
 * 調理時間が長いほど加点（長時間加熱 = 温かい料理の傾向）
 */
function computeXTemp(recipe: Recipe): number {
  const title = recipe.title
  let score = 0.5 // 中間値をデフォルト

  if (WARM_TITLE_RE.test(title)) score += 0.35
  if (COLD_TITLE_RE.test(title)) score -= 0.35

  // 調理時間が長い = 煮込み・蒸し料理 = 温料理傾向
  const minutes = recipe.totalTimeMinutes ?? 30
  if (minutes >= 60) score += 0.10
  else if (minutes <= 15) score -= 0.10

  return Math.max(0, Math.min(1, score))
}

/**
 * x_water: 汁物・水分強度
 * カテゴリが'スープ'、または材料に汁物キーワードを含む場合に高スコア
 */
function computeXWater(recipe: Recipe): number {
  const ingredientNames = recipe.ingredients.map((i) => i.name).join(' ')

  let score = 0.2 // 炒め/揚げ系はデフォルト低め
  if (SOUP_INGREDIENTS.test(ingredientNames)) score += 0.5
  if (recipe.category === SOUP_CATEGORY) score += 0.3

  return Math.max(0, Math.min(1, score))
}

/**
 * x_spice: 辛み強度
 * 辛み系食材・タイトルを含む場合に高スコア
 */
function computeXSpice(recipe: Recipe): number {
  const ingredientNames = recipe.ingredients.map((i) => i.name).join(' ')

  let score = 0.0
  if (SPICE_KEYWORDS_RE.test(ingredientNames)) score += 0.6
  if (SPICE_KEYWORDS_RE.test(recipe.title)) score += 0.3

  return Math.max(0, Math.min(1, score))
}

/**
 * x_carb: 糖質密度
 * nutritionPerServing.carbG / 50g で正規化。
 * 栄養データ未取得時は 0.5（中間値）でフォールバック。
 */
function computeXCarb(recipe: Recipe): number {
  const carb = recipe.nutritionPerServing?.carbG
  if (carb == null) return 0.5
  return Math.max(0, Math.min(1, carb / 50))
}

// ── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * レシピから気象属性ベクトルを計算する。
 * ベクトル要素順: [x_temp, x_water, x_spice, x_carb]
 */
export function computeRecipeWeatherVec(recipe: Recipe): RecipeWeatherVec {
  return [
    computeXTemp(recipe),
    computeXWater(recipe),
    computeXSpice(recipe),
    computeXCarb(recipe),
  ]
}

/** ベクトルのドット積 */
export function dotProduct(a: RecipeWeatherVec, b: RecipeWeatherVec): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
}
