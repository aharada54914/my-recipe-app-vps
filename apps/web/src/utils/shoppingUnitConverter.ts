/**
 * Shopping Unit Converter
 *
 * Converts recipe quantities (g, ml) to retail shopping units
 * (本, 個, パック, 袋, 丁, etc.) for easier supermarket shopping.
 *
 * Strategy:
 * - Always round UP to avoid running short
 * - Show original recipe quantity as a note (e.g. "約150g分")
 * - Items already in count units (個, 本, 枚, etc.) are returned as-is
 * - Water, stock, oils, and liquid seasonings are NOT converted (no useful retail mapping)
 */

export interface ShoppingQuantity {
  quantity: number | string  // e.g. 1, 0.5, "1/2"
  unit: string               // e.g. "本", "パック"
  note?: string              // e.g. "約150g分"
}

interface RetailRule {
  /** Substrings to match against ingredient name — ordered most-specific first */
  patterns: string[]
  /** Which recipe unit this rule converts FROM */
  fromUnit: 'g' | 'ml'
  /** Retail shopping unit */
  toUnit: string
  /** Grams (or ml) per 1 retail unit */
  sizePerUnit: number
  /**
   * Supported fractional quantities in ascending order.
   * Conversion rounds UP to the nearest supported value.
   * If omitted, rounds up to nearest whole number.
   */
  fractions?: number[]
}

/** Units that are already count-based — no conversion needed */
const COUNT_UNITS = new Set([
  '個', '本', '枚', '切れ', '尾', '杯', '束', '袋', '丁', 'パック',
  'かけ', '片', '節', '株', '玉', '合', '缶', '瓶', '箱', '斤',
  '大さじ', '小さじ', 'カップ', '適量', '-', '羽', '腹',
])

/**
 * Ingredients for which ml-based conversion makes NO sense
 * (water, stock, oils, liquid seasonings — bought in bulk or made at home).
 */
const NO_CONVERT_ML_PATTERNS = [
  '水', 'だし', 'スープ', 'ブイヨン', '湯', 'お湯', 'ぬるま湯',
  '醤油', 'しょうゆ', 'みりん', '酒', '酢', 'ポン酢',
  'サラダ油', 'ごま油', 'オリーブ油', 'オリーブオイル',
  'ナンプラー', 'めんつゆ', 'ウスターソース', 'トンカツソース',
  'レモン汁', 'ゆず汁', 'ポン酢',
]

const RETAIL_RULES: RetailRule[] = [
  // ── 野菜（g → 本/個/袋/玉/節/株） ──────────────────────────────
  // NOTE: more-specific patterns listed before generic ones in each rule,
  //       and rules with longer/more-specific ingredient names come first.

  {
    patterns: ['グリーンアスパラガス', 'アスパラガス'],
    fromUnit: 'g',
    toUnit: '束',
    sizePerUnit: 100,
    fractions: [1, 2],
  },
  {
    patterns: ['赤パプリカ', '黄パプリカ', 'オレンジパプリカ', 'パプリカ'],
    fromUnit: 'g',
    toUnit: '個',
    sizePerUnit: 150,
    fractions: [1, 2, 3],
  },
  {
    patterns: ['にんじん', '人参'],
    fromUnit: 'g',
    toUnit: '本',
    sizePerUnit: 150,
    fractions: [0.5, 1, 2, 3],
  },
  {
    patterns: ['だいこん', '大根'],
    fromUnit: 'g',
    toUnit: '本',
    sizePerUnit: 1200,
    fractions: [0.25, 0.5, 1],
  },
  {
    patterns: ['ごぼう'],
    fromUnit: 'g',
    toUnit: '本',
    sizePerUnit: 200,
    fractions: [0.5, 1, 2],
  },
  {
    patterns: ['さつまいも'],
    fromUnit: 'g',
    toUnit: '本',
    sizePerUnit: 250,
    fractions: [0.5, 1, 2],
  },
  {
    patterns: ['かぼちゃ'],
    fromUnit: 'g',
    toUnit: '個',
    sizePerUnit: 1600,
    fractions: [0.25, 0.5, 1],
  },
  {
    patterns: ['キャベツ'],
    fromUnit: 'g',
    toUnit: '玉',
    sizePerUnit: 1200,
    fractions: [0.25, 0.5, 1],
  },
  {
    patterns: ['はくさい', '白菜'],
    fromUnit: 'g',
    toUnit: '個',
    sizePerUnit: 2000,
    fractions: [0.25, 0.5, 1],
  },
  {
    patterns: ['ブロッコリー'],
    fromUnit: 'g',
    toUnit: '株',
    sizePerUnit: 300,
    fractions: [0.5, 1, 2],
  },
  {
    patterns: ['ほうれん草'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['こまつな', '小松菜'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['ニラ', 'にら'],
    fromUnit: 'g',
    toUnit: '束',
    sizePerUnit: 100,
    fractions: [1, 2],
  },
  {
    patterns: ['もやし'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['れんこん', '蓮根'],
    fromUnit: 'g',
    toUnit: '節',
    sizePerUnit: 200,
    fractions: [0.5, 1, 2],
  },
  {
    patterns: ['チンゲン菜', 'チンゲンサイ', 'チンゲンさい'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['えのきだけ', 'えのき'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['しめじ'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 100,
    fractions: [1, 2],
  },
  {
    patterns: ['エリンギ'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 100,
    fractions: [1, 2],
  },
  {
    patterns: ['まいたけ', '舞茸'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 100,
    fractions: [1, 2],
  },
  {
    patterns: ['きくらげ'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 50,
    fractions: [1, 2],
  },
  {
    patterns: ['しいたけ'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 100,
    fractions: [1, 2],
  },
  {
    patterns: ['レタス'],
    fromUnit: 'g',
    toUnit: '個',
    sizePerUnit: 300,
    fractions: [0.5, 1],
  },
  {
    patterns: ['玉ねぎ', 'たまねぎ'],
    fromUnit: 'g',
    toUnit: '個',
    sizePerUnit: 200,
    fractions: [1, 2, 3, 4],
  },
  {
    patterns: ['じゃがいも'],
    fromUnit: 'g',
    toUnit: '個',
    sizePerUnit: 150,
    fractions: [1, 2, 3, 4],
  },
  {
    patterns: ['さやいんげん', 'いんげん'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 150,
    fractions: [1, 2],
  },
  {
    patterns: ['貝割れ菜'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 50,
    fractions: [1, 2],
  },
  {
    patterns: ['里いも', '里芋', 'さといも'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 300,
    fractions: [1, 2],
  },
  {
    patterns: ['長いも', 'ながいも', '長芋'],
    fromUnit: 'g',
    toUnit: '本',
    sizePerUnit: 500,
    fractions: [0.5, 1],
  },
  {
    patterns: ['かぶ'],
    fromUnit: 'g',
    toUnit: '個',
    sizePerUnit: 150,
    fractions: [1, 2, 3],
  },
  {
    patterns: ['セロリ'],
    fromUnit: 'g',
    toUnit: '本',
    sizePerUnit: 150,
    fractions: [0.5, 1, 2],
  },
  {
    patterns: ['白ねぎ', '青ねぎ', '長ねぎ', 'ねぎ'],
    fromUnit: 'g',
    toUnit: '本',
    sizePerUnit: 100,
    fractions: [1, 2, 3],
  },
  {
    patterns: ['たけのこの水煮', 'たけのこ'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['スイートコーン', 'コーン'],
    fromUnit: 'g',
    toUnit: '缶',
    sizePerUnit: 200,
    fractions: [1, 2],
  },

  // ── 液体（ml → 本/パック） ───────────────────────────────────────
  {
    patterns: ['牛乳'],
    fromUnit: 'ml',
    toUnit: '本',
    sizePerUnit: 500,
    fractions: [1, 2],
  },
  {
    patterns: ['生クリーム'],
    fromUnit: 'ml',
    toUnit: 'パック',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['豆乳'],
    fromUnit: 'ml',
    toUnit: 'パック',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['ホールトマト', 'トマト缶', 'カットトマト'],
    fromUnit: 'ml',
    toUnit: '缶',
    sizePerUnit: 400,
    fractions: [1],
  },
  {
    patterns: ['ココナッツミルク'],
    fromUnit: 'ml',
    toUnit: '缶',
    sizePerUnit: 400,
    fractions: [1],
  },
  {
    patterns: ['白ワイン', '赤ワイン'],
    fromUnit: 'ml',
    toUnit: '本',
    sizePerUnit: 750,
    fractions: [1],
  },

  // ── 肉類（g → パック/枚） ────────────────────────────────────────
  // Specific cuts before generic names
  {
    patterns: ['豚ひき肉', '鶏ひき肉', '合びき肉', '牛ひき肉', 'ひき肉'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 250,
    fractions: [1, 2],
  },
  {
    patterns: ['豚バラ薄切り肉', '豚バラ', '豚肉（バラ）'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 250,
    fractions: [1, 2],
  },
  {
    patterns: ['豚ロース薄切り肉', '豚ロース', '豚肉（ロース）'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 250,
    fractions: [1, 2],
  },
  {
    patterns: ['豚もも肉', '豚肉（もも）'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 250,
    fractions: [1, 2],
  },
  {
    patterns: ['豚ヒレ肉'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 300,
    fractions: [1, 2],
  },
  {
    patterns: ['豚肉'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 250,
    fractions: [1, 2],
  },
  {
    patterns: ['鶏もも肉'],
    fromUnit: 'g',
    toUnit: '枚',
    sizePerUnit: 250,
    fractions: [1, 2],
  },
  {
    patterns: ['鶏むね肉'],
    fromUnit: 'g',
    toUnit: '枚',
    sizePerUnit: 250,
    fractions: [1, 2],
  },
  {
    patterns: ['牛薄切り肉', '牛バラ', '牛切り落とし'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['牛もも肉'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['牛肉'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['ベーコン'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 100,
    fractions: [1, 2],
  },

  // ── 魚介（g → パック） ──────────────────────────────────────────
  {
    patterns: ['むきえび', 'えび'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 150,
    fractions: [1, 2],
  },
  {
    patterns: ['ほたて貝柱', 'ほたて'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 150,
    fractions: [1, 2],
  },
  {
    patterns: ['あさり'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['ちりめんじゃこ'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 50,
    fractions: [1, 2],
  },
  {
    patterns: ['ツナ'],
    fromUnit: 'g',
    toUnit: '缶',
    sizePerUnit: 70,
    fractions: [1, 2],
  },

  // ── 豆腐・豆製品（g → 丁/パック） ───────────────────────────────
  {
    patterns: ['木綿豆腐', '絹ごし豆腐', 'もめん豆腐', '絹豆腐'],
    fromUnit: 'g',
    toUnit: '丁',
    sizePerUnit: 300,
    fractions: [1, 2],
  },
  {
    patterns: ['豆腐'],
    fromUnit: 'g',
    toUnit: '丁',
    sizePerUnit: 300,
    fractions: [1, 2],
  },
  {
    patterns: ['厚揚げ'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 150,
    fractions: [1, 2],
  },
  {
    patterns: ['油揚げ'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 100,
    fractions: [1, 2],
  },
  {
    patterns: ['大豆'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 250,
    fractions: [1],
  },
  {
    patterns: ['枝豆'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 250,
    fractions: [1, 2],
  },

  // ── 乳製品（g → パック/箱） ─────────────────────────────────────
  {
    patterns: ['ピザ用チーズ', 'シュレッドチーズ', 'とろけるチーズ'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['クリームチーズ'],
    fromUnit: 'g',
    toUnit: '個',
    sizePerUnit: 200,
    fractions: [1],
  },
  {
    patterns: ['スライスチーズ'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 160,
    fractions: [1],
  },
  {
    patterns: ['チーズ'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 180,
    fractions: [1],
  },
  {
    patterns: ['バター'],
    fromUnit: 'g',
    toUnit: '箱',
    sizePerUnit: 200,
    fractions: [0.5, 1],
  },
  {
    patterns: ['プレーンヨーグルト', 'ヨーグルト'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 400,
    fractions: [1],
  },
  {
    patterns: ['生クリーム'],
    fromUnit: 'g',
    toUnit: 'パック',
    sizePerUnit: 200,
    fractions: [1],
  },

  // ── 粉類・乾物（g → 袋） ────────────────────────────────────────
  {
    patterns: ['薄力粉', '小麦粉'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 1000,
    fractions: [1],
  },
  {
    patterns: ['強力粉'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 1000,
    fractions: [1],
  },
  {
    patterns: ['片栗粉'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 500,
    fractions: [1],
  },
  {
    patterns: ['ホットケーキミックス'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1, 2],
  },
  {
    patterns: ['砂糖', 'グラニュー糖'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 1000,
    fractions: [1],
  },
  {
    patterns: ['パン粉'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1],
  },
  {
    patterns: ['スパゲティ', 'パスタ'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 500,
    fractions: [1],
  },
  {
    patterns: ['レーズン'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 200,
    fractions: [1],
  },
  {
    patterns: ['くるみ', 'クルミ'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 100,
    fractions: [1],
  },
  {
    patterns: ['ひじき'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 50,
    fractions: [1],
  },
  {
    patterns: ['マヨネーズ'],
    fromUnit: 'g',
    toUnit: '本',
    sizePerUnit: 500,
    fractions: [1],
  },
  {
    patterns: ['チョコレート'],
    fromUnit: 'g',
    toUnit: '枚',
    sizePerUnit: 60,
    fractions: [1, 2],
  },
  {
    patterns: ['ミックスベジタブル'],
    fromUnit: 'g',
    toUnit: '袋',
    sizePerUnit: 300,
    fractions: [1],
  },
]

/** Returns true if this ml ingredient should NOT be converted (water, oils, seasonings) */
function isNoConvertMl(name: string): boolean {
  return NO_CONVERT_ML_PATTERNS.some((p) => name.includes(p))
}

/** Find the first matching rule for an ingredient name */
function findRule(name: string, unit: string): RetailRule | undefined {
  const normalizedUnit = unit === 'mL' || unit === 'ｍL' || unit === 'ｍＬ' ? 'ml' : unit
  const normalizedG = unit === 'ｇ' || unit === 'g※' || unit === '正味g' ? 'g' : normalizedUnit

  if (normalizedG !== 'g' && normalizedG !== 'ml') return undefined

  // Skip conversion for ml ingredients that have no meaningful retail mapping
  if (normalizedG === 'ml' && isNoConvertMl(name)) return undefined

  return RETAIL_RULES.find(
    (rule) =>
      rule.fromUnit === normalizedG &&
      rule.patterns.some((p) => name.includes(p)),
  )
}

/**
 * Normalize unit variants to canonical form (g or ml).
 */
function normalizeUnit(unit: string): string {
  if (['mL', 'ｍL', 'ｍＬ', '目安量mL', '約mL'].some((v) => unit.startsWith(v.slice(0, 2)))) {
    return 'ml'
  }
  if (['ｇ', 'g※', '正味g', '約g'].some((v) => unit.startsWith(v.slice(0, 1)))) {
    return 'g'
  }
  return unit
}

/**
 * Round a positive number UP to the nearest value in the fractions array.
 * fractions must be sorted ascending.
 */
function roundUpToFraction(value: number, fractions: number[]): number {
  for (const f of fractions) {
    if (value <= f) return f
  }
  // Larger than all fractions: round up to next whole multiple
  const max = fractions[fractions.length - 1]
  return Math.ceil(value / max) * max
}

/** Format a quantity number as a readable string (e.g. 0.5 → "1/2", 0.25 → "1/4") */
function formatFraction(value: number): string {
  if (value === 0.25) return '1/4'
  if (value === 0.5) return '1/2'
  if (value === 0.75) return '3/4'
  if (value === 1.5) return '1と1/2'
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 100) / 100)
}

/**
 * Convert a recipe ingredient quantity to a shopping-friendly retail unit.
 *
 * - Items already in count units are returned unchanged.
 * - Items with no matching rule are returned unchanged.
 * - Conversion always rounds UP to avoid running short.
 */
export function convertToShoppingUnit(
  name: string,
  quantity: number | string,
  unit: string,
): ShoppingQuantity {
  // 適量 or non-numeric
  if (unit === '適量' || quantity === '適量') {
    return { quantity: '適量', unit: '適量' }
  }

  const numQty = typeof quantity === 'string' ? parseFloat(quantity) : quantity
  if (!Number.isFinite(numQty) || numQty <= 0) {
    return { quantity, unit }
  }

  const normalUnit = normalizeUnit(unit)

  // Already a count unit — no conversion
  if (COUNT_UNITS.has(normalUnit)) {
    return { quantity, unit }
  }

  const rule = findRule(name, normalUnit)
  if (!rule) {
    // No rule: return as-is (raw g/ml quantity)
    return { quantity, unit: normalUnit }
  }

  const rawCount = numQty / rule.sizePerUnit
  const rounded = rule.fractions
    ? roundUpToFraction(rawCount, rule.fractions)
    : Math.ceil(rawCount)

  // Build a note with the original recipe quantity
  const displayUnit = normalUnit === 'g' ? 'g' : 'ml'
  const note = `約${Math.round(numQty)}${displayUnit}分`

  return {
    quantity: formatFraction(rounded),
    unit: rule.toUnit,
    note,
  }
}

/**
 * Format a shopping ingredient for display.
 * Returns a string like "1本（約150g分）" or "200g" (no rule match).
 */
export function formatShoppingDisplay(
  name: string,
  quantity: number | string,
  unit: string,
): string {
  if (unit === '適量' || quantity === '適量') return '適量'

  const converted = convertToShoppingUnit(name, quantity, unit)

  const qtyStr =
    typeof converted.quantity === 'number'
      ? formatFraction(converted.quantity)
      : String(converted.quantity)

  const base = `${qtyStr}${converted.unit}`
  return converted.note ? `${base}（${converted.note}）` : base
}
