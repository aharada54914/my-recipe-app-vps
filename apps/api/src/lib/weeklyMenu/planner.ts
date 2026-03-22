import type { JsonValue } from '@prisma/client/runtime/library'
import type { DeviceType, EditableRecipeCategory, UserPreferences, WeeklyMenuProposalItem } from '@kitchen/shared-types'

export interface PlannerRecipeRecord {
  id: number
  title: string
  device: string
  category: string
  baseServings: number
  totalTimeMinutes: number
  ingredients: JsonValue
}

export interface PlannerForecastDay {
  date: string
  weatherText: string
  maxTempC: number
  precipitationMm: number
}

interface PlannerContext {
  requestedServings: number
  notes?: string
  preferences: UserPreferences
  stockNames: Set<string>
  recentRecipeIds: Set<number>
  favoriteRecipeIds: Set<number>
}

type ProteinGroup = 'chicken' | 'pork' | 'beef' | 'fish' | 'soy' | 'egg' | 'vegetable' | 'other'

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function toCategory(category: string): EditableRecipeCategory {
  if (category === '主菜' || category === '副菜' || category === 'スープ' || category === '一品料理' || category === 'スイーツ') {
    return category
  }
  return '一品料理'
}

function toDevice(device: string): DeviceType {
  if (device === 'hotcook' || device === 'healsio' || device === 'manual') {
    return device
  }
  return 'manual'
}

function extractIngredientNames(ingredients: JsonValue): string[] {
  if (!Array.isArray(ingredients)) return []
  return ingredients
    .map((item) => {
      if (typeof item !== 'object' || item == null || Array.isArray(item)) return ''
      const name = (item as { name?: unknown }).name
      return typeof name === 'string' ? name.trim() : ''
    })
    .filter((name) => name.length > 0)
}

function countStockMatches(recipe: PlannerRecipeRecord, stockNames: Set<string>): number {
  const ingredientNames = extractIngredientNames(recipe.ingredients)
  return ingredientNames.reduce((count, ingredient) => {
    const normalized = normalizeText(ingredient)
    return [...stockNames].some((stock) => normalizeText(stock).includes(normalized) || normalized.includes(normalizeText(stock)))
      ? count + 1
      : count
  }, 0)
}

function inferProteinGroup(recipe: PlannerRecipeRecord): ProteinGroup {
  const title = normalizeText(recipe.title)
  const ingredients = extractIngredientNames(recipe.ingredients).map(normalizeText)
  const haystack = [title, ...ingredients].join(' ')
  if (/鶏|チキン/.test(haystack)) return 'chicken'
  if (/豚|ポーク|ベーコン/.test(haystack)) return 'pork'
  if (/牛|ビーフ/.test(haystack)) return 'beef'
  if (/魚|鮭|さば|鯖|ぶり|たら|えび|海老|いか|帆立|ほたて/.test(haystack)) return 'fish'
  if (/豆腐|大豆|厚揚げ|油揚げ|納豆/.test(haystack)) return 'soy'
  if (/卵|たまご/.test(haystack)) return 'egg'
  if (/野菜|サラダ/.test(haystack)) return 'vegetable'
  return 'other'
}

function seasonScore(recipe: PlannerRecipeRecord): number {
  const month = new Date().getMonth() + 1
  const ingredientNames = extractIngredientNames(recipe.ingredients).join(' ')
  if ((month >= 3 && month <= 5) && /(春キャベツ|新玉ねぎ|たけのこ|菜の花)/.test(ingredientNames)) return 8
  if ((month >= 6 && month <= 8) && /(トマト|なす|ピーマン|オクラ|きゅうり)/.test(ingredientNames)) return 8
  if ((month >= 9 && month <= 11) && /(きのこ|さつまいも|かぼちゃ|鮭|れんこん)/.test(ingredientNames)) return 8
  if ((month === 12 || month <= 2) && /(白菜|大根|ねぎ|かぶ|鍋)/.test(`${recipe.title} ${ingredientNames}`)) return 8
  return 0
}

function weatherScore(recipe: PlannerRecipeRecord, forecast: PlannerForecastDay): number {
  const title = normalizeText(recipe.title)
  let score = 0
  const rainyOrCold = forecast.precipitationMm >= 3 || forecast.maxTempC <= 14 || /雨|雪/.test(forecast.weatherText)
  const warm = forecast.maxTempC >= 25

  if (rainyOrCold && /(煮|鍋|スープ|汁|カレー|シチュー|ポトフ|グラタン)/.test(title)) score += 10
  if (warm && /(蒸し|和え|サラダ|冷|そうめん|そば)/.test(title)) score += 8
  if (warm && /(鍋|シチュー|グラタン)/.test(title)) score -= 6
  if (rainyOrCold && toDevice(recipe.device) === 'hotcook') score += 4
  if (warm && toDevice(recipe.device) === 'manual') score += 3
  return score
}

function noteScore(recipe: PlannerRecipeRecord, notes?: string): number {
  if (!notes) return 0
  const normalizedNotes = normalizeText(notes)
  const normalizedTitle = normalizeText(recipe.title)

  let score = 0
  if (/節約|安く/.test(normalizedNotes) && /(鶏|豆腐|もやし|卵)/.test(normalizedTitle)) score += 6
  if (/軽め|さっぱり/.test(normalizedNotes) && /(蒸し|和え|サラダ|冷)/.test(normalizedTitle)) score += 6
  if (/時短|早く|手間少/.test(normalizedNotes)) {
    score += Math.max(0, 8 - Math.floor(recipe.totalTimeMinutes / 10))
  }
  if (/魚以外/.test(normalizedNotes) && /魚|鮭|さば|鯖|ぶり|えび|海老/.test(normalizedTitle)) score -= 20
  if (/揚げ物以外/.test(normalizedNotes) && /揚げ|フライ|唐揚げ/.test(normalizedTitle)) score -= 18
  return score
}

function costScore(recipe: PlannerRecipeRecord, preferences: UserPreferences): number {
  const normalized = normalizeText(recipe.title)
  if (preferences.weeklyMenuCostMode === 'saving') {
    if (/(牛|うなぎ|蟹|かに|いくら|帆立|ステーキ|ローストビーフ)/.test(normalized)) return -14
    if (/(鶏|豆腐|卵|もやし)/.test(normalized)) return 6
  }
  if (preferences.weeklyMenuCostMode === 'luxury') {
    if (/(牛|うなぎ|蟹|かに|いくら|帆立|ステーキ|ローストビーフ)/.test(normalized)) return 12
  }
  return 0
}

function buildDeviceTargets(recipes: PlannerRecipeRecord[]): Record<DeviceType, number> {
  const counts: Record<DeviceType, number> = { hotcook: 0, healsio: 0, manual: 0 }
  for (const recipe of recipes) {
    counts[toDevice(recipe.device)] += 1
  }

  const total = counts.hotcook + counts.healsio + counts.manual
  if (total === 0) return { hotcook: 0, healsio: 0, manual: 0 }

  const targets: Record<DeviceType, number> = {
    hotcook: Math.max(1, Math.round((counts.hotcook / total) * 7)),
    healsio: Math.max(1, Math.round((counts.healsio / total) * 7)),
    manual: Math.max(1, Math.round((counts.manual / total) * 7)),
  }

  while (targets.hotcook + targets.healsio + targets.manual > 7) {
    const device = [...(['manual', 'healsio', 'hotcook'] as const)]
      .sort((left, right) => targets[right] - targets[left])[0]
    targets[device] -= 1
  }
  while (targets.hotcook + targets.healsio + targets.manual < 7) {
    const device = [...(['hotcook', 'healsio', 'manual'] as const)]
      .sort((left, right) => counts[right] - counts[left])[0]
    targets[device] += 1
  }

  return targets
}

function buildReasonParts(params: {
  stockMatches: number
  weather: number
  season: number
  recentPenalty: number
  note: number
  cost: number
  favorite: number
  device: number
}): string[] {
  const parts: string[] = []
  if (params.stockMatches > 0) parts.push(`在庫一致${params.stockMatches}件`)
  if (params.weather > 0) parts.push('天気相性')
  if (params.season > 0) parts.push('旬寄り')
  if (params.note > 0) parts.push('メモ反映')
  if (params.cost > 0) parts.push('予算方針')
  if (params.favorite > 0) parts.push('お気に入り傾向')
  if (params.device > 0) parts.push('機器バランス')
  if (params.recentPenalty < 0) parts.push('直近重複を回避')
  return parts
}

function scoreMainRecipe(params: {
  recipe: PlannerRecipeRecord
  dayIndex: number
  forecast: PlannerForecastDay
  context: PlannerContext
  selectedRecipeIds: Set<number>
  selectedProteinGroups: ProteinGroup[]
  selectedDevices: DeviceType[]
  selectedCategories: EditableRecipeCategory[]
  deviceTargets: Record<DeviceType, number>
  excludeRecipeIds?: Set<number>
}): { score: number; reason: string } {
  const { recipe } = params
  if (params.excludeRecipeIds?.has(recipe.id)) {
    return { score: -1_000_000, reason: '除外候補' }
  }
  if (params.selectedRecipeIds.has(recipe.id)) {
    return { score: -1_000_000, reason: '同一レシピ回避' }
  }

  const category = toCategory(recipe.category)
  const device = toDevice(recipe.device)
  const stockMatches = countStockMatches(recipe, params.context.stockNames)
  const weather = weatherScore(recipe, params.forecast)
  const season = seasonScore(recipe)
  const note = noteScore(recipe, params.context.notes)
  const cost = costScore(recipe, params.context.preferences)
  const favorite = params.context.favoriteRecipeIds.has(recipe.id) ? 4 : 0
  const recentPenalty = params.context.recentRecipeIds.has(recipe.id) ? -16 : 0
  const proteinGroup = inferProteinGroup(recipe)
  const proteinPenalty = params.selectedProteinGroups.includes(proteinGroup) ? -10 : 0
  const categoryPenalty = params.selectedCategories.includes(category) ? -2 : 0
  const deviceCount = params.selectedDevices.filter((value) => value === device).length
  const deviceTarget = params.deviceTargets[device]
  const deviceBonus = deviceCount < deviceTarget ? 5 : -2

  let score = 0
  score += category === '主菜' ? 16 : 12
  score += weather
  score += season
  score += stockMatches * 3
  score += note
  score += cost
  score += favorite
  score += recentPenalty
  score += proteinPenalty
  score += categoryPenalty
  score += deviceBonus
  score += Math.max(0, 8 - Math.floor(recipe.totalTimeMinutes / 12))
  score -= params.dayIndex * 0.3

  const reasons = buildReasonParts({
    stockMatches,
    weather,
    season,
    recentPenalty,
    note,
    cost,
    favorite,
    device: deviceBonus,
  })

  return {
    score,
    reason: reasons.join(' / ') || 'バランス優先',
  }
}

function scoreSideRecipe(params: {
  recipe: PlannerRecipeRecord
  mainRecipe: PlannerRecipeRecord
  forecast: PlannerForecastDay
  usedSideRecipeIds: Set<number>
  usedSideCategories: EditableRecipeCategory[]
  requestedServings: number
}): number {
  if (params.usedSideRecipeIds.has(params.recipe.id)) return -1_000_000
  if (params.recipe.id === params.mainRecipe.id) return -1_000_000

  const category = toCategory(params.recipe.category)
  const title = normalizeText(params.recipe.title)
  let score = 0
  score += category === 'スープ' ? (params.forecast.precipitationMm >= 3 || params.forecast.maxTempC <= 14 ? 14 : 6) : 8
  score += params.usedSideCategories.includes(category) ? -4 : 3
  score += /(サラダ|和え|ひたし|ナムル)/.test(title) && params.forecast.maxTempC >= 23 ? 6 : 0
  score += /(スープ|汁|みそ汁|ポタージュ)/.test(title) && params.forecast.maxTempC <= 18 ? 8 : 0
  score += Math.max(0, 6 - Math.floor(params.recipe.totalTimeMinutes / 10))
  score += Math.abs(params.recipe.baseServings - params.requestedServings) <= 2 ? 2 : 0
  return score
}

export function buildWeeklyMenuProposalItems(params: {
  recipes: PlannerRecipeRecord[]
  forecastDays: PlannerForecastDay[]
  requestedServings: number
  preferences: UserPreferences
  stockNames: Set<string>
  recentRecipeIds: Set<number>
  favoriteRecipeIds: Set<number>
  notes?: string
  existingItems?: WeeklyMenuProposalItem[]
  replaceDayIndex?: number
}): WeeklyMenuProposalItem[] {
  const mains = params.recipes.filter((recipe) => {
    const category = toCategory(recipe.category)
    return category === '主菜' || category === '一品料理'
  })
  const sides = params.recipes.filter((recipe) => {
    const category = toCategory(recipe.category)
    return category === '副菜' || category === 'スープ'
  })

  const deviceTargets = buildDeviceTargets(mains)
  const selectedRecipeIds = new Set<number>()
  const selectedProteinGroups: ProteinGroup[] = []
  const selectedDevices: DeviceType[] = []
  const selectedCategories: EditableRecipeCategory[] = []
  const usedSideRecipeIds = new Set<number>()
  const usedSideCategories: EditableRecipeCategory[] = []
  const items: WeeklyMenuProposalItem[] = []

  for (let index = 0; index < params.forecastDays.length; index += 1) {
    const day = params.forecastDays[index]
    const preserveCurrent = params.existingItems && params.replaceDayIndex !== index

    if (preserveCurrent) {
      const existing = params.existingItems?.[index]
      if (existing) {
        items.push(existing)
        selectedRecipeIds.add(existing.recipeId)
        selectedProteinGroups.push(inferProteinGroup({
          id: existing.recipeId,
          title: existing.recipeTitle,
          device: existing.device,
          category: existing.category,
          baseServings: existing.baseServings,
          totalTimeMinutes: 30,
          ingredients: [],
        }))
        selectedDevices.push(existing.device)
        selectedCategories.push(existing.category)
        if (existing.sideRecipeId) {
          usedSideRecipeIds.add(existing.sideRecipeId)
          if (existing.sideCategory) usedSideCategories.push(existing.sideCategory)
        }
        continue
      }
    }

    const scoredMains = mains
      .map((recipe) => ({
        recipe,
        ...scoreMainRecipe({
          recipe,
          dayIndex: index,
          forecast: day,
          context: {
            requestedServings: params.requestedServings,
            notes: params.notes,
            preferences: params.preferences,
            stockNames: params.stockNames,
            recentRecipeIds: params.recentRecipeIds,
            favoriteRecipeIds: params.favoriteRecipeIds,
          },
          selectedRecipeIds,
          selectedProteinGroups,
          selectedDevices,
          selectedCategories,
          deviceTargets,
        }),
      }))
      .sort((left, right) => right.score - left.score)

    const bestMain = scoredMains[0]
    if (!bestMain) {
      throw new Error('週間献立に使える主菜候補がありません。')
    }

    selectedRecipeIds.add(bestMain.recipe.id)
    selectedProteinGroups.push(inferProteinGroup(bestMain.recipe))
    selectedDevices.push(toDevice(bestMain.recipe.device))
    selectedCategories.push(toCategory(bestMain.recipe.category))

    const bestSide = sides
      .map((recipe) => ({
        recipe,
        score: scoreSideRecipe({
          recipe,
          mainRecipe: bestMain.recipe,
          forecast: day,
          usedSideRecipeIds,
          usedSideCategories,
          requestedServings: params.requestedServings,
        }),
      }))
      .sort((left, right) => right.score - left.score)[0]

    if (bestSide && bestSide.score > 0) {
      usedSideRecipeIds.add(bestSide.recipe.id)
      usedSideCategories.push(toCategory(bestSide.recipe.category))
    }

    items.push({
      date: day.date,
      weatherText: day.weatherText,
      maxTempC: day.maxTempC,
      precipitationMm: day.precipitationMm,
      recipeId: bestMain.recipe.id,
      recipeTitle: bestMain.recipe.title,
      device: toDevice(bestMain.recipe.device),
      category: toCategory(bestMain.recipe.category),
      ...(bestSide && bestSide.score > 0 ? {
        sideRecipeId: bestSide.recipe.id,
        sideRecipeTitle: bestSide.recipe.title,
        sideDevice: toDevice(bestSide.recipe.device),
        sideCategory: toCategory(bestSide.recipe.category),
      } : {}),
      servings: params.requestedServings,
      baseServings: bestMain.recipe.baseServings,
      scoreSummary: bestMain.reason,
      ...(params.notes && params.replaceDayIndex === index ? { replacementNotes: params.notes } : {}),
    })
  }

  return items
}
