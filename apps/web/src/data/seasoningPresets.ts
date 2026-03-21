export interface SeasoningItem {
  name: string
  unit: '本' | '袋' | '個'
  category: '調味料'
}

export interface SeasoningPreset {
  id: string
  label: string
  description: string
  items: SeasoningItem[]
}

export const SEASONING_MASTER: SeasoningItem[] = [
  { name: '塩', unit: '袋', category: '調味料' },
  { name: 'こしょう', unit: '袋', category: '調味料' },
  { name: 'しょうゆ', unit: '本', category: '調味料' },
  { name: '砂糖', unit: '袋', category: '調味料' },
  { name: '酒', unit: '本', category: '調味料' },
  { name: 'みりん', unit: '本', category: '調味料' },
  { name: '酢', unit: '本', category: '調味料' },
  { name: 'みそ', unit: '個', category: '調味料' },
  { name: 'めんつゆ', unit: '本', category: '調味料' },
  { name: '白だし', unit: '本', category: '調味料' },
  { name: '和風だしの素', unit: '袋', category: '調味料' },
  { name: '鶏がらスープの素', unit: '袋', category: '調味料' },
  { name: 'コンソメ', unit: '個', category: '調味料' },
  { name: 'サラダ油', unit: '本', category: '調味料' },
  { name: 'ごま油', unit: '本', category: '調味料' },
  { name: 'オリーブオイル', unit: '本', category: '調味料' },
  { name: 'マヨネーズ', unit: '本', category: '調味料' },
  { name: 'ケチャップ', unit: '本', category: '調味料' },
  { name: 'ソース', unit: '本', category: '調味料' },
  { name: 'ポン酢', unit: '本', category: '調味料' },
  { name: '片栗粉', unit: '袋', category: '調味料' },
  { name: '薄力粉', unit: '袋', category: '調味料' },
  { name: '小麦粉', unit: '袋', category: '調味料' },
  { name: '豆板醤', unit: '個', category: '調味料' },
  { name: 'コチュジャン', unit: '個', category: '調味料' },
  { name: 'オイスターソース', unit: '本', category: '調味料' },
  { name: 'カレー粉', unit: '袋', category: '調味料' },
  { name: '七味とうがらし', unit: '袋', category: '調味料' },
]

const BASIC_JAPANESE_SET = [
  '塩',
  'こしょう',
  'しょうゆ',
  '砂糖',
  '酒',
  'みりん',
  '酢',
  'みそ',
  'めんつゆ',
  '和風だしの素',
  'サラダ油',
  'ごま油',
]

const STANDARD_ADDON_SET = [
  'マヨネーズ',
  'ケチャップ',
  'ソース',
  'ポン酢',
  '片栗粉',
  '薄力粉',
  '鶏がらスープの素',
  'コンソメ',
  '白だし',
]

const CHUKA_YOSHOKU_ADDON_SET = [
  'オリーブオイル',
  'オイスターソース',
  '豆板醤',
  'コチュジャン',
  'カレー粉',
  '七味とうがらし',
]

function pickItems(names: string[]): SeasoningItem[] {
  const picked: SeasoningItem[] = []
  for (const name of names) {
    const item = SEASONING_MASTER.find((entry) => entry.name === name)
    if (item) picked.push(item)
  }
  return picked
}

export const SEASONING_PRESETS: SeasoningPreset[] = [
  {
    id: 'basic-japanese',
    label: '基本和食セット',
    description: 'まず最初に入れる定番12品',
    items: pickItems(BASIC_JAPANESE_SET),
  },
  {
    id: 'standard-addon',
    label: '定番追加セット',
    description: 'よく使う調味料・粉類を追加',
    items: pickItems(STANDARD_ADDON_SET),
  },
  {
    id: 'chuka-yoshoku-addon',
    label: '中華/洋風追加',
    description: '中華・洋風レシピ向けを追加',
    items: pickItems(CHUKA_YOSHOKU_ADDON_SET),
  },
  {
    id: 'all-seasonings',
    label: '全部まとめて',
    description: '日本の家庭で使いやすい調味料を一括登録',
    items: [...SEASONING_MASTER],
  },
]
