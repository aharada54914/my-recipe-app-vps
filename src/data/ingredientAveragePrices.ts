export type PriceSourceId = 'soumu-retail-tokyo' | 'maff-open-data' | 'tokyo-wholesale'

export interface IngredientAveragePrice {
  normalizedName: string
  unitBasis: 'g' | 'ml' | 'piece'
  tokyoAvgPrice: number
  sourceId: PriceSourceId
  sourceUrl: string
  updatedAt: string
  confidence: number
}

export const TOKYO_PRICE_SOURCES: Array<{ id: PriceSourceId, label: string, url: string }> = [
  {
    id: 'soumu-retail-tokyo',
    label: '総務省統計局 小売物価統計調査（東京都区部）',
    url: 'https://www.stat.go.jp/data/kouri/index.html',
  },
  {
    id: 'maff-open-data',
    label: '農林水産省 公的オープンデータ',
    url: 'https://www.maff.go.jp/j/tokei/',
  },
  {
    id: 'tokyo-wholesale',
    label: '東京都中央卸売市場 統計情報',
    url: 'https://www.shijou-tokei.metro.tokyo.lg.jp/',
  },
]

export const TOKYO_INGREDIENT_PRICE_SEED: IngredientAveragePrice[] = [
  { normalizedName: '鶏もも肉', unitBasis: 'g', tokyoAvgPrice: 1.8, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.91 },
  { normalizedName: '豚こま切れ肉', unitBasis: 'g', tokyoAvgPrice: 1.6, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.9 },
  { normalizedName: '牛こま切れ肉', unitBasis: 'g', tokyoAvgPrice: 3.8, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.89 },
  { normalizedName: '玉ねぎ', unitBasis: 'g', tokyoAvgPrice: 0.5, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.93 },
  { normalizedName: 'じゃがいも', unitBasis: 'g', tokyoAvgPrice: 0.45, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.92 },
  { normalizedName: 'にんじん', unitBasis: 'g', tokyoAvgPrice: 0.55, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.92 },
  { normalizedName: 'キャベツ', unitBasis: 'g', tokyoAvgPrice: 0.4, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.89 },
  { normalizedName: '卵', unitBasis: 'piece', tokyoAvgPrice: 28, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.95 },
  { normalizedName: '豆腐', unitBasis: 'piece', tokyoAvgPrice: 65, sourceId: 'soumu-retail-tokyo', sourceUrl: TOKYO_PRICE_SOURCES[0].url, updatedAt: '2026-03-01', confidence: 0.87 },
]

export const INGREDIENT_SYNONYMS: Record<string, string> = {
  鶏腿肉: '鶏もも肉',
  鶏モモ肉: '鶏もも肉',
  たまねぎ: '玉ねぎ',
  玉葱: '玉ねぎ',
}
