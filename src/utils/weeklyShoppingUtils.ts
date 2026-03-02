/**
 * Weekly Shopping List Aggregation
 *
 * Combines ingredients from multiple recipes and calculates missing items.
 */

import type { Recipe, StockItem, WeeklyMenu } from '../db/db'
import { adjustIngredients } from './recipeUtils'
import { formatShoppingDisplay } from './shoppingUnitConverter'

export interface AggregatedIngredient {
  name: string
  totalQuantity: number | string
  unit: string
  ingredientCategory: 'main' | 'sub'
  inStock: boolean
}

const STORE_SECTION_ORDER = [
  '青果（野菜・きのこ・果物）',
  '精肉・ハム',
  '鮮魚',
  '日配（豆腐・納豆・卵・乳製品）',
  '冷凍食品',
  '米・パン・麺',
  '調味料・乾物・缶詰',
  '飲料・その他',
] as const

type StoreSection = typeof STORE_SECTION_ORDER[number]

const STORE_SECTION_RULES: Array<{ section: StoreSection, keywords: string[] }> = [
  {
    section: '青果（野菜・きのこ・果物）',
    keywords: [
      'ねぎ', '玉ねぎ', 'たまねぎ', '長ねぎ', 'キャベツ', '白菜', '大根', '人参', 'にんじん', 'じゃがいも', 'さつまいも',
      'なす', 'トマト', 'ミニトマト', 'きゅうり', 'ピーマン', 'パプリカ', 'ブロッコリー', 'ほうれん草', '小松菜', 'レタス',
      'もやし', 'しめじ', 'えのき', '舞茸', 'まいたけ', '椎茸', 'しいたけ', 'きのこ', 'しょうが', '生姜', 'にんにく',
      'りんご', 'バナナ', 'みかん', 'レモン', 'いちご', 'キウイ', '果物', 'アボカド', 'ぶどう', 'オレンジ',
    ],
  },
  { section: '精肉・ハム', keywords: ['牛肉', '豚肉', '鶏肉', 'ひき肉', 'ひきにく', 'もも肉', 'むね肉', '手羽', 'ベーコン', 'ハム', 'ソーセージ', 'ウインナー'] },
  { section: '鮮魚', keywords: ['鮭', 'さば', '鯖', 'いわし', 'まぐろ', 'かつお', 'ぶり', 'えび', '海老', 'いか', 'たこ', '貝', 'しらす', '魚'] },
  {
    section: '日配（豆腐・納豆・卵・乳製品）',
    keywords: ['豆腐', '厚揚げ', '油揚げ', '納豆', '卵', 'たまご', 'がんも', '牛乳', 'チーズ', 'バター', 'ヨーグルト', '生クリーム'],
  },
  { section: '冷凍食品', keywords: ['冷凍'] },
  { section: '米・パン・麺', keywords: ['米', 'ごはん', 'パン', '食パン', 'うどん', 'そば', 'パスタ', '麺', '小麦粉', '片栗粉', '春雨'] },
  {
    section: '調味料・乾物・缶詰',
    keywords: [
      '塩', '砂糖', '醤油', 'しょうゆ', 'みりん', '酒', '料理酒', '酢', '味噌', 'みそ', 'だし', 'コンソメ', 'オイスター',
      'ごま油', 'サラダ油', 'オリーブオイル', '胡椒', 'こしょう', 'カレー粉', '海苔', 'のり', '乾燥', '缶', 'わかめ', 'ひじき',
    ],
  },
]

const NORMALIZE_MAP: Record<string, string> = {
  'ヶ': 'ケ',
  'ヵ': 'カ',
}

function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[()[\]（）［］【】「」『』]/g, '')
    .replace(/[ヶヵ]/g, (char) => NORMALIZE_MAP[char] ?? char)
}

function classifyStoreSection(name: string): StoreSection {
  const normalized = normalizeIngredientName(name)
  for (const rule of STORE_SECTION_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(normalizeIngredientName(keyword)))) {
      return rule.section
    }
  }
  return '飲料・その他'
}

function formatItemLine(item: AggregatedIngredient): string {
  const qty = item.totalQuantity === '適量' || item.unit === '適量'
    ? '適量'
    : formatShoppingDisplay(item.name, item.totalQuantity, item.unit)
  return `・${item.name} ${qty}`
}

function normalizeServings(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(10, Math.max(1, Math.round(value)))
}

function scaleRecipeIngredients(recipe: Recipe, targetServings: number): Recipe {
  return {
    ...recipe,
    ingredients: adjustIngredients(recipe.ingredients, recipe.baseServings, targetServings),
  }
}

/**
 * Build recipe list for weekly shopping based on per-menu serving decisions.
 */
export function buildWeeklyMenuRecipesWithServings(
  menu: WeeklyMenu,
  recipeMap: Map<number, Recipe>
): Recipe[] {
  const output: Recipe[] = []

  for (const item of menu.items) {
    const main = recipeMap.get(item.recipeId)
    if (main) {
      output.push(scaleRecipeIngredients(main, normalizeServings(item.mainServings, main.baseServings)))
    }

    if (item.sideRecipeId != null) {
      const side = recipeMap.get(item.sideRecipeId)
      if (side) {
        output.push(scaleRecipeIngredients(side, normalizeServings(item.sideServings, side.baseServings)))
      }
    }
  }

  return output
}

export function filterBySeasoningOption(
  ingredients: AggregatedIngredient[],
  includeSeasonings: boolean
): AggregatedIngredient[] {
  if (includeSeasonings) return ingredients
  return ingredients.filter((i) => i.ingredientCategory === 'main')
}

/**
 * Aggregate ingredients from multiple recipes.
 * Same name + same unit → merge quantities.
 * 適量 items are not aggregated, shown once only.
 */
export function aggregateIngredients(
  recipes: Recipe[],
  stockItems: StockItem[]
): AggregatedIngredient[] {
  const stockNames = new Set(stockItems.filter(s => s.inStock).map(s => s.name))
  const map = new Map<string, AggregatedIngredient>()

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const key = `${ing.name}__${ing.unit}`

      if (ing.quantity === '適量' || ing.unit === '適量') {
        // Don't aggregate 適量 — just mark presence
        if (!map.has(key)) {
          map.set(key, {
            name: ing.name,
            totalQuantity: '適量',
            unit: '適量',
            ingredientCategory: ing.category,
            inStock: stockNames.has(ing.name),
          })
        }
        continue
      }

      const existing = map.get(key)
      if (existing) {
        if (typeof existing.totalQuantity === 'number' && typeof ing.quantity === 'number') {
          existing.totalQuantity += ing.quantity
        }
      } else {
        map.set(key, {
          name: ing.name,
          totalQuantity: ing.quantity,
          unit: ing.unit,
          ingredientCategory: ing.category,
          inStock: stockNames.has(ing.name),
        })
      }
    }
  }

  // Sort: main ingredients first, then sub; within each group, not-in-stock first
  return Array.from(map.values()).sort((a, b) => {
    // Main before sub
    if (a.ingredientCategory !== b.ingredientCategory) {
      return a.ingredientCategory === 'main' ? -1 : 1
    }
    // Not in stock before in stock
    if (a.inStock !== b.inStock) {
      return a.inStock ? 1 : -1
    }
    return 0
  })
}

/**
 * Get only the missing (not in stock) ingredients.
 */
export function getMissingWeeklyIngredients(
  recipes: Recipe[],
  stockItems: StockItem[]
): AggregatedIngredient[] {
  return aggregateIngredients(recipes, stockItems).filter(ing => !ing.inStock)
}

/**
 * Format aggregated shopping list for LINE sharing.
 */
export function formatWeeklyShoppingList(
  weekStart: string,
  ingredients: AggregatedIngredient[]
): string {
  const missing = ingredients.filter(ing => !ing.inStock)

  if (missing.length === 0) {
    return `${weekStart}〜 の週間献立\n全ての材料が揃っています！`
  }

  const mainItems = missing.filter(i => i.ingredientCategory === 'main')
  const subItems = missing.filter(i => i.ingredientCategory === 'sub')

  let text = `${weekStart}〜 買い物リスト\n`
  text += `─────────────\n`

  if (mainItems.length > 0) {
    text += `【主材料】\n`
    for (const item of mainItems) {
      const qty = item.totalQuantity === '適量' || item.unit === '適量'
        ? '適量'
        : formatShoppingDisplay(item.name, item.totalQuantity, item.unit)
      text += `・${item.name} ${qty}\n`
    }
  }

  if (subItems.length > 0) {
    text += `【調味料・その他】\n`
    for (const item of subItems) {
      const qty = item.totalQuantity === '適量' || item.unit === '適量'
        ? '適量'
        : formatShoppingDisplay(item.name, item.totalQuantity, item.unit)
      text += `・${item.name} ${qty}\n`
    }
  }

  return text.trimEnd()
}

/**
 * Format shopping list by common supermarket sections for Google Calendar registration.
 */
export function formatWeeklyShoppingListByStoreSection(
  weekStart: string,
  ingredients: AggregatedIngredient[]
): string {
  const missing = ingredients.filter((ing) => !ing.inStock)
  if (missing.length === 0) {
    return `${weekStart}〜 の週間献立\n全ての材料が揃っています！`
  }

  const grouped = new Map<StoreSection, AggregatedIngredient[]>()
  for (const item of missing) {
    const section = classifyStoreSection(item.name)
    const list = grouped.get(section) ?? []
    list.push(item)
    grouped.set(section, list)
  }

  let text = `${weekStart}〜 買い物リスト（売場順）\n─────────────\n`
  for (const section of STORE_SECTION_ORDER) {
    const items = grouped.get(section)
    if (!items || items.length === 0) continue

    text += `【${section}】\n`
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name, 'ja'))) {
      text += `${formatItemLine(item)}\n`
    }
  }

  return text.trimEnd()
}
