/**
 * Recipe-related constants shared across utility modules.
 * Centralising magic numbers here makes intent clear and simplifies future tuning.
 */

// ---------------------------------------------------------------------------
// Salt / Seasoning ratios
// ---------------------------------------------------------------------------

/** 醤油の塩分濃度（16%） */
export const SOY_SAUCE_SALT_RATIO = 0.16

/** 醤油の比重 ml → g 換算 */
export const SOY_SAUCE_DENSITY = 1.17

/** 味噌の塩分濃度（12%） */
export const MISO_SALT_RATIO = 0.12

// ---------------------------------------------------------------------------
// Weekly menu scoring: seasonal priority weights
// ---------------------------------------------------------------------------

/** 週間献立スコア: 旬優先度ウェイト */
export const SEASONAL_WEIGHT = {
  /** 旬でない (low) */
  OFF: 0.5,
  /** 普通 (medium) */
  NORMAL: 1.5,
  /** 旬 (high) */
  PEAK: 3.0,
} as const

// ---------------------------------------------------------------------------
// Preference signals: half-life for decay weighting (days)
// ---------------------------------------------------------------------------

/** 閲覧履歴の半減期（日） */
export const VIEW_HISTORY_HALF_LIFE_DAYS = 21

/** お気に入りの半減期（日） */
export const FAVORITE_HALF_LIFE_DAYS = 45

/** カレンダーイベントの半減期（日） */
export const CALENDAR_EVENT_HALF_LIFE_DAYS = 30

// ---------------------------------------------------------------------------
// Ingredient unit weight estimates for salt-serving calculations (g)
// ---------------------------------------------------------------------------

/** 食材単位別デフォルト重量推定（g） */
export const INGREDIENT_UNIT_WEIGHT_G: Record<string, number> = {
  '個': 150,
  '本': 150,
  '株': 150,
  '片': 10,
  '大さじ': 15,
  '小さじ': 5,
}

/** 不明単位のフォールバック重量推定（g） */
export const UNKNOWN_UNIT_FALLBACK_WEIGHT_G = 50
