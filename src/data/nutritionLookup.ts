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
}

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
    keywords: ['合いびき肉', 'あいびき', '合挽き', '合挽肉', '混合挽き'],
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

  // ──────────────── 魚介類 ────────────────
  {
    keywords: ['鮭', 'サーモン', 'サケ', 'シャケ'],
    entry: {
      per100g: { energyKcal: 133, proteinG: 22.3, fatG: 4.1, carbG: 0.1, saltEquivalentG: 0.1, fiberG: 0, sugarG: 0.1, saturatedFatG: 1.2, potassiumMg: 350, calciumMg: 14, ironMg: 0.5, vitaminCMg: 1 },
      unitGrams: { 切れ: 100, 枚: 100 },
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
    keywords: ['ツナ缶', 'ツナ（缶', 'ツナ缶詰'],
    entry: {
      per100g: { energyKcal: 288, proteinG: 17.7, fatG: 21.7, carbG: 0.1, saltEquivalentG: 0.5, fiberG: 0, sugarG: 0.1, saturatedFatG: 4.3, potassiumMg: 230, calciumMg: 5, ironMg: 1.0, vitaminCMg: 0 },
      unitGrams: { 缶: 70 },
    },
  },
  {
    keywords: ['しらす', 'ちりめんじゃこ', 'じゃこ'],
    entry: {
      per100g: { energyKcal: 113, proteinG: 23.7, fatG: 1.9, carbG: 0.0, saltEquivalentG: 2.1, fiberG: 0, sugarG: 0.0, saturatedFatG: 0.4, potassiumMg: 390, calciumMg: 210, ironMg: 0.9, vitaminCMg: 0 },
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
    keywords: ['ブロッコリー', 'ブロッコリ'],
    entry: {
      per100g: { energyKcal: 33, proteinG: 4.3, fatG: 0.5, carbG: 5.2, saltEquivalentG: 0.0, fiberG: 4.4, sugarG: 0.7, saturatedFatG: 0.1, potassiumMg: 360, calciumMg: 38, ironMg: 1.0, vitaminCMg: 120 },
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
    keywords: ['なす', 'ナス', '茄子'],
    entry: {
      per100g: { energyKcal: 22, proteinG: 1.1, fatG: 0.1, carbG: 5.1, saltEquivalentG: 0.0, fiberG: 2.2, sugarG: 2.9, saturatedFatG: 0.0, potassiumMg: 220, calciumMg: 18, ironMg: 0.3, vitaminCMg: 4 },
      unitGrams: { 個: 80, 本: 80 },
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
    keywords: ['アスパラガス', 'アスパラ'],
    entry: {
      per100g: { energyKcal: 22, proteinG: 2.6, fatG: 0.2, carbG: 3.9, saltEquivalentG: 0.0, fiberG: 1.8, sugarG: 1.7, saturatedFatG: 0.0, potassiumMg: 270, calciumMg: 19, ironMg: 0.7, vitaminCMg: 15 },
      unitGrams: { 本: 20 },
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
    keywords: ['セロリ', 'セルリー'],
    entry: {
      per100g: { energyKcal: 12, proteinG: 0.4, fatG: 0.1, carbG: 3.6, saltEquivalentG: 0.1, fiberG: 1.5, sugarG: 2.1, saturatedFatG: 0.0, potassiumMg: 410, calciumMg: 39, ironMg: 0.2, vitaminCMg: 7 },
      unitGrams: { 本: 100 },
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
    keywords: ['米', 'こめ', '白米', '精白米'],
    entry: {
      per100g: { energyKcal: 358, proteinG: 6.1, fatG: 0.9, carbG: 77.6, saltEquivalentG: 0.0, fiberG: 0.5, sugarG: 0.3, saturatedFatG: 0.3, potassiumMg: 89, calciumMg: 5, ironMg: 0.8, vitaminCMg: 0 },
      unitGrams: { 合: 150 },
    },
  },
  {
    keywords: ['うどん', 'ウドン', '饂飩'],
    entry: {
      per100g: { energyKcal: 105, proteinG: 2.6, fatG: 0.4, carbG: 24.2, saltEquivalentG: 0.3, fiberG: 0.8, sugarG: 0.4, saturatedFatG: 0.1, potassiumMg: 15, calciumMg: 8, ironMg: 0.2, vitaminCMg: 0 },
    },
  },
  {
    keywords: ['そば', 'ソバ', '蕎麦'],
    entry: {
      per100g: { energyKcal: 132, proteinG: 4.8, fatG: 0.7, carbG: 28.4, saltEquivalentG: 0.0, fiberG: 1.5, sugarG: 0.4, saturatedFatG: 0.2, potassiumMg: 37, calciumMg: 6, ironMg: 0.7, vitaminCMg: 0 },
    },
  },
  {
    keywords: ['パスタ', 'スパゲッティ', 'スパゲティ', 'ペンネ'],
    entry: {
      per100g: { energyKcal: 165, proteinG: 5.8, fatG: 0.9, carbG: 34.5, saltEquivalentG: 0.0, fiberG: 1.7, sugarG: 0.5, saturatedFatG: 0.2, potassiumMg: 65, calciumMg: 10, ironMg: 0.6, vitaminCMg: 0 },
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
    keywords: ['はちみつ', 'ハチミツ', '蜂蜜', 'honey'],
    entry: {
      per100g: { energyKcal: 329, proteinG: 0.2, fatG: 0.0, carbG: 81.9, saltEquivalentG: 0.0, fiberG: 0, sugarG: 81.9, saturatedFatG: 0.0, potassiumMg: 65, calciumMg: 2, ironMg: 0.2, vitaminCMg: 0 },
      oosajiG: 21, kosajiG: 7,
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
    keywords: ['ごま', 'ゴマ', '胡麻', '白ごま', '黒ごま'],
    entry: {
      per100g: { energyKcal: 605, proteinG: 20.3, fatG: 54.2, carbG: 16.5, saltEquivalentG: 0.0, fiberG: 12.6, sugarG: 0.4, saturatedFatG: 8.0, potassiumMg: 410, calciumMg: 1200, ironMg: 9.6, vitaminCMg: 0 },
      oosajiG: 9, kosajiG: 3,
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
