import type { ShoppingCategory, ShoppingListItem, SortedShoppingList } from '@kitchen/shared-types'
import { askGeminiClassification } from './geminiClassifier.js'

// Keyword-based classification rules for common Japanese ingredients
const CATEGORY_KEYWORDS: ReadonlyArray<{
  category: ShoppingCategory
  keywords: readonly string[]
}> = [
  {
    category: '野菜・果物',
    keywords: [
      'にんじん', '人参', 'じゃがいも', 'たまねぎ', '玉ねぎ', '玉葱',
      'ねぎ', '長ねぎ', 'キャベツ', 'レタス', 'トマト', 'きゅうり',
      'なす', 'ピーマン', 'ほうれん草', '小松菜', 'ブロッコリー',
      'もやし', '大根', 'かぼちゃ', 'さつまいも', 'ごぼう', 'れんこん',
      'しめじ', 'えのき', 'エリンギ', 'まいたけ', '椎茸', 'しいたけ',
      'りんご', 'バナナ', 'レモン', 'みかん', 'いちご',
      'にんにく', 'しょうが', '生姜', 'パセリ', 'バジル', '大葉',
      'アスパラ', 'ズッキーニ', 'セロリ', 'カリフラワー', 'みょうが',
      'オクラ', 'さやいんげん', 'スナップえんどう', '枝豆',
    ],
  },
  {
    category: '肉類',
    keywords: [
      '鶏肉', '鶏もも', '鶏むね', 'ささみ', '手羽先', '手羽元',
      '豚肉', '豚バラ', '豚ロース', '豚こま', '豚ひき肉',
      '牛肉', '牛バラ', '牛もも', '牛ひき肉', '合いびき肉',
      'ベーコン', 'ハム', 'ソーセージ', 'ウインナー',
      '鶏ひき肉', 'ひき肉', 'ミンチ', '肉',
    ],
  },
  {
    category: '魚介類',
    keywords: [
      '鮭', 'サーモン', 'まぐろ', 'ツナ', 'さば', 'さんま',
      'えび', 'いか', 'たこ', 'あさり', 'しじみ', 'ホタテ',
      'ちくわ', 'かまぼこ', 'はんぺん', 'さつま揚げ',
      'しらす', 'じゃこ', 'かつお', 'ぶり', 'たら', '鯛',
      '干しえび', 'ちりめんじゃこ', 'めんたいこ', 'たらこ',
    ],
  },
  {
    category: '乳製品・卵',
    keywords: [
      '卵', 'たまご', '牛乳', 'ミルク', 'チーズ', 'バター',
      'ヨーグルト', '生クリーム', 'クリームチーズ', 'マーガリン',
      'スライスチーズ', 'ピザ用チーズ', '粉チーズ', 'パルメザン',
    ],
  },
  {
    category: '調味料',
    keywords: [
      '醤油', 'しょうゆ', '味噌', 'みそ', '塩', '砂糖',
      '酢', 'みりん', '料理酒', '酒', 'ごま油', 'オリーブオイル',
      'サラダ油', 'マヨネーズ', 'ケチャップ', 'ソース',
      'だし', '顆粒だし', 'コンソメ', '鶏がらスープ',
      'めんつゆ', 'ポン酢', 'ドレッシング', 'こしょう', '胡椒',
      '片栗粉', '小麦粉', '薄力粉', 'パン粉', 'ごま',
      'カレー粉', 'カレールウ', 'シチュールウ',
      'ナンプラー', 'オイスターソース', '豆板醤', 'コチュジャン',
    ],
  },
  {
    category: '冷凍食品',
    keywords: [
      '冷凍', 'ミックスベジタブル', '冷凍うどん', '冷凍えび',
      '冷凍ブロッコリー', '冷凍コーン', 'アイス', '冷凍食品',
    ],
  },
  {
    category: '乾物・缶詰',
    keywords: [
      '缶詰', 'ツナ缶', 'トマト缶', 'コーン缶', 'さば缶',
      '乾燥わかめ', 'わかめ', '昆布', '海苔', 'のり',
      '春雨', 'ビーフン', 'マカロニ', 'パスタ', 'スパゲティ',
      '干し椎茸', '切り干し大根', 'ひじき', '高野豆腐',
      'そうめん', 'うどん', 'そば', 'ラーメン', '中華麺',
      '米', 'パン', '食パン',
    ],
  },
  {
    category: '豆腐・大豆製品',
    keywords: [
      '豆腐', '絹ごし', '木綿', '厚揚げ', '油揚げ',
      '納豆', '豆乳', 'おから', 'こんにゃく', 'しらたき',
    ],
  },
] as const

export function classifyByKeyword(ingredientName: string): ShoppingCategory | null {
  const normalized = ingredientName.toLowerCase().trim()

  for (const rule of CATEGORY_KEYWORDS) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword)) {
        return rule.category
      }
    }
  }

  return null
}

export async function classifyIngredient(ingredientName: string): Promise<ShoppingCategory> {
  // First try keyword match
  const keywordResult = classifyByKeyword(ingredientName)
  if (keywordResult) return keywordResult

  // Fallback to Gemini classification
  try {
    return await askGeminiClassification(ingredientName)
  } catch {
    return 'その他'
  }
}

// Category display order for shopping efficiency
const CATEGORY_ORDER: readonly ShoppingCategory[] = [
  '野菜・果物',
  '肉類',
  '魚介類',
  '豆腐・大豆製品',
  '乳製品・卵',
  '冷凍食品',
  '乾物・缶詰',
  '調味料',
  'その他',
] as const

export async function sortShoppingList(
  ingredients: ReadonlyArray<{ name: string; quantity: string }>,
  weekStartDate: string,
): Promise<SortedShoppingList> {
  // Classify all ingredients
  const classified: ShoppingListItem[] = await Promise.all(
    ingredients.map(async (item) => ({
      name: item.name,
      quantity: item.quantity,
      category: await classifyIngredient(item.name),
    })),
  )

  // Group by category in display order
  const categories = CATEGORY_ORDER
    .map(category => ({
      category,
      items: classified.filter(item => item.category === category),
    }))
    .filter(group => group.items.length > 0)

  return {
    weekStartDate,
    categories,
  }
}
