import type { Recipe } from '../../db/db'
import type { DailyWeather } from './weatherProvider'
import type { RecipeWeatherVec } from './recipeWeatherVectors'

// ── Phase 1 helpers ─────────────────────────────────────────────────────────

/**
 * 不快指数 (Discomfort Index)
 * DI = T - 0.55 × (1 - H/100) × (T - 14.5)
 *   DI < 70: 不快でない
 *   DI ≥ 75: 半数が不快
 *   DI ≥ 85: ほぼ全員が不快
 */
function computeDI(tempC: number, humidityPct: number): number {
  return tempC - 0.55 * (1 - humidityPct / 100) * (tempC - 14.5)
}

/**
 * DI_crit ≈ 78 でシグモイド遷移する水分欲求スコア
 * 高DI → 汁物・さっぱり系レシピへの欲求が高まる
 */
function wWater(di: number): number {
  return 1 / (1 + Math.exp(-0.4 * (di - 78)))
}

/**
 * 気象庁weatherCode文字列から日射量プロキシを推定
 *   1xx = 快晴〜晴れ → 1.0
 *   2xx = 曇り      → 0.35
 *   3xx = 雨        → 0.1
 */
export function solarFactor(weatherCode: string): number {
  const code = parseInt(weatherCode, 10)
  if (code < 200) return 1.0
  if (code < 300) return 0.35
  return 0.1
}

// ── 各スコア因子 ──────────────────────────────────────────────────────────────

/**
 * 気温適合度（連続関数版）
 * T_opt = 22°C を基準とし、全レシピにスコアを割り当てる。
 * 旧実装はタイトル正規表現で約7%のレシピのみ判定していたが、
 * 本実装では連続関数により全レシピを識別可能にする。
 *
 * 快晴日は日射による体感温度上昇（最大+2°C）を加味し、
 * 暑い晴れの日ほど涼し系レシピが上位に来やすくする。
 */
function thermalFit(_recipe: Recipe, weather: DailyWeather): number {
  const T_OPT = 22
  const solar = solarFactor(weather.weatherCode ?? '101')
  // 快晴: +2°C / 曇: -0.6°C / 雨: -1.6°C の体感補正
  const apparentTemp = weather.maxTempC + (solar - 0.5) * 4
  const delta = T_OPT - apparentTemp
  // delta ∈ [-20, +20] → score ∈ [0, 1]（低温=delta正=温料理選好、高温=delta負=冷料理選好）
  return Math.max(0, Math.min(1, 0.5 + delta / 40))
}

function cookingLoadFit(recipe: Recipe, weather: DailyWeather): number {
  const minutes = recipe.totalTimeMinutes ?? 30
  if (weather.maxTempC >= 30) return minutes <= 20 ? 1 : 0.5
  return minutes <= 40 ? 0.8 : 0.6
}

function shoppingBurdenFit(recipe: Recipe, weather: DailyWeather): number {
  if (weather.precipitationMm < 5) return 0.7
  const mainCount = recipe.ingredients.filter((i) => i.category === 'main').length
  return mainCount <= 5 ? 1 : 0.6
}

/**
 * 水分欲求適合度
 * 不快指数（DI）をシグモイド関数に通してスコア化する。
 * humidityPercent が未取得の場合は季節平均値 60% でフォールバック。
 */
function waterFit(weather: DailyWeather): number {
  const humidity = weather.humidityPercent ?? 60
  const di = computeDI(weather.maxTempC, humidity)
  return wWater(di)
}

// ── 公開 API（シグネチャ不変） ────────────────────────────────────────────────

/**
 * 天気快適スコアを計算する。
 * 呼び出し元（HomePage.tsx, weeklyMenuSelector.ts）のシグネチャは変更しない。
 *
 * 重み配分（Phase 1）:
 *   thermalFit      0.40 (旧 0.45)  — 連続関数化によりレシピ識別率が大幅向上
 *   cookingLoadFit  0.25 (旧 0.30)
 *   shoppingBurden  0.20 (旧 0.25)
 *   waterFit        0.15 (新規)     — 不快指数DI × humidityPercent を活用
 */
export function computeWeatherComfortScore(recipe: Recipe, weather: DailyWeather): number {
  const score =
    0.40 * thermalFit(recipe, weather) +
    0.25 * cookingLoadFit(recipe, weather) +
    0.20 * shoppingBurdenFit(recipe, weather) +
    0.15 * waterFit(weather)
  return Math.round(score * 100) / 100
}

// ── Phase 2: 需要ベクトル計算 ─────────────────────────────────────────────────

/**
 * 天気から食欲需要4Dベクトルを算出する（Phase 2 ベクトルドット積スコアリング用）
 *
 * ベクトル定義:
 *   w_temp  [0,1] 温料理欲求  (低温=高, 高温=低)
 *   w_water [0,1] 水分欲求    (高DI=高 → 汁物・スープ欲求)
 *   w_spice [0,1] 辛み欲求    (冷域10°C / 熱域35°C で双峰応答)
 *   w_carb  [0,1] 糖質欲求    (曇天・低日射=高 → 炭水化物欲求 + 季節補正)
 *
 * @param weather 当日の天気データ
 * @param tOpt    個人最適気温(°C)。未指定時は22°C。Phase 3 T_opt学習で更新。
 * @param dayOfYear 年通算日(1-365)。未指定時は circannual 補正なし。
 */
export function computeWeatherDemandVec(
  weather: DailyWeather,
  tOpt = 22,
  dayOfYear?: number,
): RecipeWeatherVec {
  const humidity = weather.humidityPercent ?? 60
  const di = computeDI(weather.maxTempC, humidity)
  const solar = solarFactor(weather.weatherCode ?? '101')

  // w_temp: T_opt を基準に低温→温料理欲求↑ (個人キャリブレーション対応)
  const w_temp = Math.max(0, Math.min(1, (tOpt - weather.maxTempC) / 20 + 0.5))

  // w_water: 不快指数シグモイド (DI=78 で中点)
  const w_water = wWater(di)

  // w_spice: 冷域(10°C)と熱域(35°C)で辛み欲求が高まる双峰ガウス
  const cold = Math.exp(-((weather.maxTempC - 10) ** 2) / (2 * 8 ** 2))
  const hot = Math.exp(-((weather.maxTempC - 35) ** 2) / (2 * 6 ** 2))
  const w_spice = Math.min(1, (cold + hot) * 0.7)

  // w_carb: 曇天・低日射 → 炭水化物欲求↑ + 秋の過食期 circannual 補正
  const B_carb = dayOfYear != null ? circannualCarbBaseline(dayOfYear) : 0
  const w_carb = Math.max(0, Math.min(1, (1 - solar) * 0.6 + 0.2 + B_carb))

  return [w_temp, w_water, w_spice, w_carb]
}

// ── Phase 3: 個人化・季節補正 ─────────────────────────────────────────────────

/**
 * 年通算日から炭水化物欲求の季節ベースラインシフトを算出する。
 * 秋分(Sd≈280)前後で最大+0.15、春先でピークが引く circannual リズム。
 * 生物学的秋季過食（hyperphagia）に基づく。
 */
export function circannualCarbBaseline(dayOfYear: number): number {
  return 0.15 * Math.cos((2 * Math.PI) / 365 * (dayOfYear - 280))
}

/**
 * T_opt を使用する天気快適スコア（個人キャリブレーション対応版）
 * 基本の computeWeatherComfortScore とシグネチャが異なるため別名で提供。
 */
export function computeWeatherComfortScoreWithTopt(
  recipe: Recipe,
  weather: DailyWeather,
  tOpt: number,
): number {
  // thermalFit を T_opt 対応で再計算
  const solar = solarFactor(weather.weatherCode ?? '101')
  const apparentTemp = weather.maxTempC + (solar - 0.5) * 4
  const delta = tOpt - apparentTemp
  const personalThermalFit = Math.max(0, Math.min(1, 0.5 + delta / 40))

  const score =
    0.40 * personalThermalFit +
    0.25 * cookingLoadFit(recipe, weather) +
    0.20 * shoppingBurdenFit(recipe, weather) +
    0.15 * waterFit(weather)
  return Math.round(score * 100) / 100
}
