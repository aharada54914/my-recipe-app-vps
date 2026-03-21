/**
 * tOptLearner.ts — Phase 3: T_opt 個人最適気温パラメータ学習
 *
 * 週間献立の採用履歴（weeklyMenus）と天気キャッシュ（weatherCache）を
 * 突き合わせ、ユーザーの気温嗜好を反映した個人最適気温 T_opt を推定する。
 *
 * アルゴリズム:
 * 1. 直近30日の確定済み週間献立を取得
 * 2. 各献立日のレシピの "温度方向性"（温料理=+1, 冷料理=-1）を評価
 * 3. その日の気温と料理温度方向性の相関から T_opt を更新
 *    - 高温日に温料理を採用 → ユーザーのT_optは高め
 *    - 低温日に冷料理を採用 → ユーザーのT_optは低め
 * 4. EMA（指数移動平均）で既存T_optを更新
 *
 * デフォルト: T_opt = 22°C（日本人平均的な快適気温の中点）
 * 範囲: [10, 32]°C でクランプ（生理的に妥当な範囲）
 */

import { db } from '../../db/db'
import type { WeeklyMenu } from '../../db/db'
import { WARM_TITLE_RE, COLD_TITLE_RE } from './recipeKeywords'

const T_OPT_DEFAULT = 22
const T_OPT_MIN = 10
const T_OPT_MAX = 32
const LEARNING_RATE = 0.15  // EMA学習率: 新データの重み
const LOOKBACK_DAYS = 30    // 参照する過去日数

/** 料理タイトルから温冷方向性を推定 (-1.0〜+1.0) */
function recipeTempDirection(title: string): number {
  if (WARM_TITLE_RE.test(title)) return 1.0
  if (COLD_TITLE_RE.test(title)) return -1.0
  return 0.0
}

/**
 * 週間献立採用履歴から T_opt を学習し、更新値を返す。
 * DB への書き込みは行わない（呼び出し元が UserPreferences を更新する）。
 *
 * @param currentTOpt 現在のT_opt値（未設定なら22°C）
 * @returns 更新後の T_opt（収束していれば大きく変化しない）
 */
export async function learnTOptFromHistory(currentTOpt = T_OPT_DEFAULT): Promise<number> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000)

  // 全週間献立を取得してJSでフィルタリング（weeklyMenusはupdatedAtにインデックスなし）
  const allMenus: WeeklyMenu[] = await db.weeklyMenus.toArray()
  const recentMenus = allMenus.filter(
    (m) =>
      m.updatedAt >= cutoff &&
      (m.status === 'confirmed' || m.status === 'registered'),
  )

  if (recentMenus.length === 0) return currentTOpt

  // 天気キャッシュを date → maxTempC マップに変換
  const weatherEntries = await db.weatherCache.toArray()
  const weatherByDate = new Map<string, number>(
    weatherEntries.map((w) => [w.date, w.maxTempC]),
  )

  let tOptEstimate = currentTOpt
  let dataPoints = 0

  for (const menu of recentMenus) {
    const weekStart = new Date(menu.weekStartDate)

    for (let dayIndex = 0; dayIndex < menu.items.length; dayIndex++) {
      const menuItem = menu.items[dayIndex]
      const recipe = await db.recipes.get(menuItem.recipeId)
      if (!recipe) continue

      const itemDate = new Date(weekStart)
      itemDate.setDate(weekStart.getDate() + dayIndex)
      const dateStr = itemDate.toISOString().slice(0, 10)

      const tempC = weatherByDate.get(dateStr)
      if (tempC == null) continue

      const direction = recipeTempDirection(recipe.title)
      if (direction === 0) continue  // 方向性不明はスキップ

      // 温料理を採用した日の気温 + 5°C = 推定 T_opt（その気温でも温料理を好む）
      // 冷料理を採用した日の気温 - 5°C = 推定 T_opt（その気温でも冷料理を好む）
      const impliedTOpt = tempC + direction * 5
      tOptEstimate = tOptEstimate * (1 - LEARNING_RATE) + impliedTOpt * LEARNING_RATE
      dataPoints++
    }
  }

  if (dataPoints === 0) return currentTOpt

  // 生理的範囲でクランプ（小数第1位まで）
  return Math.max(T_OPT_MIN, Math.min(T_OPT_MAX, Math.round(tOptEstimate * 10) / 10))
}
