import type { Recipe } from '../db/db'
import type {
  BalanceColor,
  ColorSignals,
  CuisineGenre,
  MealBalanceInference,
  NutritionLevel,
  PrimaryIngredientTag,
} from './mealBalanceTypes'

const GENRE_KEYWORDS: Record<Exclude<CuisineGenre, 'other'>, string[]> = {
  japanese: ['醤油', 'しょうゆ', '味噌', 'みそ', 'だし', 'みりん', '和風', '照り', '煮', '酒', 'かつお', '昆布', '梅', '大根おろし', '白だし', 'めんつゆ'],
  western: ['トマト', 'チーズ', 'オリーブ', 'パスタ', '洋風', 'グラタン', 'シチュー', 'バター', 'ワイン', 'コンソメ', 'ベーコン', 'パン粉', '牛乳'],
  chinese: ['豆板醤', 'オイスター', '中華', '麻婆', 'ごま油', '鶏ガラスープ', 'オイスターソース', '甜麺醤', '八角', 'ラー油'],
}

const HEAVY_KEYWORDS = ['豚', '牛', '鶏', '肉', '揚げ', 'マヨネーズ', 'チーズ', 'バラ', 'ひき肉', 'カルビ', 'ベーコン', 'ウインナー', 'ソーセージ']

const NUTRITION_KEYWORDS = {
  protein: ['豚', '牛', '鶏', '肉', '魚', '鮭', 'さば', 'まぐろ', 'いわし', 'えび', 'いか', '卵', 'たまご', '豆腐', '納豆', '厚揚げ', '大豆'],
  vegetable: ['キャベツ', '白菜', '大根', '人参', 'にんじん', '玉ねぎ', 'ねぎ', 'ほうれん草', '小松菜', 'レタス', 'ピーマン', 'パプリカ', 'ブロッコリー', 'なす', 'きのこ', 'しめじ', 'えのき'],
  carb: ['ご飯', '米', 'もち', 'パン', '食パン', 'うどん', 'そば', 'ラーメン', 'パスタ', '麺', 'じゃがいも', 'さつまいも', '小麦粉'],
  fat: ['揚げ', 'フライ', '天ぷら', 'バター', 'マヨネーズ', 'チーズ', '生クリーム', 'ベーコン', 'バラ肉', '油', 'ごま油'],
  soupLike: ['汁', 'スープ', 'みそ汁', '味噌汁', 'ポタージュ', 'シチュー'],
} as const

const COLOR_KEYWORDS: Record<BalanceColor, string[]> = {
  red: ['トマト', '人参', 'にんじん', '赤', 'パプリカ', 'えび', '鮭', 'キムチ'],
  green: ['ほうれん草', '小松菜', 'ブロッコリー', 'ピーマン', 'ねぎ', 'レタス', 'いんげん', '青菜', '緑'],
  yellow: ['卵', 'たまご', 'かぼちゃ', 'コーン', '黄', 'チーズ'],
  white: ['大根', '白菜', '豆腐', 'きのこ', 'しめじ', 'えのき', '白', 'もやし', 'じゃがいも'],
  black: ['ひじき', '海苔', 'のり', 'きくらげ', '黒', '黒ごま', 'ごま'],
}

const PRIMARY_INGREDIENT_KEYWORDS: Record<PrimaryIngredientTag, string[]> = {
  chicken: ['鶏', '鶏肉', 'もも肉', 'むね肉', 'ささみ'],
  pork: ['豚', '豚肉', 'バラ', 'ロース', 'ひき肉'],
  beef: ['牛', '牛肉', 'カルビ', 'すじ'],
  fish: ['魚', '鮭', 'さば', 'まぐろ', 'いわし', 'かつお', 'ぶり', 'えび', 'いか', 'たこ'],
  egg: ['卵', 'たまご'],
  soy: ['豆腐', '納豆', '厚揚げ', '油揚げ', '大豆'],
  rice: ['ご飯', '米', '丼', 'チャーハン', 'リゾット'],
  noodle: ['うどん', 'そば', 'ラーメン', 'パスタ', '麺'],
}

function clampLevel(value: number): NutritionLevel {
  if (value <= 0) return 0
  if (value === 1) return 1
  return 2
}

function buildRecipeText(recipe: Recipe): string {
  return `${recipe.title} ${recipe.ingredients.map((i) => i.name).join(' ')}`
}

function countKeywordHits(text: string, keywords: readonly string[]): number {
  let hits = 0
  for (const keyword of keywords) {
    if (text.includes(keyword)) hits += 1
  }
  return hits
}

function inferCuisineGenre(text: string): CuisineGenre {
  const jpScore = countKeywordHits(text, GENRE_KEYWORDS.japanese)
  const wsScore = countKeywordHits(text, GENRE_KEYWORDS.western)
  const cnScore = countKeywordHits(text, GENRE_KEYWORDS.chinese)

  if (jpScore > wsScore && jpScore > cnScore) return 'japanese'
  if (wsScore > jpScore && wsScore > cnScore) return 'western'
  if (cnScore > jpScore && cnScore > wsScore) return 'chinese'
  return 'other'
}

function inferPrimaryIngredients(text: string): PrimaryIngredientTag[] {
  const counts: Array<{ tag: PrimaryIngredientTag, count: number }> = []

  for (const [tag, keywords] of Object.entries(PRIMARY_INGREDIENT_KEYWORDS) as Array<[PrimaryIngredientTag, string[]]>) {
    const count = countKeywordHits(text, keywords)
    if (count > 0) counts.push({ tag, count })
  }

  return counts
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((entry) => entry.tag)
}

function inferColorSignals(text: string): ColorSignals {
  return {
    red: clampLevel(countKeywordHits(text, COLOR_KEYWORDS.red)),
    green: clampLevel(countKeywordHits(text, COLOR_KEYWORDS.green)),
    yellow: clampLevel(countKeywordHits(text, COLOR_KEYWORDS.yellow)),
    white: clampLevel(countKeywordHits(text, COLOR_KEYWORDS.white)),
    black: clampLevel(countKeywordHits(text, COLOR_KEYWORDS.black)),
  }
}

function inferDominantColors(colors: ColorSignals): BalanceColor[] {
  const max = Math.max(colors.red, colors.green, colors.yellow, colors.white, colors.black)
  if (max === 0) return []
  return (Object.keys(colors) as BalanceColor[]).filter((color) => colors[color] === max)
}

export function inferMealBalance(recipe: Recipe): MealBalanceInference {
  const text = buildRecipeText(recipe)
  const colors = inferColorSignals(text)

  const soupBoost = recipe.category === 'スープ' ? 1 : 0

  return {
    nutrition: {
      protein: clampLevel(countKeywordHits(text, NUTRITION_KEYWORDS.protein)),
      vegetable: clampLevel(countKeywordHits(text, NUTRITION_KEYWORDS.vegetable)),
      carb: clampLevel(countKeywordHits(text, NUTRITION_KEYWORDS.carb)),
      fat: clampLevel(countKeywordHits(text, NUTRITION_KEYWORDS.fat)),
      soupLike: clampLevel(countKeywordHits(text, NUTRITION_KEYWORDS.soupLike) + soupBoost),
    },
    colors,
    dominantColors: inferDominantColors(colors),
    primaryIngredients: inferPrimaryIngredients(text),
    genre: inferCuisineGenre(text),
    isHeavy: HEAVY_KEYWORDS.some((keyword) => text.includes(keyword)),
  }
}
