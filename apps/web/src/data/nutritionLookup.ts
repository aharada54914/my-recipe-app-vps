/**
 * 日本食品標準成分表2020年版に基づく栄養素推定テーブル
 * Nutritional lookup table for ingredient-based recipe nutrition estimation.
 * Values are per 100g edible portion.
 */

export interface NutritionPer100g {
  energyKcal: number
  proteinG: number
  fatG: number
  carbG: number
  saltEquivalentG: number
  fiberG: number
  sugarG: number
  saturatedFatG: number
  potassiumMg: number
  calciumMg: number
  ironMg: number
  vitaminCMg: number
}

export interface IngredientEntry {
  per100g: NutritionPer100g
  /** Weight in grams for piece-based units (個, 本, 枚, etc.) */
  unitGrams?: Partial<Record<string, number>>
  /** Grams per 大さじ (default 15) */
  oosajiG?: number
  /** Grams per 小さじ (default 5) */
  kosajiG?: number
}

export interface PatternEntry {
  keywords: string[]
  entry: IngredientEntry
  foodCode?: string
}

export const NUTRITION_REFERENCE = {
  dataset: 'japanese-food-composition-table-2020-8th',
  label: '日本食品標準成分表2020年版（八訂）',
  estimatorVersion: 'lookup-v5',
} as const

// Checked in order — more specific patterns first
export const NUTRITION_PATTERNS: PatternEntry[] = [
  // ──────────────── 鶏肉 ────────────────
  {
    keywords: ['鶏むね', '鶏ムネ', 'とりむね', '鶏胸', 'チキンブレスト'],
    entry: {
      per100g: { energyKcal: 105, proteinG: 22.3, fatG: 1.9, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 0.5, potassiumMg: 330, calciumMg: 4, ironMg: 0.3, vitaminCMg: 3 },
      unitGrams: { 枚: 200, 切れ: 150 },
    },
  },
  {
    keywords: ['鶏もも', '鶏モモ', 'とりもも', '骨付き鶏', 'チキンレッグ'],
    entry: {
      per100g: { energyKcal: 190, proteinG: 16.2, fatG: 14.0, carbG: 0.0, saltEquivalentG: 0.2, fiberG: 0, sugarG: 0.0, saturatedFatG: 3.8, potassiumMg: 270, calciumMg: 5, ironMg: 0.6, vitaminCMg: 2 },
      unitGrams: { 枚: 250, 切れ: 200 },
    },
  },
  {
    keywords: ['手羽先', '手羽元', '鶏手羽', 'てばさき', 'てばもと'],
    entry: {
      per100g: { energyKcal: 207, proteinG: 17.4, fatG: 15.8, carbG: 0.0, saltEquivalentG: 0.2, fiberG: 0, sugarG: 0.0, saturatedFatG: 4.5, potassiumMg: 240, calciumMg: 12, ironMg: 0.7, vitaminCMg: 2 },
      unitGrams: { 本: 80 },
    },
  },
  {
    keywords: ['鶏ささみ', 'ささ身', 'ささみ'],
    foodCode: 'M02014',
    entry: {
      per100g: { energyKcal: 98, proteinG: 23.9, fatG: 0.8, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 0.2, potassiumMg: 410, calciumMg: 4, ironMg: 0.2, vitaminCMg: 1 },
      unitGrams: { 本: 55, 枚: 60 },
    },
  },
  {
    keywords: ['鶏ひき肉', '鶏ミンチ', '鶏挽き', '鶏挽肉'],
    entry: {
      per100g: { energyKcal: 168, proteinG: 17.5, fatG: 12.3, carbG: 0.0, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.0, saturatedFatG: 3.1, potassiumMg: 280, calciumMg: 5, ironMg: 0.5, vitaminCMg: 1 },
    },
  },
  {
    keywords: ['鶏肉', 'とり肉', 'チキン', '鶏'],
    entry: {
      per100g: { energyKcal: 150, proteinG: 19.0, fatG: 8.0, carbG: 0.1, saltEquivalentG: 0.2, fiberG: 0, sugarG: 0.1, saturatedFatG: 2.2, potassiumMg: 290, calciumMg: 5, ironMg: 0.5, vitaminCMg: 2 },
      unitGrams: { 枚: 200, 切れ: 150 },
    },
  },

  // ──────────────── 豚肉 ────────────────
  {
    keywords: ['豚バラ', 'ばら肉', '豚ばら', 'バラ肉'],
    entry: {
      per100g: { energyKcal: 395, proteinG: 14.4, fatG: 35.4, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 12.8, potassiumMg: 210, calciumMg: 3, ironMg: 0.6, vitaminCMg: 1 },
      unitGrams: { 枚: 80 },
    },
  },
  {
    keywords: ['豚ロース', 'ロース肉', '豚リブ'],
    entry: {
      per100g: { energyKcal: 248, proteinG: 19.3, fatG: 19.2, carbG: 0.2, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.2, saturatedFatG: 7.3, potassiumMg: 330, calciumMg: 4, ironMg: 0.5, vitaminCMg: 1 },
      unitGrams: { 枚: 100, 切れ: 100 },
    },
  },
  {
    keywords: ['豚もも', '豚モモ', '豚肩'],
    entry: {
      per100g: { energyKcal: 183, proteinG: 20.5, fatG: 10.7, carbG: 0.2, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.2, saturatedFatG: 4.0, potassiumMg: 340, calciumMg: 4, ironMg: 0.7, vitaminCMg: 1 },
      unitGrams: { 枚: 100, 切れ: 100 },
    },
  },
  {
    keywords: ['豚ヒレ', '豚ひれ', '豚ヒレ肉', '豚ひれ肉'],
    entry: {
      per100g: { energyKcal: 115, proteinG: 22.2, fatG: 3.7, carbG: 0.2, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.2, saturatedFatG: 1.4, potassiumMg: 390, calciumMg: 4, ironMg: 0.6, vitaminCMg: 1 },
      unitGrams: { 枚: 100, 切れ: 100 },
    },
  },
  {
    keywords: ['豚こま', '豚薄切り', '豚切り落とし', '豚切落'],
    entry: {
      per100g: { energyKcal: 215, proteinG: 17.0, fatG: 17.0, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 6.0, potassiumMg: 290, calciumMg: 4, ironMg: 0.6, vitaminCMg: 1 },
    },
  },
  {
    keywords: ['豚ひき肉', '豚ミンチ', '豚挽き', '豚挽肉'],
    entry: {
      per100g: { energyKcal: 263, proteinG: 17.7, fatG: 21.1, carbG: 0.0, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.0, saturatedFatG: 7.9, potassiumMg: 300, calciumMg: 4, ironMg: 1.0, vitaminCMg: 1 },
    },
  },
  {
    keywords: ['豚肉', 'とん肉', 'ポーク'],
    entry: {
      per100g: { energyKcal: 225, proteinG: 18.0, fatG: 17.0, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 6.0, potassiumMg: 310, calciumMg: 4, ironMg: 0.6, vitaminCMg: 1 },
      unitGrams: { 枚: 100, 切れ: 100 },
    },
  },

  // ──────────────── 牛肉・合いびき肉 ────────────────
  {
    keywords: ['牛バラ', '牛ばら', 'カルビ'],
    entry: {
      per100g: { energyKcal: 517, proteinG: 11.0, fatG: 50.0, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 20.5, potassiumMg: 200, calciumMg: 5, ironMg: 1.4, vitaminCMg: 1 },
      unitGrams: { 枚: 80 },
    },
  },
  {
    keywords: ['牛ロース', '牛リブ', 'サーロイン', 'リブロース'],
    entry: {
      per100g: { energyKcal: 411, proteinG: 13.7, fatG: 37.5, carbG: 0.5, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.5, saturatedFatG: 15.2, potassiumMg: 270, calciumMg: 4, ironMg: 1.8, vitaminCMg: 1 },
      unitGrams: { 枚: 100, 切れ: 100 },
    },
  },
  {
    keywords: ['牛もも', '牛モモ', '牛肩ロース'],
    entry: {
      per100g: { energyKcal: 235, proteinG: 19.5, fatG: 17.0, carbG: 0.4, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.4, saturatedFatG: 7.1, potassiumMg: 310, calciumMg: 5, ironMg: 2.5, vitaminCMg: 1 },
      unitGrams: { 枚: 100, 切れ: 100 },
    },
  },
  {
    keywords: ['合いびき肉', '合びき肉', 'あいびき', '合挽き', '合挽肉', '混合挽き'],
    entry: {
      per100g: { energyKcal: 224, proteinG: 17.7, fatG: 17.3, carbG: 0.3, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.3, saturatedFatG: 6.4, potassiumMg: 290, calciumMg: 6, ironMg: 1.5, vitaminCMg: 1 },
    },
  },
  {
    keywords: ['牛肉', '牛', 'ビーフ', 'ステーキ'],
    entry: {
      per100g: { energyKcal: 318, proteinG: 16.0, fatG: 28.0, carbG: 0.3, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.3, saturatedFatG: 11.0, potassiumMg: 270, calciumMg: 4, ironMg: 2.0, vitaminCMg: 1 },
      unitGrams: { 枚: 100, 切れ: 100 },
    },
  },

  // ──────────────── 加工肉 ────────────────
  {
    keywords: ['ベーコン'],
    entry: {
      per100g: { energyKcal: 405, proteinG: 12.9, fatG: 39.1, carbG: 0.3, saltEquivalentG: 2.0, fiberG: 0, sugarG: 0.3, saturatedFatG: 14.3, potassiumMg: 220, calciumMg: 5, ironMg: 0.4, vitaminCMg: 50 },
      unitGrams: { 枚: 20 },
    },
  },
  {
    keywords: ['ソーセージ', 'ウインナー', 'フランクフルト'],
    entry: {
      per100g: { energyKcal: 321, proteinG: 11.5, fatG: 28.5, carbG: 3.0, saltEquivalentG: 1.9, fiberG: 0, sugarG: 3.0, saturatedFatG: 10.3, potassiumMg: 180, calciumMg: 10, ironMg: 0.8, vitaminCMg: 0 },
      unitGrams: { 本: 40 },
    },
  },
  {
    keywords: ['ハム', 'ロースハム'],
    entry: {
      per100g: { energyKcal: 211, proteinG: 18.6, fatG: 14.5, carbG: 2.1, saltEquivalentG: 2.8, fiberG: 0, sugarG: 2.1, saturatedFatG: 5.3, potassiumMg: 260, calciumMg: 6, ironMg: 0.5, vitaminCMg: 48 },
      unitGrams: { 枚: 20 },
    },
  },
  {
    keywords: ['ちくわ', '竹輪'],
    foodCode: 'F12021',
    entry: {
      per100g: { energyKcal: 121, proteinG: 12.2, fatG: 2.0, carbG: 13.5, saltEquivalentG: 2.5, fiberG: 0, sugarG: 6.0, saturatedFatG: 0.4, potassiumMg: 160, calciumMg: 28, ironMg: 0.6, vitaminCMg: 0 },
      unitGrams: { 本: 30 },
    },
  },
  {
    keywords: ['かまぼこ', '蒲鉾', 'かにかまぼこ', 'カニカマ'],
    entry: {
      per100g: { energyKcal: 95, proteinG: 12.0, fatG: 0.9, carbG: 9.7, saltEquivalentG: 2.6, fiberG: 0, sugarG: 5.8, saturatedFatG: 0.2, potassiumMg: 130, calciumMg: 24, ironMg: 0.4, vitaminCMg: 0 },
      unitGrams: { 本: 15, 枚: 15 },
    },
  },
  {
    keywords: ['さつま揚げ', '薩摩揚げ'],
    foodCode: 'F12031',
    entry: {
      per100g: { energyKcal: 139, proteinG: 11.8, fatG: 4.9, carbG: 12.0, saltEquivalentG: 2.3, fiberG: 0, sugarG: 3.5, saturatedFatG: 1.1, potassiumMg: 200, calciumMg: 35, ironMg: 0.7, vitaminCMg: 0 },
      unitGrams: { 枚: 50, 個: 40 },
    },
  },
  {
    keywords: ['はんぺん'],
    entry: {
      per100g: { energyKcal: 95, proteinG: 11.3, fatG: 0.9, carbG: 11.4, saltEquivalentG: 2.2, fiberG: 0, sugarG: 3.0, saturatedFatG: 0.2, potassiumMg: 170, calciumMg: 45, ironMg: 0.5, vitaminCMg: 0 },
      unitGrams: { 枚: 90 },
    },
  },

  // ──────────────── 魚介類 ────────────────
  {
    keywords: ['生ざけ', '生鮭', '鮭', 'サーモン', 'サケ', 'シャケ'],
    entry: {
      per100g: { energyKcal: 133, proteinG: 22.3, fatG: 4.1, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 1.2, potassiumMg: 350, calciumMg: 14, ironMg: 0.5, vitaminCMg: 1 },
      unitGrams: { 切れ: 100, 枚: 100 },
    },
  },
  {
    keywords: ['白身魚', '白身魚（切り身）'],
    entry: {
      per100g: { energyKcal: 82, proteinG: 18.2, fatG: 0.8, carbG: 0.1, saltEquivalentG: 0.2, fiberG: 0, sugarG: 0.1, saturatedFatG: 0.2, potassiumMg: 340, calciumMg: 22, ironMg: 0.4, vitaminCMg: 1 },
      unitGrams: { 切れ: 100 },
    },
  },
  {
    keywords: ['マグロ', 'まぐろ', 'ツナ（生', '鮪'],
    entry: {
      per100g: { energyKcal: 125, proteinG: 26.4, fatG: 1.4, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 0.3, potassiumMg: 380, calciumMg: 5, ironMg: 2.0, vitaminCMg: 2 },
      unitGrams: { 切れ: 80 },
    },
  },
  {
    keywords: ['タラ', 'たら', '鱈'],
    entry: {
      per100g: { energyKcal: 72, proteinG: 17.6, fatG: 0.2, carbG: 0.1, saltEquivalentG: 0.3, fiberG: 0, sugarG: 0.1, saturatedFatG: 0.1, potassiumMg: 350, calciumMg: 32, ironMg: 0.2, vitaminCMg: 1 },
      unitGrams: { 切れ: 100 },
    },
  },
  {
    keywords: ['さば', 'サバ', '鯖'],
    entry: {
      per100g: { energyKcal: 247, proteinG: 20.6, fatG: 16.8, carbG: 0.3, saltEquivalentG: 0.3, fiberG: 0, sugarG: 0.3, saturatedFatG: 4.9, potassiumMg: 330, calciumMg: 6, ironMg: 1.3, vitaminCMg: 1 },
      unitGrams: { 切れ: 100 },
    },
  },
  {
    keywords: ['ぶり', 'ブリ', '鰤', 'はまち', 'ハマチ'],
    entry: {
      per100g: { energyKcal: 257, proteinG: 21.4, fatG: 17.6, carbG: 0.4, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.4, saturatedFatG: 4.0, potassiumMg: 380, calciumMg: 5, ironMg: 1.3, vitaminCMg: 2 },
      unitGrams: { 切れ: 100 },
    },
  },
  {
    keywords: ['あじ', 'アジ', '鯵'],
    entry: {
      per100g: { energyKcal: 112, proteinG: 19.7, fatG: 4.5, carbG: 0.1, saltEquivalentG: 0.3, fiberG: 0, sugarG: 0.1, saturatedFatG: 1.1, potassiumMg: 360, calciumMg: 66, ironMg: 0.6, vitaminCMg: 1 },
      unitGrams: { 尾: 100 },
    },
  },
  {
    keywords: ['えび', 'エビ', '海老', 'シュリンプ', 'むきえび'],
    entry: {
      per100g: { energyKcal: 91, proteinG: 21.7, fatG: 0.1, carbG: 0.0, saltEquivalentG: 0.6, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.0, potassiumMg: 430, calciumMg: 41, ironMg: 0.7, vitaminCMg: 1 },
      unitGrams: { 尾: 15 },
    },
  },
  {
    keywords: ['あさり', 'アサリ', '蛤', 'はまぐり', 'しじみ'],
    entry: {
      per100g: { energyKcal: 27, proteinG: 6.0, fatG: 0.3, carbG: 0.4, saltEquivalentG: 2.2, fiberG: 0, sugarG: 0.4, saturatedFatG: 0.1, potassiumMg: 140, calciumMg: 66, ironMg: 3.8, vitaminCMg: 1 },
      unitGrams: { パック: 200 },
    },
  },
  {
    keywords: ['ホタテ', 'ほたて', '帆立'],
    entry: {
      per100g: { energyKcal: 72, proteinG: 13.5, fatG: 0.9, carbG: 1.5, saltEquivalentG: 0.5, fiberG: 0, sugarG: 1.5, saturatedFatG: 0.1, potassiumMg: 310, calciumMg: 22, ironMg: 0.5, vitaminCMg: 2 },
    },
  },
  {
    keywords: ['いか', 'イカ', '烏賊'],
    entry: {
      per100g: { energyKcal: 83, proteinG: 18.1, fatG: 1.0, carbG: 0.0, saltEquivalentG: 0.5, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.2, potassiumMg: 300, calciumMg: 11, ironMg: 0.1, vitaminCMg: 1 },
    },
  },
  {
    keywords: ['たこ', 'タコ', '蛸'],
    entry: {
      per100g: { energyKcal: 70, proteinG: 16.4, fatG: 0.7, carbG: 0.0, saltEquivalentG: 0.7, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.1, potassiumMg: 290, calciumMg: 16, ironMg: 0.6, vitaminCMg: 1 },
    },
  },
  {
    keywords: ['ツナ缶', 'ツナ（缶', 'ツナ缶詰', 'ツナ'],
    entry: {
      per100g: { energyKcal: 288, proteinG: 17.7, fatG: 21.7, carbG: 0.1, saltEquivalentG: 0.5, fiberG: 0, sugarG: 0.1, saturatedFatG: 4.3, potassiumMg: 230, calciumMg: 5, ironMg: 1.0, vitaminCMg: 0 },
      unitGrams: { 缶: 70 },
    },
  },
  {
    keywords: ['さわら', '鰆'],
    entry: {
      per100g: { energyKcal: 177, proteinG: 20.1, fatG: 9.7, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 2.3, potassiumMg: 490, calciumMg: 12, ironMg: 1.4, vitaminCMg: 1 },
      unitGrams: { 切れ: 100 },
    },
  },
  {
    keywords: ['鯛', 'たい', '真鯛'],
    entry: {
      per100g: { energyKcal: 129, proteinG: 20.9, fatG: 5.8, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 1.6, potassiumMg: 430, calciumMg: 20, ironMg: 0.4, vitaminCMg: 1 },
      unitGrams: { 切れ: 100 },
    },
  },
  {
    keywords: ['さんま', '秋刀魚'],
    entry: {
      per100g: { energyKcal: 287, proteinG: 18.5, fatG: 25.6, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 7.4, potassiumMg: 320, calciumMg: 17, ironMg: 1.4, vitaminCMg: 2 },
      unitGrams: { 尾: 120 },
    },
  },
  {
    keywords: ['いわし', '鰯'],
    entry: {
      per100g: { energyKcal: 156, proteinG: 19.2, fatG: 9.2, carbG: 0.2, saltEquivalentG: 0.2, fiberG: 0, sugarG: 0.2, saturatedFatG: 2.2, potassiumMg: 300, calciumMg: 74, ironMg: 2.1, vitaminCMg: 2 },
      unitGrams: { 尾: 80 },
    },
  },
  {
    keywords: ['しらす', 'ちりめんじゃこ', 'じゃこ'],
    entry: {
      per100g: { energyKcal: 113, proteinG: 23.7, fatG: 1.9, carbG: 0.0, saltEquivalentG: 2.1, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.4, potassiumMg: 390, calciumMg: 210, ironMg: 0.9, vitaminCMg: 0 },
    },
  },
  {
    keywords: ['かれい', 'カレイ', '鰈'],
    entry: {
      per100g: { energyKcal: 95, proteinG: 19.6, fatG: 1.4, carbG: 0.1, saltEquivalentG: 0.2, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.4, potassiumMg: 330, calciumMg: 34, ironMg: 0.3, vitaminCMg: 1 },
      unitGrams: { 切れ: 100, 尾: 120 },
    },
  },
  {
    keywords: ['牡蠣', 'かき', 'カキ'],
    entry: {
      per100g: { energyKcal: 58, proteinG: 6.9, fatG: 2.2, carbG: 4.9, saltEquivalentG: 1.3, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.5, potassiumMg: 190, calciumMg: 84, ironMg: 2.1, vitaminCMg: 2 },
      unitGrams: { 個: 20, パック: 100 },
    },
  },
  {
    keywords: ['アンチョビ'],
    entry: {
      per100g: { energyKcal: 146, proteinG: 28.9, fatG: 4.4, carbG: 0.5, saltEquivalentG: 9.0, fiberG: 0, sugarG: 0.0, saturatedFatG: 1.2, potassiumMg: 630, calciumMg: 232, ironMg: 2.9, vitaminCMg: 0 },
      unitGrams: { 枚: 4, 缶: 45 },
    },
  },

  // ──────────────── 野菜類（根菜） ────────────────
  {
    keywords: ['玉ねぎ', 'たまねぎ', '玉葱', 'オニオン'],
    entry: {
      per100g: { energyKcal: 37, proteinG: 1.0, fatG: 0.1, carbG: 8.4, saltEquivalentG: 0.0, fiberG: 1.6, sugarG: 6.4, saturatedFatG: 0.0, potassiumMg: 150, calciumMg: 21, ironMg: 0.2, vitaminCMg: 8 },
      unitGrams: { 個: 200, 玉: 200 },
    },
  },
  {
    keywords: ['人参', 'にんじん', 'ニンジン', 'キャロット'],
    entry: {
      per100g: { energyKcal: 39, proteinG: 0.7, fatG: 0.2, carbG: 8.7, saltEquivalentG: 0.1, fiberG: 2.8, sugarG: 5.5, saturatedFatG: 0.0, potassiumMg: 300, calciumMg: 28, ironMg: 0.2, vitaminCMg: 6 },
      unitGrams: { 本: 150 },
    },
  },
  {
    keywords: ['じゃがいも', 'じゃが芋', 'ジャガイモ', 'ポテト'],
    entry: {
      per100g: { energyKcal: 76, proteinG: 1.8, fatG: 0.1, carbG: 17.3, saltEquivalentG: 0.0, fiberG: 1.3, sugarG: 0.7, saturatedFatG: 0.0, potassiumMg: 410, calciumMg: 4, ironMg: 0.4, vitaminCMg: 28 },
      unitGrams: { 個: 150 },
    },
  },
  {
    keywords: ['さつまいも', 'サツマイモ', '薩摩芋', 'さつま芋'],
    entry: {
      per100g: { energyKcal: 132, proteinG: 1.2, fatG: 0.2, carbG: 31.5, saltEquivalentG: 0.0, fiberG: 2.3, sugarG: 13.0, saturatedFatG: 0.0, potassiumMg: 470, calciumMg: 36, ironMg: 0.6, vitaminCMg: 25 },
      unitGrams: { 本: 200, 個: 200 },
    },
  },
  {
    keywords: ['かぼちゃ', 'カボチャ', '南瓜', 'パンプキン'],
    entry: {
      per100g: { energyKcal: 91, proteinG: 1.9, fatG: 0.3, carbG: 20.6, saltEquivalentG: 0.0, fiberG: 3.5, sugarG: 7.1, saturatedFatG: 0.1, potassiumMg: 450, calciumMg: 15, ironMg: 0.5, vitaminCMg: 43 },
    },
  },
  {
    keywords: ['大根', 'だいこん', 'ダイコン', '大根おろし'],
    entry: {
      per100g: { energyKcal: 18, proteinG: 0.5, fatG: 0.1, carbG: 4.1, saltEquivalentG: 0.0, fiberG: 1.4, sugarG: 2.7, saturatedFatG: 0.0, potassiumMg: 230, calciumMg: 24, ironMg: 0.2, vitaminCMg: 12 },
      unitGrams: { 本: 1000 },
    },
  },
  {
    keywords: ['ごぼう', 'ゴボウ', '牛蒡'],
    entry: {
      per100g: { energyKcal: 65, proteinG: 1.8, fatG: 0.1, carbG: 15.4, saltEquivalentG: 0.0, fiberG: 5.7, sugarG: 1.3, saturatedFatG: 0.0, potassiumMg: 320, calciumMg: 46, ironMg: 0.7, vitaminCMg: 3 },
      unitGrams: { 本: 180 },
    },
  },
  {
    keywords: ['れんこん', 'レンコン', '蓮根'],
    entry: {
      per100g: { energyKcal: 66, proteinG: 1.9, fatG: 0.1, carbG: 15.5, saltEquivalentG: 0.0, fiberG: 2.0, sugarG: 0.4, saturatedFatG: 0.0, potassiumMg: 440, calciumMg: 20, ironMg: 0.5, vitaminCMg: 48 },
    },
  },
  {
    keywords: ['たけのこ', '筍', '水煮たけのこ'],
    entry: {
      per100g: { energyKcal: 31, proteinG: 2.6, fatG: 0.2, carbG: 5.2, saltEquivalentG: 0.0, fiberG: 2.8, sugarG: 1.2, saturatedFatG: 0.0, potassiumMg: 520, calciumMg: 16, ironMg: 0.5, vitaminCMg: 4 },
      unitGrams: { 本: 300 },
    },
  },
  {
    keywords: ['里いも', '里芋'],
    entry: {
      per100g: { energyKcal: 53, proteinG: 1.5, fatG: 0.1, carbG: 13.1, saltEquivalentG: 0.0, fiberG: 2.3, sugarG: 2.0, saturatedFatG: 0.0, potassiumMg: 560, calciumMg: 14, ironMg: 0.5, vitaminCMg: 6 },
      unitGrams: { 個: 50 },
    },
  },
  {
    keywords: ['長いも', 'ながいも', '長芋', '山芋', 'やまいも'],
    entry: {
      per100g: { energyKcal: 65, proteinG: 2.2, fatG: 0.3, carbG: 13.9, saltEquivalentG: 0.0, fiberG: 1.0, sugarG: 4.4, saturatedFatG: 0.1, potassiumMg: 430, calciumMg: 17, ironMg: 0.4, vitaminCMg: 6 },
      unitGrams: { 本: 500, 個: 250 },
    },
  },
  {
    keywords: ['かぶ', '蕪'],
    entry: {
      per100g: { energyKcal: 20, proteinG: 0.7, fatG: 0.1, carbG: 4.6, saltEquivalentG: 0.0, fiberG: 1.5, sugarG: 3.1, saturatedFatG: 0.0, potassiumMg: 280, calciumMg: 24, ironMg: 0.2, vitaminCMg: 19 },
      unitGrams: { 個: 80 },
    },
  },

  // ──────────────── 野菜類（葉茎菜） ────────────────
  {
    keywords: ['キャベツ', 'かべつ', '甘藍'],
    entry: {
      per100g: { energyKcal: 23, proteinG: 1.3, fatG: 0.2, carbG: 5.2, saltEquivalentG: 0.0, fiberG: 1.8, sugarG: 3.4, saturatedFatG: 0.0, potassiumMg: 200, calciumMg: 43, ironMg: 0.3, vitaminCMg: 41 },
      unitGrams: { 枚: 50, 個: 1000, 玉: 1000 },
    },
  },
  {
    keywords: ['白菜', 'はくさい', 'ハクサイ'],
    entry: {
      per100g: { energyKcal: 14, proteinG: 0.8, fatG: 0.1, carbG: 3.2, saltEquivalentG: 0.0, fiberG: 1.3, sugarG: 1.9, saturatedFatG: 0.0, potassiumMg: 220, calciumMg: 43, ironMg: 0.3, vitaminCMg: 19 },
      unitGrams: { 枚: 80, 個: 2000 },
    },
  },
  {
    keywords: ['ほうれん草', 'ほうれんそう', 'ホウレンソウ', 'ほうれん'],
    entry: {
      per100g: { energyKcal: 20, proteinG: 2.2, fatG: 0.4, carbG: 3.1, saltEquivalentG: 0.0, fiberG: 2.8, sugarG: 0.3, saturatedFatG: 0.1, potassiumMg: 690, calciumMg: 49, ironMg: 2.0, vitaminCMg: 35 },
      unitGrams: { 袋: 200 },
    },
  },
  {
    keywords: ['小松菜', 'こまつな', 'コマツナ'],
    entry: {
      per100g: { energyKcal: 14, proteinG: 1.5, fatG: 0.2, carbG: 2.4, saltEquivalentG: 0.0, fiberG: 1.9, sugarG: 0.4, saturatedFatG: 0.0, potassiumMg: 500, calciumMg: 170, ironMg: 2.8, vitaminCMg: 39 },
      unitGrams: { 袋: 200 },
    },
  },
  {
    keywords: ['チンゲン菜', '青梗菜', 'ちんげんさい'],
    entry: {
      per100g: { energyKcal: 9, proteinG: 1.0, fatG: 0.1, carbG: 1.8, saltEquivalentG: 0.0, fiberG: 1.0, sugarG: 0.5, saturatedFatG: 0.0, potassiumMg: 260, calciumMg: 100, ironMg: 0.8, vitaminCMg: 24 },
      unitGrams: { 株: 100 },
    },
  },
  {
    keywords: ['ブロッコリー', 'ブロッコリ'],
    entry: {
      per100g: { energyKcal: 33, proteinG: 4.3, fatG: 0.5, carbG: 5.2, saltEquivalentG: 0.0, fiberG: 4.4, sugarG: 0.7, saturatedFatG: 0.1, potassiumMg: 360, calciumMg: 38, ironMg: 1.0, vitaminCMg: 120 },
    },
  },
  {
    keywords: ['カリフラワー'],
    foodCode: 'V07151',
    entry: {
      per100g: { energyKcal: 28, proteinG: 3.0, fatG: 0.1, carbG: 5.2, saltEquivalentG: 0.0, fiberG: 2.9, sugarG: 2.3, saturatedFatG: 0.0, potassiumMg: 410, calciumMg: 24, ironMg: 0.6, vitaminCMg: 81 },
    },
  },
  {
    keywords: ['長ねぎ', 'ながねぎ', 'ネギ', 'ねぎ', '白ねぎ'],
    entry: {
      per100g: { energyKcal: 34, proteinG: 1.4, fatG: 0.1, carbG: 7.8, saltEquivalentG: 0.0, fiberG: 2.5, sugarG: 4.0, saturatedFatG: 0.0, potassiumMg: 200, calciumMg: 36, ironMg: 0.3, vitaminCMg: 14 },
      unitGrams: { 本: 100 },
    },
  },
  {
    keywords: ['万能ねぎ', '青ねぎ', '小ねぎ', '小口ねぎ'],
    entry: {
      per100g: { energyKcal: 30, proteinG: 1.9, fatG: 0.3, carbG: 6.5, saltEquivalentG: 0.0, fiberG: 3.2, sugarG: 3.3, saturatedFatG: 0.0, potassiumMg: 320, calciumMg: 75, ironMg: 0.8, vitaminCMg: 44 },
      unitGrams: { 袋: 100, 本: 10 },
    },
  },
  {
    keywords: ['あさつき'],
    foodCode: 'V07102',
    entry: {
      per100g: { energyKcal: 34, proteinG: 2.5, fatG: 0.4, carbG: 6.2, saltEquivalentG: 0.0, fiberG: 3.1, sugarG: 2.0, saturatedFatG: 0.1, potassiumMg: 380, calciumMg: 92, ironMg: 1.2, vitaminCMg: 35 },
      unitGrams: { 束: 40, 袋: 40 },
    },
  },
  {
    keywords: ['なす', 'ナス', '茄子'],
    entry: {
      per100g: { energyKcal: 22, proteinG: 1.1, fatG: 0.1, carbG: 5.1, saltEquivalentG: 0.0, fiberG: 2.2, sugarG: 2.9, saturatedFatG: 0.0, potassiumMg: 220, calciumMg: 18, ironMg: 0.3, vitaminCMg: 4 },
      unitGrams: { 個: 80, 本: 80 },
    },
  },
  {
    keywords: ['ズッキーニ'],
    entry: {
      per100g: { energyKcal: 14, proteinG: 1.2, fatG: 0.1, carbG: 2.5, saltEquivalentG: 0.0, fiberG: 1.3, sugarG: 1.5, saturatedFatG: 0.0, potassiumMg: 320, calciumMg: 24, ironMg: 0.4, vitaminCMg: 20 },
      unitGrams: { 本: 180 },
    },
  },
  {
    keywords: ['ピーマン', 'パプリカ', '赤ピーマン', '黄ピーマン'],
    entry: {
      per100g: { energyKcal: 22, proteinG: 0.9, fatG: 0.2, carbG: 5.1, saltEquivalentG: 0.0, fiberG: 2.3, sugarG: 2.8, saturatedFatG: 0.0, potassiumMg: 190, calciumMg: 11, ironMg: 0.4, vitaminCMg: 76 },
      unitGrams: { 個: 30 },
    },
  },
  {
    keywords: ['トマト', 'とまと', '完熟トマト'],
    entry: {
      per100g: { energyKcal: 19, proteinG: 0.7, fatG: 0.1, carbG: 4.7, saltEquivalentG: 0.0, fiberG: 1.0, sugarG: 3.7, saturatedFatG: 0.0, potassiumMg: 210, calciumMg: 7, ironMg: 0.2, vitaminCMg: 15 },
      unitGrams: { 個: 150 },
    },
  },
  {
    keywords: ['ミニトマト', 'チェリートマト', 'プチトマト'],
    entry: {
      per100g: { energyKcal: 29, proteinG: 1.1, fatG: 0.1, carbG: 7.2, saltEquivalentG: 0.0, fiberG: 1.4, sugarG: 5.8, saturatedFatG: 0.0, potassiumMg: 290, calciumMg: 12, ironMg: 0.4, vitaminCMg: 32 },
      unitGrams: { 個: 15 },
    },
  },
  {
    keywords: ['きゅうり', 'キュウリ', '胡瓜'],
    entry: {
      per100g: { energyKcal: 14, proteinG: 1.0, fatG: 0.1, carbG: 3.0, saltEquivalentG: 0.0, fiberG: 1.1, sugarG: 1.9, saturatedFatG: 0.0, potassiumMg: 200, calciumMg: 26, ironMg: 0.3, vitaminCMg: 14 },
      unitGrams: { 本: 100 },
    },
  },
  {
    keywords: ['にら', 'ニラ', '韮'],
    entry: {
      per100g: { energyKcal: 20, proteinG: 1.7, fatG: 0.3, carbG: 3.4, saltEquivalentG: 0.0, fiberG: 2.7, sugarG: 0.7, saturatedFatG: 0.0, potassiumMg: 510, calciumMg: 48, ironMg: 0.7, vitaminCMg: 19 },
      unitGrams: { 束: 100, 袋: 100 },
    },
  },
  {
    keywords: ['ゴーヤ', 'にがうり', '苦瓜'],
    entry: {
      per100g: { energyKcal: 15, proteinG: 1.0, fatG: 0.1, carbG: 3.9, saltEquivalentG: 0.0, fiberG: 2.6, sugarG: 1.7, saturatedFatG: 0.0, potassiumMg: 260, calciumMg: 14, ironMg: 0.4, vitaminCMg: 76 },
      unitGrams: { 本: 180 },
    },
  },
  {
    keywords: ['アスパラガス', 'アスパラ'],
    entry: {
      per100g: { energyKcal: 22, proteinG: 2.6, fatG: 0.2, carbG: 3.9, saltEquivalentG: 0.0, fiberG: 1.8, sugarG: 1.7, saturatedFatG: 0.0, potassiumMg: 270, calciumMg: 19, ironMg: 0.7, vitaminCMg: 15 },
      unitGrams: { 本: 20 },
    },
  },
  {
    keywords: ['オクラ'],
    entry: {
      per100g: { energyKcal: 30, proteinG: 2.1, fatG: 0.2, carbG: 6.6, saltEquivalentG: 0.0, fiberG: 5.0, sugarG: 1.6, saturatedFatG: 0.0, potassiumMg: 260, calciumMg: 92, ironMg: 0.5, vitaminCMg: 11 },
      unitGrams: { 本: 10 },
    },
  },
  {
    keywords: ['さやいんげん', 'いんげん', 'いんげん豆'],
    entry: {
      per100g: { energyKcal: 23, proteinG: 1.8, fatG: 0.2, carbG: 5.6, saltEquivalentG: 0.0, fiberG: 2.4, sugarG: 2.6, saturatedFatG: 0.0, potassiumMg: 260, calciumMg: 39, ironMg: 0.7, vitaminCMg: 8 },
      unitGrams: { 本: 8, 袋: 100 },
    },
  },
  {
    keywords: ['スイートコーン', 'とうもろこし', 'トウモロコシ', 'コーン'],
    entry: {
      per100g: { energyKcal: 89, proteinG: 3.6, fatG: 1.7, carbG: 16.8, saltEquivalentG: 0.0, fiberG: 3.0, sugarG: 6.1, saturatedFatG: 0.3, potassiumMg: 290, calciumMg: 3, ironMg: 0.4, vitaminCMg: 8 },
      unitGrams: { 本: 180, 缶: 120 },
    },
  },
  {
    keywords: ['貝割れ菜', 'かいわれ', 'かいわれ大根'],
    entry: {
      per100g: { energyKcal: 21, proteinG: 2.1, fatG: 0.5, carbG: 2.5, saltEquivalentG: 0.0, fiberG: 1.6, sugarG: 1.2, saturatedFatG: 0.1, potassiumMg: 99, calciumMg: 54, ironMg: 1.6, vitaminCMg: 47 },
      unitGrams: { パック: 50, 袋: 50 },
    },
  },
  {
    keywords: ['もやし', 'モヤシ', '豆もやし', '緑豆もやし'],
    entry: {
      per100g: { energyKcal: 14, proteinG: 1.7, fatG: 0.1, carbG: 2.6, saltEquivalentG: 0.0, fiberG: 1.3, sugarG: 1.3, saturatedFatG: 0.0, potassiumMg: 69, calciumMg: 10, ironMg: 0.2, vitaminCMg: 8 },
      unitGrams: { 袋: 200 },
    },
  },
  {
    keywords: ['レタス', 'サニーレタス', '玉レタス'],
    entry: {
      per100g: { energyKcal: 11, proteinG: 0.6, fatG: 0.1, carbG: 2.8, saltEquivalentG: 0.0, fiberG: 1.1, sugarG: 1.7, saturatedFatG: 0.0, potassiumMg: 200, calciumMg: 19, ironMg: 0.3, vitaminCMg: 5 },
      unitGrams: { 枚: 30, 個: 300 },
    },
  },
  {
    keywords: ['ベビーリーフ'],
    foodCode: 'V07999',
    entry: {
      per100g: { energyKcal: 18, proteinG: 1.7, fatG: 0.3, carbG: 3.2, saltEquivalentG: 0.0, fiberG: 2.0, sugarG: 1.4, saturatedFatG: 0.0, potassiumMg: 280, calciumMg: 52, ironMg: 1.1, vitaminCMg: 20 },
      unitGrams: { 袋: 50 },
    },
  },
  {
    keywords: ['ルッコラ'],
    entry: {
      per100g: { energyKcal: 19, proteinG: 2.6, fatG: 0.7, carbG: 2.1, saltEquivalentG: 0.0, fiberG: 1.6, sugarG: 1.5, saturatedFatG: 0.1, potassiumMg: 480, calciumMg: 170, ironMg: 1.6, vitaminCMg: 66 },
      unitGrams: { 袋: 50, 束: 40 },
    },
  },
  {
    keywords: ['セロリ', 'セルリー'],
    entry: {
      per100g: { energyKcal: 12, proteinG: 0.4, fatG: 0.1, carbG: 3.6, saltEquivalentG: 0.1, fiberG: 1.5, sugarG: 2.1, saturatedFatG: 0.0, potassiumMg: 410, calciumMg: 39, ironMg: 0.2, vitaminCMg: 7 },
      unitGrams: { 本: 100 },
    },
  },
  {
    keywords: ['クレソン'],
    foodCode: 'V07120',
    entry: {
      per100g: { energyKcal: 15, proteinG: 2.1, fatG: 0.1, carbG: 2.5, saltEquivalentG: 0.0, fiberG: 2.5, sugarG: 0.3, saturatedFatG: 0.0, potassiumMg: 330, calciumMg: 81, ironMg: 1.1, vitaminCMg: 41 },
      unitGrams: { 束: 40, 袋: 40 },
    },
  },
  {
    keywords: ['ラディッシュ', '二十日大根', 'はつかだいこん'],
    foodCode: 'V04050',
    entry: {
      per100g: { energyKcal: 16, proteinG: 0.7, fatG: 0.1, carbG: 3.4, saltEquivalentG: 0.0, fiberG: 1.6, sugarG: 2.0, saturatedFatG: 0.0, potassiumMg: 250, calciumMg: 24, ironMg: 0.2, vitaminCMg: 15 },
      unitGrams: { 個: 15, 束: 100 },
    },
  },
  {
    keywords: ['ししとう', 'しし唐辛子'],
    foodCode: 'V06042',
    entry: {
      per100g: { energyKcal: 27, proteinG: 1.9, fatG: 0.2, carbG: 5.5, saltEquivalentG: 0.0, fiberG: 3.6, sugarG: 2.0, saturatedFatG: 0.0, potassiumMg: 340, calciumMg: 36, ironMg: 0.5, vitaminCMg: 76 },
      unitGrams: { 本: 5, 袋: 100 },
    },
  },
  {
    keywords: ['ふき', '蕗'],
    entry: {
      per100g: { energyKcal: 11, proteinG: 0.3, fatG: 0.1, carbG: 3.3, saltEquivalentG: 0.0, fiberG: 2.6, sugarG: 0.3, saturatedFatG: 0.0, potassiumMg: 330, calciumMg: 40, ironMg: 0.3, vitaminCMg: 5 },
      unitGrams: { 本: 20, 束: 120 },
    },
  },
  {
    keywords: ['菜の花', 'なばな'],
    entry: {
      per100g: { energyKcal: 33, proteinG: 3.7, fatG: 0.1, carbG: 5.9, saltEquivalentG: 0.0, fiberG: 4.2, sugarG: 0.8, saturatedFatG: 0.0, potassiumMg: 390, calciumMg: 160, ironMg: 2.9, vitaminCMg: 130 },
      unitGrams: { 束: 150, 袋: 150 },
    },
  },
  {
    keywords: ['好みの野菜', '野菜', '具材'],
    entry: {
      per100g: { energyKcal: 30, proteinG: 1.5, fatG: 0.3, carbG: 6.0, saltEquivalentG: 0.0, fiberG: 2.2, sugarG: 3.0, saturatedFatG: 0.0, potassiumMg: 260, calciumMg: 35, ironMg: 0.6, vitaminCMg: 20 },
      unitGrams: { 個: 120, 皿: 100 },
    },
  },
  {
    keywords: ['ミックスベジタブル'],
    foodCode: 'V07998',
    entry: {
      per100g: { energyKcal: 75, proteinG: 3.0, fatG: 0.8, carbG: 15.0, saltEquivalentG: 0.1, fiberG: 3.5, sugarG: 4.8, saturatedFatG: 0.1, potassiumMg: 250, calciumMg: 18, ironMg: 0.7, vitaminCMg: 10 },
      unitGrams: { 袋: 200 },
    },
  },
  {
    keywords: ['グリンピース', 'グリーンピース'],
    foodCode: 'V03072',
    entry: {
      per100g: { energyKcal: 93, proteinG: 7.7, fatG: 0.6, carbG: 15.3, saltEquivalentG: 0.0, fiberG: 7.1, sugarG: 4.7, saturatedFatG: 0.1, potassiumMg: 430, calciumMg: 22, ironMg: 1.2, vitaminCMg: 23 },
      unitGrams: { 袋: 120 },
    },
  },

  // ──────────────── きのこ類 ────────────────
  {
    keywords: ['しいたけ', 'シイタケ', '椎茸'],
    entry: {
      per100g: { energyKcal: 18, proteinG: 3.0, fatG: 0.4, carbG: 6.4, saltEquivalentG: 0.0, fiberG: 4.9, sugarG: 1.5, saturatedFatG: 0.1, potassiumMg: 260, calciumMg: 2, ironMg: 0.3, vitaminCMg: 0 },
      unitGrams: { 個: 20, 枚: 20 },
    },
  },
  {
    keywords: ['しめじ', 'シメジ', 'ぶなしめじ'],
    entry: {
      per100g: { energyKcal: 18, proteinG: 2.7, fatG: 0.6, carbG: 4.8, saltEquivalentG: 0.0, fiberG: 3.7, sugarG: 1.1, saturatedFatG: 0.1, potassiumMg: 370, calciumMg: 1, ironMg: 0.5, vitaminCMg: 0 },
      unitGrams: { パック: 100, 袋: 100 },
    },
  },
  {
    keywords: ['ブナピー'],
    entry: {
      per100g: { energyKcal: 19, proteinG: 2.5, fatG: 0.4, carbG: 5.0, saltEquivalentG: 0.0, fiberG: 3.5, sugarG: 1.2, saturatedFatG: 0.1, potassiumMg: 380, calciumMg: 2, ironMg: 0.4, vitaminCMg: 0 },
      unitGrams: { パック: 100, 袋: 100 },
    },
  },
  {
    keywords: ['えのき', 'エノキ', 'えのきたけ', 'えのき茸'],
    entry: {
      per100g: { energyKcal: 22, proteinG: 2.7, fatG: 0.2, carbG: 7.6, saltEquivalentG: 0.0, fiberG: 3.9, sugarG: 3.7, saturatedFatG: 0.0, potassiumMg: 340, calciumMg: 0, ironMg: 1.1, vitaminCMg: 0 },
      unitGrams: { 袋: 100 },
    },
  },
  {
    keywords: ['まいたけ', 'マイタケ', '舞茸'],
    entry: {
      per100g: { energyKcal: 16, proteinG: 2.0, fatG: 0.5, carbG: 4.4, saltEquivalentG: 0.0, fiberG: 3.5, sugarG: 0.9, saturatedFatG: 0.1, potassiumMg: 230, calciumMg: 0, ironMg: 0.2, vitaminCMg: 0 },
      unitGrams: { パック: 100 },
    },
  },
  {
    keywords: ['エリンギ', 'えりんぎ'],
    entry: {
      per100g: { energyKcal: 24, proteinG: 2.8, fatG: 0.4, carbG: 6.0, saltEquivalentG: 0.0, fiberG: 3.4, sugarG: 2.6, saturatedFatG: 0.1, potassiumMg: 340, calciumMg: 0, ironMg: 0.4, vitaminCMg: 0 },
      unitGrams: { 本: 50 },
    },
  },
  {
    keywords: ['きくらげ', '木耳'],
    entry: {
      per100g: { energyKcal: 13, proteinG: 1.3, fatG: 0.1, carbG: 5.2, saltEquivalentG: 0.0, fiberG: 5.6, sugarG: 0.5, saturatedFatG: 0.0, potassiumMg: 630, calciumMg: 35, ironMg: 0.5, vitaminCMg: 0 },
      unitGrams: { 袋: 10 },
    },
  },
  {
    keywords: ['マッシュルーム'],
    entry: {
      per100g: { energyKcal: 15, proteinG: 2.9, fatG: 0.3, carbG: 2.4, saltEquivalentG: 0.0, fiberG: 2.0, sugarG: 1.3, saturatedFatG: 0.1, potassiumMg: 310, calciumMg: 2, ironMg: 0.3, vitaminCMg: 2 },
      unitGrams: { 個: 15, パック: 100 },
    },
  },
  {
    keywords: ['きのこ', 'きのこ類'],
    entry: {
      per100g: { energyKcal: 19, proteinG: 2.8, fatG: 0.4, carbG: 4.8, saltEquivalentG: 0.0, fiberG: 3.8, sugarG: 1.3, saturatedFatG: 0.1, potassiumMg: 320, calciumMg: 2, ironMg: 0.4, vitaminCMg: 1 },
      unitGrams: { 袋: 100, パック: 100 },
    },
  },

  // ──────────────── 果物・ドライフルーツ ────────────────
  {
    keywords: ['りんご', 'リンゴ', '林檎'],
    entry: {
      per100g: { energyKcal: 53, proteinG: 0.2, fatG: 0.1, carbG: 15.5, saltEquivalentG: 0.0, fiberG: 1.9, sugarG: 12.0, saturatedFatG: 0.0, potassiumMg: 120, calciumMg: 4, ironMg: 0.1, vitaminCMg: 6 },
      unitGrams: { 個: 280, 玉: 280 },
    },
  },
  {
    keywords: ['いちご', '苺', 'イチゴ'],
    entry: {
      per100g: { energyKcal: 31, proteinG: 0.9, fatG: 0.1, carbG: 8.5, saltEquivalentG: 0.0, fiberG: 1.4, sugarG: 7.0, saturatedFatG: 0.0, potassiumMg: 170, calciumMg: 17, ironMg: 0.3, vitaminCMg: 62 },
      unitGrams: { 個: 12, パック: 250 },
    },
  },
  {
    keywords: ['バナナ'],
    entry: {
      per100g: { energyKcal: 93, proteinG: 1.1, fatG: 0.2, carbG: 22.5, saltEquivalentG: 0.0, fiberG: 1.1, sugarG: 19.4, saturatedFatG: 0.1, potassiumMg: 360, calciumMg: 6, ironMg: 0.3, vitaminCMg: 16 },
      unitGrams: { 本: 100, 個: 100 },
    },
  },
  {
    keywords: ['パイナップル'],
    entry: {
      per100g: { energyKcal: 54, proteinG: 0.5, fatG: 0.1, carbG: 13.7, saltEquivalentG: 0.0, fiberG: 1.2, sugarG: 12.0, saturatedFatG: 0.0, potassiumMg: 150, calciumMg: 11, ironMg: 0.2, vitaminCMg: 35 },
      unitGrams: { 個: 900, 缶: 200 },
    },
  },
  {
    keywords: ['栗の甘露煮'],
    entry: {
      per100g: { energyKcal: 222, proteinG: 1.5, fatG: 0.3, carbG: 53.6, saltEquivalentG: 0.0, fiberG: 2.2, sugarG: 43.0, saturatedFatG: 0.1, potassiumMg: 190, calciumMg: 20, ironMg: 0.5, vitaminCMg: 1 },
      unitGrams: { 個: 20 },
    },
  },
  {
    keywords: ['栗', 'くり'],
    entry: {
      per100g: { energyKcal: 152, proteinG: 2.8, fatG: 0.5, carbG: 36.9, saltEquivalentG: 0.0, fiberG: 4.2, sugarG: 8.6, saturatedFatG: 0.1, potassiumMg: 460, calciumMg: 23, ironMg: 0.8, vitaminCMg: 33 },
      unitGrams: { 個: 20 },
    },
  },
  {
    keywords: ['レーズン', '干しぶどう', '干しブドウ'],
    entry: {
      per100g: { energyKcal: 324, proteinG: 2.7, fatG: 0.2, carbG: 80.5, saltEquivalentG: 0.0, fiberG: 4.1, sugarG: 76.2, saturatedFatG: 0.1, potassiumMg: 740, calciumMg: 65, ironMg: 2.3, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
    },
  },
  {
    keywords: ['くるみ', '胡桃'],
    foodCode: 'N01001',
    entry: {
      per100g: { energyKcal: 713, proteinG: 14.6, fatG: 68.8, carbG: 11.7, saltEquivalentG: 0.0, fiberG: 7.5, sugarG: 2.6, saturatedFatG: 6.0, potassiumMg: 540, calciumMg: 85, ironMg: 2.6, vitaminCMg: 1 },
      oosajiG: 7, kosajiG: 2,
    },
  },
  {
    keywords: ['スライスアーモンド', 'アーモンド'],
    foodCode: 'N01002',
    entry: {
      per100g: { energyKcal: 608, proteinG: 19.6, fatG: 54.1, carbG: 19.7, saltEquivalentG: 0.0, fiberG: 11.0, sugarG: 4.7, saturatedFatG: 4.2, potassiumMg: 760, calciumMg: 260, ironMg: 3.7, vitaminCMg: 0 },
      oosajiG: 7, kosajiG: 2,
    },
  },
  {
    keywords: ['松の実', 'まつの実', '松の子'],
    entry: {
      per100g: { energyKcal: 669, proteinG: 13.1, fatG: 65.0, carbG: 13.0, saltEquivalentG: 0.0, fiberG: 4.0, sugarG: 3.6, saturatedFatG: 4.9, potassiumMg: 600, calciumMg: 16, ironMg: 5.5, vitaminCMg: 0 },
      oosajiG: 8, kosajiG: 3,
    },
  },

  // ──────────────── 海藻類 ────────────────
  {
    keywords: ['ひじき', 'ヒジキ'],
    foodCode: 'S03011',
    entry: {
      per100g: { energyKcal: 139, proteinG: 9.2, fatG: 3.2, carbG: 58.4, saltEquivalentG: 1.5, fiberG: 43.3, sugarG: 0.0, saturatedFatG: 0.6, potassiumMg: 6400, calciumMg: 1000, ironMg: 6.2, vitaminCMg: 0 },
      oosajiG: 2, kosajiG: 1,
    },
  },
  {
    keywords: ['昆布', 'こんぶ'],
    foodCode: 'S01011',
    entry: {
      per100g: { energyKcal: 138, proteinG: 8.3, fatG: 1.5, carbG: 56.5, saltEquivalentG: 7.1, fiberG: 31.4, sugarG: 2.5, saturatedFatG: 0.3, potassiumMg: 5300, calciumMg: 760, ironMg: 2.9, vitaminCMg: 0 },
      unitGrams: { 枚: 4, 本: 20 },
    },
  },
  {
    keywords: ['青のり', 'あおのり'],
    foodCode: 'S02031',
    entry: {
      per100g: { energyKcal: 164, proteinG: 22.1, fatG: 0.8, carbG: 41.7, saltEquivalentG: 8.4, fiberG: 36.0, sugarG: 0.0, saturatedFatG: 0.1, potassiumMg: 3200, calciumMg: 770, ironMg: 13.0, vitaminCMg: 0 },
      oosajiG: 2, kosajiG: 1,
    },
  },

  // ──────────────── 豆・大豆製品 ────────────────
  {
    keywords: ['木綿豆腐', '木綿', 'もめん豆腐'],
    entry: {
      per100g: { energyKcal: 72, proteinG: 6.6, fatG: 4.2, carbG: 1.2, saltEquivalentG: 0.0, fiberG: 0.4, sugarG: 0.2, saturatedFatG: 0.6, potassiumMg: 110, calciumMg: 93, ironMg: 1.5, vitaminCMg: 0 },
      unitGrams: { 丁: 300, 個: 300 },
    },
  },
  {
    keywords: ['絹豆腐', '絹ごし', 'きぬ豆腐'],
    entry: {
      per100g: { energyKcal: 56, proteinG: 4.9, fatG: 3.0, carbG: 1.5, saltEquivalentG: 0.0, fiberG: 0.3, sugarG: 0.4, saturatedFatG: 0.4, potassiumMg: 140, calciumMg: 75, ironMg: 1.2, vitaminCMg: 0 },
      unitGrams: { 丁: 300, 個: 300 },
    },
  },
  {
    keywords: ['豆腐', 'とうふ', 'トウフ'],
    entry: {
      per100g: { energyKcal: 64, proteinG: 5.7, fatG: 3.6, carbG: 1.4, saltEquivalentG: 0.0, fiberG: 0.4, sugarG: 0.3, saturatedFatG: 0.5, potassiumMg: 125, calciumMg: 84, ironMg: 1.4, vitaminCMg: 0 },
      unitGrams: { 丁: 300, 個: 300 },
    },
  },
  {
    keywords: ['油揚げ', 'あぶらあげ', '揚げ豆腐'],
    entry: {
      per100g: { energyKcal: 377, proteinG: 15.3, fatG: 34.4, carbG: 0.4, saltEquivalentG: 0.0, fiberG: 0.7, sugarG: 0.1, saturatedFatG: 5.5, potassiumMg: 150, calciumMg: 300, ironMg: 3.2, vitaminCMg: 0 },
      unitGrams: { 枚: 20 },
    },
  },
  {
    keywords: ['厚揚げ', 'あつあげ'],
    entry: {
      per100g: { energyKcal: 143, proteinG: 10.7, fatG: 11.3, carbG: 0.2, saltEquivalentG: 0.0, fiberG: 0.7, sugarG: 0.1, saturatedFatG: 1.8, potassiumMg: 120, calciumMg: 240, ironMg: 2.6, vitaminCMg: 0 },
      unitGrams: { 個: 150, 枚: 150 },
    },
  },
  {
    keywords: ['大豆', 'だいず', 'ダイズ'],
    entry: {
      per100g: { energyKcal: 143, proteinG: 14.8, fatG: 6.2, carbG: 8.9, saltEquivalentG: 0.0, fiberG: 7.0, sugarG: 0.0, saturatedFatG: 0.9, potassiumMg: 530, calciumMg: 70, ironMg: 2.2, vitaminCMg: 0 },
    },
  },
  {
    keywords: ['枝豆', 'えだまめ', '冷凍枝豆'],
    foodCode: 'B01011',
    entry: {
      per100g: { energyKcal: 125, proteinG: 11.7, fatG: 6.2, carbG: 8.9, saltEquivalentG: 0.0, fiberG: 4.6, sugarG: 1.5, saturatedFatG: 0.8, potassiumMg: 590, calciumMg: 58, ironMg: 2.5, vitaminCMg: 27 },
      unitGrams: { 袋: 200, パック: 120 },
    },
  },
  {
    keywords: ['そら豆', '空豆'],
    entry: {
      per100g: { energyKcal: 102, proteinG: 10.9, fatG: 0.2, carbG: 15.5, saltEquivalentG: 0.0, fiberG: 6.2, sugarG: 2.0, saturatedFatG: 0.0, potassiumMg: 440, calciumMg: 22, ironMg: 2.3, vitaminCMg: 18 },
      unitGrams: { 袋: 200, パック: 120 },
    },
  },
  {
    keywords: ['あずき', '小豆'],
    entry: {
      per100g: { energyKcal: 127, proteinG: 8.7, fatG: 0.6, carbG: 25.1, saltEquivalentG: 0.0, fiberG: 11.8, sugarG: 0.4, saturatedFatG: 0.1, potassiumMg: 860, calciumMg: 27, ironMg: 2.2, vitaminCMg: 0 },
      unitGrams: { 袋: 200 },
    },
  },
  {
    keywords: ['黒豆', 'くろまめ'],
    entry: {
      per100g: { energyKcal: 165, proteinG: 11.4, fatG: 6.8, carbG: 14.0, saltEquivalentG: 0.0, fiberG: 8.8, sugarG: 0.7, saturatedFatG: 1.0, potassiumMg: 820, calciumMg: 120, ironMg: 2.3, vitaminCMg: 0 },
      unitGrams: { 袋: 200 },
    },
  },
  {
    keywords: ['きな粉', 'きなこ'],
    entry: {
      per100g: { energyKcal: 451, proteinG: 36.7, fatG: 25.7, carbG: 28.5, saltEquivalentG: 0.0, fiberG: 15.5, sugarG: 11.0, saturatedFatG: 3.5, potassiumMg: 2000, calciumMg: 260, ironMg: 8.0, vitaminCMg: 0 },
      oosajiG: 6, kosajiG: 2,
    },
  },
  {
    keywords: ['ぎんなん', '銀杏'],
    entry: {
      per100g: { energyKcal: 188, proteinG: 4.0, fatG: 1.7, carbG: 37.4, saltEquivalentG: 0.0, fiberG: 1.6, sugarG: 0.5, saturatedFatG: 0.3, potassiumMg: 580, calciumMg: 17, ironMg: 1.0, vitaminCMg: 23 },
      unitGrams: { 個: 2, 袋: 80 },
    },
  },
  {
    keywords: ['こんにゃく', 'コンニャク', '蒟蒻', 'しらたき', 'しらたき'],
    entry: {
      per100g: { energyKcal: 5, proteinG: 0.1, fatG: 0.0, carbG: 2.3, saltEquivalentG: 0.0, fiberG: 2.2, sugarG: 0.1, saturatedFatG: 0.0, potassiumMg: 33, calciumMg: 43, ironMg: 0.4, vitaminCMg: 0 },
      unitGrams: { 丁: 250, 袋: 200 },
    },
  },

  // ──────────────── 卵・乳製品 ────────────────
  {
    keywords: ['卵', 'たまご', 'タマゴ', '鶏卵', 'eggs'],
    entry: {
      per100g: { energyKcal: 151, proteinG: 12.3, fatG: 10.3, carbG: 0.3, saltEquivalentG: 0.4, fiberG: 0, sugarG: 0.3, saturatedFatG: 3.1, potassiumMg: 130, calciumMg: 51, ironMg: 1.8, vitaminCMg: 0 },
      unitGrams: { 個: 60, L個: 70, M個: 60, S個: 50 },
    },
  },
  {
    keywords: ['牛乳', 'ぎゅうにゅう', 'ミルク', '全乳'],
    entry: {
      per100g: { energyKcal: 67, proteinG: 3.3, fatG: 3.8, carbG: 4.8, saltEquivalentG: 0.1, fiberG: 0, sugarG: 4.8, saturatedFatG: 2.3, potassiumMg: 150, calciumMg: 110, ironMg: 0.0, vitaminCMg: 1 },
      oosajiG: 15,
    },
  },
  {
    keywords: ['豆乳', 'とうにゅう'],
    foodCode: 'D02031',
    entry: {
      per100g: { energyKcal: 46, proteinG: 3.6, fatG: 2.8, carbG: 3.1, saltEquivalentG: 0.0, fiberG: 0.2, sugarG: 1.2, saturatedFatG: 0.4, potassiumMg: 190, calciumMg: 15, ironMg: 1.2, vitaminCMg: 0 },
      oosajiG: 15,
    },
  },
  {
    keywords: ['生クリーム', '生クリーム', '動物性クリーム', 'ホイップ'],
    entry: {
      per100g: { energyKcal: 433, proteinG: 2.0, fatG: 45.0, carbG: 3.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 3.1, saturatedFatG: 27.5, potassiumMg: 90, calciumMg: 60, ironMg: 0.0, vitaminCMg: 1 },
    },
  },
  {
    keywords: ['チーズ', 'チェダー', 'プロセスチーズ', 'スライスチーズ'],
    entry: {
      per100g: { energyKcal: 339, proteinG: 22.7, fatG: 26.0, carbG: 1.3, saltEquivalentG: 2.8, fiberG: 0, sugarG: 1.3, saturatedFatG: 16.0, potassiumMg: 60, calciumMg: 630, ironMg: 0.3, vitaminCMg: 0 },
      unitGrams: { 枚: 18 },
    },
  },
  {
    keywords: ['ヨーグルト', 'プレーンヨーグルト'],
    entry: {
      per100g: { energyKcal: 62, proteinG: 3.6, fatG: 3.0, carbG: 4.9, saltEquivalentG: 0.1, fiberG: 0, sugarG: 4.9, saturatedFatG: 1.9, potassiumMg: 170, calciumMg: 120, ironMg: 0.0, vitaminCMg: 1 },
    },
  },

  // ──────────────── 穀類 ────────────────
  {
    // 炊飯後の白飯（生米より前に配置して優先マッチ）
    keywords: ['白飯', 'ご飯', 'ごはん', '炊きたて', '炊いたご飯'],
    entry: {
      per100g: { energyKcal: 168, proteinG: 2.5, fatG: 0.3, carbG: 37.1, saltEquivalentG: 0.0, fiberG: 0.3, sugarG: 0.3, saturatedFatG: 0.1, potassiumMg: 29, calciumMg: 3, ironMg: 0.1, vitaminCMg: 0 },
      unitGrams: { 人前: 160, 人分: 160, 膳: 160, 皿: 160, 茶碗: 160, 杯: 160, 丼杯分: 350, お茶碗杯分: 160 },
    },
  },
  {
    keywords: ['米', 'こめ', '白米', '精白米'],
    entry: {
      per100g: { energyKcal: 358, proteinG: 6.1, fatG: 0.9, carbG: 77.6, saltEquivalentG: 0.0, fiberG: 0.5, sugarG: 0.3, saturatedFatG: 0.3, potassiumMg: 89, calciumMg: 5, ironMg: 0.8, vitaminCMg: 0 },
      unitGrams: { 合: 150 },
    },
  },
  {
    keywords: ['もち', '餅', '切り餅'],
    entry: {
      per100g: { energyKcal: 235, proteinG: 4.2, fatG: 0.8, carbG: 50.8, saltEquivalentG: 0.0, fiberG: 0.6, sugarG: 0.4, saturatedFatG: 0.2, potassiumMg: 30, calciumMg: 4, ironMg: 0.4, vitaminCMg: 0 },
      unitGrams: { 個: 50, 枚: 50 },
    },
  },
  {
    keywords: ['うどん', 'ウドン', '饂飩'],
    entry: {
      per100g: { energyKcal: 105, proteinG: 2.6, fatG: 0.4, carbG: 24.2, saltEquivalentG: 0.3, fiberG: 0.8, sugarG: 0.4, saturatedFatG: 0.1, potassiumMg: 15, calciumMg: 8, ironMg: 0.2, vitaminCMg: 0 },
      unitGrams: { 人前: 200, 人分: 200, 玉: 200 },
    },
  },
  {
    keywords: ['そば', 'ソバ', '蕎麦'],
    entry: {
      per100g: { energyKcal: 132, proteinG: 4.8, fatG: 0.7, carbG: 28.4, saltEquivalentG: 0.0, fiberG: 1.5, sugarG: 0.4, saturatedFatG: 0.2, potassiumMg: 37, calciumMg: 6, ironMg: 0.7, vitaminCMg: 0 },
      unitGrams: { 人前: 200, 人分: 200 },
    },
  },
  {
    keywords: ['パスタ', 'スパゲッティ', 'スパゲティ', 'ペンネ', 'マカロニ'],
    entry: {
      per100g: { energyKcal: 165, proteinG: 5.8, fatG: 0.9, carbG: 34.5, saltEquivalentG: 0.0, fiberG: 1.7, sugarG: 0.5, saturatedFatG: 0.2, potassiumMg: 65, calciumMg: 10, ironMg: 0.6, vitaminCMg: 0 },
      unitGrams: { 人前: 100, 人分: 100 },
    },
  },
  {
    keywords: ['ラーメン', 'らーめん', '中華麺', '中華めん', '中華そば', 'ちゅうかめん'],
    entry: {
      per100g: { energyKcal: 149, proteinG: 4.9, fatG: 0.6, carbG: 33.6, saltEquivalentG: 0.4, fiberG: 1.3, sugarG: 0.5, saturatedFatG: 0.1, potassiumMg: 45, calciumMg: 9, ironMg: 0.4, vitaminCMg: 0 },
      unitGrams: { 人前: 120, 人分: 120, 玉: 130 },
    },
  },
  {
    keywords: ['春雨', 'はるさめ', '緑豆春雨'],
    foodCode: 'G01091',
    entry: {
      per100g: { energyKcal: 344, proteinG: 0.1, fatG: 0.1, carbG: 85.1, saltEquivalentG: 0.0, fiberG: 0.5, sugarG: 0.2, saturatedFatG: 0.0, potassiumMg: 12, calciumMg: 8, ironMg: 0.2, vitaminCMg: 0 },
      unitGrams: { 袋: 100 },
    },
  },
  {
    keywords: ['小麦粉', 'こむぎこ', '薄力粉', '強力粉', '中力粉'],
    entry: {
      per100g: { energyKcal: 368, proteinG: 7.7, fatG: 1.5, carbG: 75.9, saltEquivalentG: 0.0, fiberG: 2.5, sugarG: 0.4, saturatedFatG: 0.2, potassiumMg: 110, calciumMg: 20, ironMg: 0.5, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
    },
  },
  {
    keywords: ['片栗粉', 'かたくりこ', 'でんぷん', 'コーンスターチ'],
    entry: {
      per100g: { energyKcal: 330, proteinG: 0.1, fatG: 0.1, carbG: 81.6, saltEquivalentG: 0.0, fiberG: 0.1, sugarG: 0.1, saturatedFatG: 0.0, potassiumMg: 3, calciumMg: 4, ironMg: 0.2, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
    },
  },
  {
    keywords: ['パン粉', 'ぱんこ'],
    entry: {
      per100g: { energyKcal: 370, proteinG: 13.0, fatG: 6.8, carbG: 69.5, saltEquivalentG: 0.8, fiberG: 2.8, sugarG: 2.3, saturatedFatG: 1.9, potassiumMg: 130, calciumMg: 31, ironMg: 1.0, vitaminCMg: 0 },
    },
  },
  {
    keywords: ['から揚げ粉', '唐揚げ粉'],
    foodCode: 'G02061',
    entry: {
      per100g: { energyKcal: 347, proteinG: 8.0, fatG: 2.5, carbG: 73.0, saltEquivalentG: 2.8, fiberG: 2.0, sugarG: 3.5, saturatedFatG: 0.5, potassiumMg: 120, calciumMg: 22, ironMg: 0.8, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
    },
  },
  {
    keywords: ['ホットケーキミックス', 'パンケーキミックス'],
    foodCode: 'G02062',
    entry: {
      per100g: { energyKcal: 367, proteinG: 7.9, fatG: 2.6, carbG: 77.0, saltEquivalentG: 1.5, fiberG: 2.0, sugarG: 20.0, saturatedFatG: 0.6, potassiumMg: 140, calciumMg: 250, ironMg: 0.9, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
    },
  },
  {
    keywords: ['春巻きの皮', '春巻の皮'],
    foodCode: 'G02063',
    entry: {
      per100g: { energyKcal: 299, proteinG: 6.3, fatG: 1.0, carbG: 66.2, saltEquivalentG: 1.1, fiberG: 2.1, sugarG: 1.6, saturatedFatG: 0.2, potassiumMg: 120, calciumMg: 16, ironMg: 0.6, vitaminCMg: 0 },
      unitGrams: { 枚: 10 },
    },
  },
  {
    keywords: ['シュウマイの皮', '焼売の皮', 'しゅうまいの皮'],
    foodCode: 'G02064',
    entry: {
      per100g: { energyKcal: 298, proteinG: 7.2, fatG: 1.1, carbG: 65.0, saltEquivalentG: 1.2, fiberG: 2.2, sugarG: 1.8, saturatedFatG: 0.2, potassiumMg: 130, calciumMg: 18, ironMg: 0.7, vitaminCMg: 0 },
      unitGrams: { 枚: 2.8 },
    },
  },
  {
    keywords: ['ココア', '純ココア', 'ココアパウダー'],
    entry: {
      per100g: { energyKcal: 271, proteinG: 18.5, fatG: 21.6, carbG: 42.0, saltEquivalentG: 0.0, fiberG: 23.9, sugarG: 0.9, saturatedFatG: 13.1, potassiumMg: 2800, calciumMg: 140, ironMg: 14.0, vitaminCMg: 0 },
      oosajiG: 6, kosajiG: 2,
    },
  },
  {
    keywords: ['チョコレート', '板チョコ', 'チョコ'],
    entry: {
      per100g: { energyKcal: 550, proteinG: 6.9, fatG: 35.7, carbG: 53.8, saltEquivalentG: 0.1, fiberG: 4.9, sugarG: 48.6, saturatedFatG: 21.4, potassiumMg: 240, calciumMg: 47, ironMg: 2.5, vitaminCMg: 0 },
      unitGrams: { 枚: 50, 個: 5 },
    },
  },

  // ──────────────── 調味料（液体・塩分系） ────────────────
  {
    keywords: ['醤油', 'しょうゆ', 'しょう油', '濃口醤油', '薄口醤油'],
    entry: {
      per100g: { energyKcal: 71, proteinG: 7.7, fatG: 0.0, carbG: 7.9, saltEquivalentG: 14.5, fiberG: 0, sugarG: 6.2, saturatedFatG: 0.0, potassiumMg: 390, calciumMg: 21, ironMg: 1.7, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['味噌', 'みそ', '米みそ', '麦みそ', '白みそ', '赤みそ'],
    entry: {
      per100g: { energyKcal: 182, proteinG: 12.5, fatG: 6.0, carbG: 21.9, saltEquivalentG: 12.4, fiberG: 4.9, sugarG: 6.5, saturatedFatG: 1.0, potassiumMg: 380, calciumMg: 100, ironMg: 3.4, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['塩', 'しお', '食塩', '天然塩', '岩塩'],
    entry: {
      per100g: { energyKcal: 0, proteinG: 0.0, fatG: 0.0, carbG: 0.0, saltEquivalentG: 100.0, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.0, potassiumMg: 100, calciumMg: 22, ironMg: 0.0, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['ポン酢', 'ぽんず', 'ポン酢醤油'],
    entry: {
      per100g: { energyKcal: 45, proteinG: 2.3, fatG: 0.0, carbG: 10.0, saltEquivalentG: 7.8, fiberG: 0, sugarG: 6.5, saturatedFatG: 0.0, potassiumMg: 150, calciumMg: 12, ironMg: 0.5, vitaminCMg: 4 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['酢', 'す', '穀物酢', '米酢', '黒酢', 'バルサミコ酢'],
    entry: {
      per100g: { energyKcal: 25, proteinG: 0.1, fatG: 0.0, carbG: 2.4, saltEquivalentG: 0.0, fiberG: 0, sugarG: 2.4, saturatedFatG: 0.0, potassiumMg: 2, calciumMg: 3, ironMg: 0.0, vitaminCMg: 0 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['めんつゆ', 'そばつゆ', 'だしつゆ', 'つゆ'],
    entry: {
      per100g: { energyKcal: 99, proteinG: 5.1, fatG: 0.0, carbG: 21.0, saltEquivalentG: 14.5, fiberG: 0, sugarG: 14.5, saturatedFatG: 0.0, potassiumMg: 380, calciumMg: 15, ironMg: 1.0, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['ウスターソース', '中濃ソース', 'とんかつソース', 'ソース'],
    entry: {
      per100g: { energyKcal: 132, proteinG: 1.0, fatG: 0.1, carbG: 31.5, saltEquivalentG: 3.6, fiberG: 0.5, sugarG: 20.0, saturatedFatG: 0.0, potassiumMg: 210, calciumMg: 18, ironMg: 1.3, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['ドレッシング', 'フレンチドレッシング', '和風ドレッシング'],
    foodCode: 'C03061',
    entry: {
      per100g: { energyKcal: 390, proteinG: 0.7, fatG: 37.5, carbG: 12.0, saltEquivalentG: 3.2, fiberG: 0, sugarG: 10.0, saturatedFatG: 5.3, potassiumMg: 70, calciumMg: 8, ironMg: 0.2, vitaminCMg: 0 },
      oosajiG: 14, kosajiG: 5,
    },
  },
  {
    keywords: ['ケチャップ', 'トマトケチャップ', 'ketchup'],
    entry: {
      per100g: { energyKcal: 119, proteinG: 1.6, fatG: 0.2, carbG: 27.5, saltEquivalentG: 3.2, fiberG: 1.7, sugarG: 17.0, saturatedFatG: 0.0, potassiumMg: 390, calciumMg: 16, ironMg: 0.5, vitaminCMg: 9 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['オイスターソース', 'カキソース', '蠔油'],
    entry: {
      per100g: { energyKcal: 107, proteinG: 7.7, fatG: 0.4, carbG: 18.0, saltEquivalentG: 11.4, fiberG: 0, sugarG: 12.0, saturatedFatG: 0.1, potassiumMg: 320, calciumMg: 53, ironMg: 3.1, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['豆板醤', 'トウバンジャン', 'コチュジャン'],
    entry: {
      per100g: { energyKcal: 49, proteinG: 2.2, fatG: 1.5, carbG: 8.0, saltEquivalentG: 17.8, fiberG: 2.0, sugarG: 3.0, saturatedFatG: 0.3, potassiumMg: 190, calciumMg: 30, ironMg: 1.2, vitaminCMg: 0 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['甜麺醤', 'テンメンジャン'],
    foodCode: 'C03079',
    entry: {
      per100g: { energyKcal: 250, proteinG: 7.0, fatG: 6.0, carbG: 42.0, saltEquivalentG: 6.0, fiberG: 2.0, sugarG: 30.0, saturatedFatG: 1.2, potassiumMg: 250, calciumMg: 45, ironMg: 1.8, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['コンソメ', '固形スープ', 'ブイヨン'],
    entry: {
      per100g: { energyKcal: 231, proteinG: 7.0, fatG: 2.0, carbG: 43.0, saltEquivalentG: 43.2, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.5, potassiumMg: 500, calciumMg: 40, ironMg: 1.5, vitaminCMg: 0 },
      oosajiG: 5, kosajiG: 2,
    },
  },
  {
    keywords: ['鶏ガラスープ', 'チキンスープの素', '中華スープ', '中華だし'],
    entry: {
      per100g: { energyKcal: 213, proteinG: 12.5, fatG: 5.0, carbG: 29.0, saltEquivalentG: 43.0, fiberG: 0, sugarG: 0.0, saturatedFatG: 1.0, potassiumMg: 450, calciumMg: 30, ironMg: 1.0, vitaminCMg: 0 },
      oosajiG: 5, kosajiG: 2,
    },
  },
  {
    keywords: ['たれ', 'タレ'],
    entry: {
      per100g: { energyKcal: 140, proteinG: 3.0, fatG: 0.2, carbG: 31.0, saltEquivalentG: 6.5, fiberG: 0.4, sugarG: 24.0, saturatedFatG: 0.0, potassiumMg: 180, calciumMg: 12, ironMg: 1.0, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['粒マスタード', 'マスタード'],
    entry: {
      per100g: { energyKcal: 235, proteinG: 7.3, fatG: 16.0, carbG: 14.0, saltEquivalentG: 5.2, fiberG: 6.0, sugarG: 7.0, saturatedFatG: 1.2, potassiumMg: 270, calciumMg: 62, ironMg: 2.8, vitaminCMg: 4 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['ナンプラー', '魚醤'],
    foodCode: 'C03071',
    entry: {
      per100g: { energyKcal: 64, proteinG: 10.5, fatG: 0.0, carbG: 5.5, saltEquivalentG: 21.0, fiberG: 0, sugarG: 0.6, saturatedFatG: 0.0, potassiumMg: 130, calciumMg: 25, ironMg: 1.2, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['キムチ'],
    foodCode: 'P04012',
    entry: {
      per100g: { energyKcal: 46, proteinG: 2.6, fatG: 0.6, carbG: 8.6, saltEquivalentG: 2.2, fiberG: 2.7, sugarG: 4.0, saturatedFatG: 0.1, potassiumMg: 340, calciumMg: 45, ironMg: 0.6, vitaminCMg: 34 },
      unitGrams: { パック: 120 },
    },
  },
  {
    keywords: ['梅干し', 'うめぼし'],
    foodCode: 'P02041',
    entry: {
      per100g: { energyKcal: 33, proteinG: 0.9, fatG: 0.2, carbG: 9.0, saltEquivalentG: 18.0, fiberG: 3.6, sugarG: 1.8, saturatedFatG: 0.0, potassiumMg: 440, calciumMg: 65, ironMg: 1.0, vitaminCMg: 0 },
      unitGrams: { 個: 10 },
    },
  },

  // ──────────────── 調味料（砂糖・甘味系） ────────────────
  {
    keywords: ['砂糖', 'さとう', '上白糖', 'グラニュー糖', '三温糖', 'きび砂糖'],
    entry: {
      per100g: { energyKcal: 384, proteinG: 0.0, fatG: 0.0, carbG: 99.2, saltEquivalentG: 0.0, fiberG: 0, sugarG: 99.2, saturatedFatG: 0.0, potassiumMg: 2, calciumMg: 1, ironMg: 0.0, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
    },
  },
  {
    keywords: ['みりん', '本みりん', 'みりん風'],
    entry: {
      per100g: { energyKcal: 241, proteinG: 0.3, fatG: 0.0, carbG: 43.2, saltEquivalentG: 0.0, fiberG: 0, sugarG: 43.2, saturatedFatG: 0.0, potassiumMg: 15, calciumMg: 0, ironMg: 0.0, vitaminCMg: 0 },
      oosajiG: 18, kosajiG: 6,
    },
  },
  {
    keywords: ['酒', 'さけ', '料理酒', '日本酒', '清酒'],
    entry: {
      per100g: { energyKcal: 109, proteinG: 0.4, fatG: 0.0, carbG: 5.0, saltEquivalentG: 0.0, fiberG: 0, sugarG: 4.5, saturatedFatG: 0.0, potassiumMg: 27, calciumMg: 2, ironMg: 0.0, vitaminCMg: 0 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['白ワイン', '赤ワイン', 'ワイン', 'ブランデー'],
    entry: {
      per100g: { energyKcal: 73, proteinG: 0.2, fatG: 0.0, carbG: 1.5, saltEquivalentG: 0.0, fiberG: 0, sugarG: 1.5, saturatedFatG: 0.0, potassiumMg: 60, calciumMg: 6, ironMg: 0.2, vitaminCMg: 0 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['はちみつ', 'ハチミツ', '蜂蜜', 'honey'],
    entry: {
      per100g: { energyKcal: 329, proteinG: 0.2, fatG: 0.0, carbG: 81.9, saltEquivalentG: 0.0, fiberG: 0, sugarG: 81.9, saturatedFatG: 0.0, potassiumMg: 65, calciumMg: 2, ironMg: 0.2, vitaminCMg: 0 },
      oosajiG: 21, kosajiG: 7,
    },
  },
  {
    keywords: ['マーマレード', 'オレンジマーマレード', 'ジャム'],
    entry: {
      per100g: { energyKcal: 268, proteinG: 0.3, fatG: 0.2, carbG: 68.0, saltEquivalentG: 0.0, fiberG: 0.6, sugarG: 63.0, saturatedFatG: 0.0, potassiumMg: 55, calciumMg: 9, ironMg: 0.2, vitaminCMg: 4 },
      oosajiG: 21, kosajiG: 7,
    },
  },
  {
    keywords: ['インスタントコーヒー', 'コーヒー'],
    entry: {
      per100g: { energyKcal: 288, proteinG: 14.6, fatG: 0.2, carbG: 56.5, saltEquivalentG: 0.0, fiberG: 14.9, sugarG: 0.0, saturatedFatG: 0.1, potassiumMg: 3600, calciumMg: 20, ironMg: 1.6, vitaminCMg: 0 },
      oosajiG: 2, kosajiG: 1,
    },
  },
  {
    keywords: ['カレールウ', 'ルウ', '市販のカレールウ'],
    foodCode: 'R01011',
    entry: {
      per100g: { energyKcal: 505, proteinG: 7.0, fatG: 33.7, carbG: 45.0, saltEquivalentG: 8.0, fiberG: 4.0, sugarG: 7.0, saturatedFatG: 19.0, potassiumMg: 260, calciumMg: 55, ironMg: 3.0, vitaminCMg: 0 },
      unitGrams: { 箱: 180, 片: 20 },
      oosajiG: 18,
      kosajiG: 6,
    },
  },

  // ──────────────── 油脂類 ────────────────
  {
    keywords: ['サラダ油', '植物油', '油', 'オリーブ油', 'オリーブオイル', 'ごま油', 'ラード'],
    entry: {
      per100g: { energyKcal: 921, proteinG: 0.0, fatG: 100.0, carbG: 0.0, saltEquivalentG: 0.0, fiberG: 0, sugarG: 0.0, saturatedFatG: 12.0, potassiumMg: 1, calciumMg: 1, ironMg: 0.0, vitaminCMg: 0 },
      oosajiG: 12, kosajiG: 4,
    },
  },
  {
    keywords: ['バター', 'マーガリン', 'ショートニング'],
    entry: {
      per100g: { energyKcal: 745, proteinG: 0.6, fatG: 83.0, carbG: 0.2, saltEquivalentG: 1.9, fiberG: 0, sugarG: 0.2, saturatedFatG: 52.4, potassiumMg: 28, calciumMg: 15, ironMg: 0.1, vitaminCMg: 0 },
      oosajiG: 13, kosajiG: 4,
    },
  },
  {
    keywords: ['マヨネーズ', 'マヨ'],
    entry: {
      per100g: { energyKcal: 703, proteinG: 1.4, fatG: 76.0, carbG: 3.0, saltEquivalentG: 1.9, fiberG: 0, sugarG: 3.0, saturatedFatG: 11.5, potassiumMg: 19, calciumMg: 14, ironMg: 0.3, vitaminCMg: 0 },
      oosajiG: 14, kosajiG: 5,
    },
  },

  // ──────────────── 香辛料・薬味 ────────────────
  {
    keywords: ['にんにく', 'ニンニク', '大蒜', 'ガーリック'],
    entry: {
      per100g: { energyKcal: 136, proteinG: 6.4, fatG: 0.9, carbG: 28.7, saltEquivalentG: 0.0, fiberG: 6.2, sugarG: 0.0, saturatedFatG: 0.2, potassiumMg: 530, calciumMg: 14, ironMg: 0.8, vitaminCMg: 12 },
      unitGrams: { 片: 8, 個: 8 },
    },
  },
  {
    keywords: ['しょうが', 'ショウガ', '生姜', 'ジンジャー'],
    entry: {
      per100g: { energyKcal: 30, proteinG: 0.9, fatG: 0.3, carbG: 7.0, saltEquivalentG: 0.0, fiberG: 2.1, sugarG: 1.0, saturatedFatG: 0.1, potassiumMg: 270, calciumMg: 12, ironMg: 0.5, vitaminCMg: 2 },
      unitGrams: { 片: 10, 個: 10 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['わさび', '山葵'],
    foodCode: 'V06092',
    entry: {
      per100g: { energyKcal: 88, proteinG: 5.0, fatG: 0.6, carbG: 16.7, saltEquivalentG: 0.0, fiberG: 7.9, sugarG: 0.6, saturatedFatG: 0.1, potassiumMg: 570, calciumMg: 110, ironMg: 1.0, vitaminCMg: 75 },
      unitGrams: { 本: 30, 片: 5 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['ごま', 'ゴマ', '胡麻', '白ごま', '黒ごま'],
    entry: {
      per100g: { energyKcal: 605, proteinG: 20.3, fatG: 54.2, carbG: 16.5, saltEquivalentG: 0.0, fiberG: 12.6, sugarG: 0.4, saturatedFatG: 8.0, potassiumMg: 410, calciumMg: 1200, ironMg: 9.6, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
    },
  },
  {
    keywords: ['こしょう', '胡椒', 'ブラックペッパー', '黒こしょう', '白こしょう', '黒胡椒'],
    entry: {
      per100g: { energyKcal: 375, proteinG: 10.4, fatG: 6.9, carbG: 64.8, saltEquivalentG: 0.1, fiberG: 25.3, sugarG: 0.6, saturatedFatG: 2.7, potassiumMg: 1300, calciumMg: 440, ironMg: 9.7, vitaminCMg: 21 },
      oosajiG: 6, kosajiG: 2,
    },
  },
  {
    keywords: ['練りからし', 'からし', '辛子', 'マスタード'],
    entry: {
      per100g: { energyKcal: 310, proteinG: 9.8, fatG: 16.8, carbG: 31.5, saltEquivalentG: 6.0, fiberG: 8.5, sugarG: 5.0, saturatedFatG: 1.0, potassiumMg: 450, calciumMg: 170, ironMg: 4.4, vitaminCMg: 10 },
      oosajiG: 15, kosajiG: 5,
    },
  },
  {
    keywords: ['抹茶'],
    entry: {
      per100g: { energyKcal: 324, proteinG: 29.6, fatG: 5.3, carbG: 39.5, saltEquivalentG: 0.0, fiberG: 38.5, sugarG: 0.0, saturatedFatG: 0.8, potassiumMg: 2700, calciumMg: 420, ironMg: 17.0, vitaminCMg: 60 },
      oosajiG: 6, kosajiG: 2,
    },
  },
  {
    keywords: ['カレー粉', 'クミン', 'クミンパウダー', 'シナモン', 'シナモンパウダー', 'ナツメグ', '七味とうがらし', '一味とうがらし', '赤とうがらし', '赤唐辛子', 'とうがらし', '唐辛子', '八角'],
    entry: {
      per100g: { energyKcal: 320, proteinG: 12.0, fatG: 14.0, carbG: 56.0, saltEquivalentG: 0.3, fiberG: 24.0, sugarG: 2.0, saturatedFatG: 2.5, potassiumMg: 1200, calciumMg: 420, ironMg: 18.0, vitaminCMg: 5 },
      oosajiG: 6, kosajiG: 2,
    },
  },
  {
    keywords: ['レモン汁', 'レモン果汁', 'レモン', 'ゆず', 'すだち'],
    entry: {
      per100g: { energyKcal: 26, proteinG: 0.6, fatG: 0.1, carbG: 8.6, saltEquivalentG: 0.0, fiberG: 1.3, sugarG: 2.5, saturatedFatG: 0.0, potassiumMg: 100, calciumMg: 26, ironMg: 0.2, vitaminCMg: 50 },
      oosajiG: 15, kosajiG: 5,
      unitGrams: { 個: 100 },
    },
  },
  {
    keywords: ['オリーブ', 'ブラックオリーブ', 'グリーンオリーブ'],
    foodCode: 'F05031',
    entry: {
      per100g: { energyKcal: 141, proteinG: 1.0, fatG: 15.0, carbG: 0.6, saltEquivalentG: 1.5, fiberG: 4.0, sugarG: 0.2, saturatedFatG: 2.1, potassiumMg: 42, calciumMg: 52, ironMg: 0.7, vitaminCMg: 0 },
      unitGrams: { 個: 3 },
    },
  },
  {
    keywords: ['パセリ', 'イタリアンパセリ', 'バジル', 'ローズマリー', 'ローリエ', 'ローリエ葉', 'コリアンダー', 'チャービル', '青じそ', 'みつ葉', '木の芽', 'タイム'],
    entry: {
      per100g: { energyKcal: 43, proteinG: 4.3, fatG: 0.8, carbG: 7.8, saltEquivalentG: 0.1, fiberG: 6.8, sugarG: 0.6, saturatedFatG: 0.1, potassiumMg: 1000, calciumMg: 210, ironMg: 7.0, vitaminCMg: 120 },
      unitGrams: { 枝: 5, 束: 20 },
      oosajiG: 2, kosajiG: 0.7,
    },
  },
  {
    keywords: ['かつお節', '鰹節', '花かつお'],
    entry: {
      per100g: { energyKcal: 351, proteinG: 77.1, fatG: 2.9, carbG: 0.8, saltEquivalentG: 1.5, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.6, potassiumMg: 940, calciumMg: 66, ironMg: 5.0, vitaminCMg: 0 },
      oosajiG: 2, kosajiG: 1,
    },
  },

  // ──────────────── パン・製菓素材 ────────────────
  {
    keywords: ['食パン', 'フランスパン', 'ロールパン', 'パン'],
    entry: {
      per100g: { energyKcal: 260, proteinG: 8.9, fatG: 4.2, carbG: 46.7, saltEquivalentG: 1.3, fiberG: 2.3, sugarG: 4.0, saturatedFatG: 1.0, potassiumMg: 90, calciumMg: 34, ironMg: 0.9, vitaminCMg: 0 },
      unitGrams: { 枚: 60, 個: 45 },
    },
  },
  {
    keywords: ['ベーキングパウダー', 'ドライイースト', 'イースト'],
    entry: {
      per100g: { energyKcal: 150, proteinG: 10.0, fatG: 1.0, carbG: 30.0, saltEquivalentG: 25.0, fiberG: 1.0, sugarG: 1.0, saturatedFatG: 0.2, potassiumMg: 400, calciumMg: 5000, ironMg: 0.5, vitaminCMg: 0 },
      oosajiG: 10, kosajiG: 3,
    },
  },
  {
    keywords: ['粉ゼラチン', 'ゼラチン'],
    entry: {
      per100g: { energyKcal: 343, proteinG: 87.6, fatG: 0.3, carbG: 0.0, saltEquivalentG: 0.5, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.1, potassiumMg: 2, calciumMg: 1, ironMg: 0.2, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
    },
  },
  {
    keywords: ['ハンバーグ'],
    entry: {
      per100g: { energyKcal: 223, proteinG: 13.8, fatG: 15.2, carbG: 8.5, saltEquivalentG: 1.7, fiberG: 0.8, sugarG: 2.4, saturatedFatG: 5.4, potassiumMg: 290, calciumMg: 28, ironMg: 1.8, vitaminCMg: 2 },
      unitGrams: { 個: 120 },
    },
  },
  {
    keywords: ['小籠包', 'ショウロンポウ'],
    entry: {
      per100g: { energyKcal: 230, proteinG: 8.8, fatG: 9.5, carbG: 27.5, saltEquivalentG: 1.2, fiberG: 1.1, sugarG: 1.6, saturatedFatG: 2.8, potassiumMg: 120, calciumMg: 18, ironMg: 1.0, vitaminCMg: 0 },
      unitGrams: { 個: 35 },
    },
  },

  // ──────────────── カットトマト缶・トマトピューレ ────────────────
  {
    keywords: ['カットトマト缶', 'ダイストマト', 'ホールトマト', 'トマト缶'],
    entry: {
      per100g: { energyKcal: 19, proteinG: 1.0, fatG: 0.1, carbG: 4.5, saltEquivalentG: 0.7, fiberG: 1.1, sugarG: 3.2, saturatedFatG: 0.0, potassiumMg: 220, calciumMg: 12, ironMg: 0.5, vitaminCMg: 14 },
      unitGrams: { 缶: 400 },
    },
  },
  {
    keywords: ['トマトピューレ', 'トマトソース', 'トマトペースト'],
    entry: {
      per100g: { energyKcal: 41, proteinG: 2.0, fatG: 0.2, carbG: 9.5, saltEquivalentG: 1.0, fiberG: 2.0, sugarG: 6.5, saturatedFatG: 0.0, potassiumMg: 450, calciumMg: 18, ironMg: 1.0, vitaminCMg: 18 },
    },
  },

  // ──────────────── だし・スープ系 ────────────────
  {
    keywords: ['だし', 'だし汁', '出汁', '和風だし', 'だし（'],
    entry: {
      per100g: { energyKcal: 3, proteinG: 0.5, fatG: 0.0, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.0, potassiumMg: 60, calciumMg: 5, ironMg: 0.1, vitaminCMg: 0 },
    },
  },
  {
    keywords: ['水', 'みず', '湯', 'お湯'],
    entry: {
      per100g: { energyKcal: 0, proteinG: 0.0, fatG: 0.0, carbG: 0.0, saltEquivalentG: 0.0, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.0, potassiumMg: 0, calciumMg: 10, ironMg: 0.0, vitaminCMg: 0 },
    },
  },
]
