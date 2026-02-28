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
// Weekly menu scoring: balance and pairing weights
// ---------------------------------------------------------------------------

/** 主菜/副菜スコア調整の重み（週間献立バランス） */
export const BALANCE_WEIGHTS = {
  // Main selection
  categoryRepeatPenalty: 10,
  mainPrimaryConsecutivePenalty: 14,
  mainPrimaryWeeklyPenalty: 8,
  mainHeavyConsecutivePenalty: 9,
  mainVegetableRecoveryBonus: 8,
  mainLightRecoveryBonus: 6,
  mainFatOverloadPenalty: 7,
  mainColorDiversityBonus: 4,
  mainColorOverusePenalty: 2,
  // Side selection
  sideCategoryRepeatPenalty: 8,
  genreMatchBonus: 15,
  heavyToLightBonus: 10,
  lightToHeavyBonus: 5,
  heavyPairPenalty: 10,
  sideVegetableComplementBonus: 11,
  sideSoupComplementBonus: 8,
  sideFatOnFatPenalty: 8,
  sidePrimaryOverlapPenalty: 7,
  sideColorComplementBonus: 4,
  sideSameColorPenalty: 2,
} as const

/** 主菜デバイス配分の重み */
export const WEEKLY_MENU_DEVICE_WEIGHTS = {
  deficitBonus: 12,
  overTargetPenalty: 8,
  alternationBonus: 3,
} as const

// ---------------------------------------------------------------------------
// Weekly menu scoring tier strategy (Phase F)
// ---------------------------------------------------------------------------

export const BALANCE_SCORING_MODE = {
  AUTO: 'auto',
  HEURISTIC_3: 'heuristic-3',
  NUTRITION_5: 'nutrition-5',
  NUTRITION_7: 'nutrition-7',
} as const

/** デフォルトはデータ充足率を見て自動判定 */
export const DEFAULT_BALANCE_SCORING_MODE = BALANCE_SCORING_MODE.AUTO

/** 5段階/7段階へ昇格する最小カバレッジ率 */
export const BALANCE_SCORING_MIN_COVERAGE = {
  nutrition5: 0.7,
  nutrition7: 0.6,
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
