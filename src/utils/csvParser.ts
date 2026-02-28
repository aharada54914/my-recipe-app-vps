import type { Recipe, Ingredient, CookingStep, DeviceType, RecipeCategory } from '../db/db'
import { db } from '../db/db'
import { INGREDIENT_UNIT_WEIGHT_G, UNKNOWN_UNIT_FALLBACK_WEIGHT_G } from '../constants/recipeConstants'

// --- RFC4180 CSV Parser (multiline-safe) ---

export function parseCSV(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let inQuotes = false

    // Normalize line endings
    const chars = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < chars.length && chars[i + 1] === '"') {
                    field += '"'
                    i++ // skip escaped quote
                } else {
                    inQuotes = false
                }
            } else {
                field += ch
            }
        } else {
            if (ch === '"') {
                inQuotes = true
            } else if (ch === ',') {
                row.push(field)
                field = ''
            } else if (ch === '\n') {
                row.push(field)
                field = ''
                rows.push(row)
                row = []
            } else {
                field += ch
            }
        }
    }

    // Last field
    if (field || row.length > 0) {
        row.push(field)
        rows.push(row)
    }

    return rows
}

// --- Ingredient parser ---

export function parseIngredientLine(line: string): Ingredient | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    // Pattern: "食材名: 量" or "食材名(メモ): 量"
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) return null

    const rawName = trimmed.slice(0, colonIdx).trim()
    const rawQty = trimmed.slice(colonIdx + 1).trim()

    // Clean name: remove [a], [b] suffixes and (parenthetical memo)
    const name = rawName.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim()
    if (!name) return null

    // Determine category: seasoning/sauce → sub, else main
    const subKeywords = [
        '醤油', 'しょうゆ', '塩', '砂糖', '味噌', 'みそ', '酒', 'みりん',
        '酢', 'ソース', 'ケチャップ', 'マヨネーズ', 'だし', '顆粒',
        'コンソメ', 'バター', '油', 'オリーブ', 'ごま油', 'サラダ油',
        'こしょう', 'コショウ', '片栗粉', '薄力粉', '小麦粉',
        'バニラ', 'ココア', 'パン粉', '水', '牛乳',
    ]
    const isSubIngredient = subKeywords.some((kw) => name.includes(kw))
    const category = isSubIngredient ? 'sub' as const : 'main' as const

    // Parse quantity
    if (!rawQty || rawQty === '適量' || rawQty === '少々') {
        return { name, quantity: 0, unit: '適量', category }
    }

    // Try to extract numeric quantity and unit
    const { quantity, unit } = parseQuantityUnit(rawQty)
    return { name, quantity, unit, category }
}

function parseQuantityUnit(raw: string): { quantity: number; unit: string } {
    // Handle fractional notation: "1/2個", "大さじ1/2"
    const spoonMatch = raw.match(/^(大さじ|小さじ)([\d/]+(?:\s*と\s*[\d/]+)?)$/)
    if (spoonMatch) {
        return { quantity: parseFraction(spoonMatch[2]), unit: spoonMatch[1] }
    }

    // General pattern: number + unit
    const numMatch = raw.match(/^([\d./]+)\s*(.*)$/)
    if (numMatch) {
        const qty = parseFraction(numMatch[1])
        const unit = numMatch[2].replace(/\(.*?\)/g, '').trim() || 'g'
        return { quantity: qty, unit }
    }

    // Try to find number anywhere
    const anyNum = raw.match(/([\d.]+)/)
    if (anyNum) {
        const unit = raw.replace(anyNum[0], '').replace(/\(.*?\)/g, '').trim() || '個'
        return { quantity: parseFloat(anyNum[1]), unit }
    }

    return { quantity: 0, unit: '適量' }
}

function parseFraction(s: string): number {
    // Handle "1と1/2" pattern
    if (s.includes('と')) {
        const parts = s.split('と')
        return parseFraction(parts[0].trim()) + parseFraction(parts[1].trim())
    }
    if (s.includes('/')) {
        const [num, den] = s.split('/')
        return parseFloat(num) / parseFloat(den)
    }
    return parseFloat(s) || 0
}

// --- Raw steps parser ---

export function parseRawSteps(stepsText: string): string[] {
    if (!stepsText.trim()) return []
    return stepsText
        .split('\n')
        .map((line) => line.replace(/^\d+\s*/, '').trim())
        .filter((line) => line.length > 0)
}

// --- Cooking time parser ---

function parseCookingTimeMinutes(timeStr: string): number {
    if (!timeStr) return 30 // default

    // "22分", "1時間30分", "約45分"
    const cleaned = timeStr.replace(/約/g, '').trim()
    const hourMatch = cleaned.match(/(\d+)\s*時間/)
    const minMatch = cleaned.match(/(\d+)\s*分/)

    let minutes = 0
    if (hourMatch) minutes += parseInt(hourMatch[1]) * 60
    if (minMatch) minutes += parseInt(minMatch[1])

    return minutes > 0 ? minutes : 30
}

// --- CookingStep estimator ---

export function estimateCookingSteps(
    device: DeviceType,
    cookingTimeStr: string,
    ingredientCount: number,
): CookingStep[] {
    const deviceTimeMinutes = parseCookingTimeMinutes(cookingTimeStr)

    // Prep time: ingredientCount × 1.5min, clamped [5, 20]
    const prepMinutes = Math.max(5, Math.min(20, Math.round(ingredientCount * 1.5)))

    // Plating time: fixed 3 min
    const plateMinutes = 3

    // Device cooking time = total - prep - plate (minimum 5 min)
    const cookMinutes = Math.max(5, deviceTimeMinutes - prepMinutes - plateMinutes)

    const deviceLabel = device === 'hotcook' ? 'ホットクック調理'
        : device === 'healsio' ? 'ヘルシオ調理'
            : '調理'

    return [
        { name: '下ごしらえ', durationMinutes: prepMinutes },
        { name: deviceLabel, durationMinutes: cookMinutes, isDeviceStep: device !== 'manual' },
        { name: '盛り付け', durationMinutes: plateMinutes },
    ]
}

// --- Category guesser ---

function guessCategory(title: string): RecipeCategory {
    const categoryMap: [string[], RecipeCategory][] = [
        [['スープ', 'みそ汁', '味噌汁', 'シチュー', 'ポタージュ', '汁'], 'スープ'],
        [['ご飯', 'ピラフ', 'リゾット', 'チャーハン', 'おにぎり', 'パスタ', 'うどん', 'そば', 'ラーメン'], '一品料理'],
        [['ケーキ', 'クッキー', 'プリン', 'ゼリー', 'アイス', 'チョコ', 'マフィン', 'パン', 'ヨーグルト', 'スイーツ', 'ジャム', 'コンポート', 'あんこ', '甘酒', 'おしるこ', 'メレンゲ'], 'スイーツ'],
        [['サラダ', 'ナムル', 'きんぴら', '漬', 'マリネ', 'おひたし', '和え', 'ピクルス'], '副菜'],
    ]

    for (const [keywords, cat] of categoryMap) {
        if (keywords.some((kw) => title.includes(kw))) return cat
    }
    return '主菜'
}

// --- Generate unique recipe number ---

function generateCsvRecipeNumber(device: DeviceType, index: number): string {
    const prefix = device === 'hotcook' ? 'HC' : device === 'healsio' ? 'HS' : 'MN'
    return `${prefix}-${String(index + 1).padStart(3, '0')}`
}

function normalizeHeaderName(value: string): string {
    return value.replace(/\s+/g, '').trim()
}

function buildHeaderLookup(header: string[]): Map<string, number> {
    const map = new Map<string, number>()
    for (let i = 0; i < header.length; i++) {
        const normalized = normalizeHeaderName(header[i] ?? '')
        if (!normalized) continue
        map.set(normalized, i)
    }
    return map
}

function getCellByHeader(row: string[], headerLookup: Map<string, number>, names: string[], fallbackIndex?: number): string {
    for (const name of names) {
        const idx = headerLookup.get(normalizeHeaderName(name))
        if (typeof idx === 'number' && row[idx] != null) return row[idx]
    }
    if (typeof fallbackIndex === 'number') return row[fallbackIndex] ?? ''
    return ''
}

function normalizeNumberText(raw: string): string {
    return raw
        .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/，/g, ',')
        .replace(/．/g, '.')
}

export function parseNumberFromText(raw: string): number | undefined {
    const normalized = normalizeNumberText(raw)
    const match = normalized.match(/(\d+(?:\.\d+)?)/)
    if (!match) return undefined
    const value = Number.parseFloat(match[1].replace(/,/g, ''))
    return Number.isFinite(value) ? value : undefined
}

export function buildNutritionPerServing(
    caloriesText: string,
    saltText: string,
    totalWeightG: number,
    baseServings: number,
): Recipe['nutritionPerServing'] | undefined {
    const energyKcal = parseNumberFromText(caloriesText)
    const saltValue = parseNumberFromText(saltText)
    const hasMg = /mg/i.test(normalizeNumberText(saltText))
    const servingSizeG = Number.isFinite(totalWeightG) && Number.isFinite(baseServings) && baseServings > 0
        ? Math.round((totalWeightG / baseServings) * 10) / 10
        : undefined

    const nutrition: Recipe['nutritionPerServing'] = {}
    if (typeof servingSizeG === 'number') nutrition.servingSizeG = servingSizeG
    if (typeof energyKcal === 'number') nutrition.energyKcal = energyKcal
    if (typeof saltValue === 'number') {
        if (hasMg) nutrition.sodiumMg = saltValue
        else nutrition.saltEquivalentG = saltValue
    }

    const keys = Object.keys(nutrition)
    return keys.length > 0 ? nutrition : undefined
}

function buildNutritionPerServingFromRow(
    row: string[],
    headerLookup: Map<string, number>,
    totalWeightG: number,
    baseServings: number,
    fallbackCaloriesText: string,
    fallbackSaltText: string,
): Recipe['nutritionPerServing'] | undefined {
    const base = buildNutritionPerServing(fallbackCaloriesText, fallbackSaltText, totalWeightG, baseServings) ?? {}
    const pick = (names: string[]) => parseNumberFromText(getCellByHeader(row, headerLookup, names))

    const servingSizeFromColumn = pick(['1人分重量(g)', '一人分重量(g)', '1人分重量', '一人分重量', 'servingsizeg'])
    const energyFromColumn = pick(['カロリー', 'エネルギー', 'kcal', 'energykcal'])
    const protein = pick(['たんぱく質', 'タンパク質', 'protein', 'proteing'])
    const fat = pick(['脂質', 'fat', 'fatg'])
    const carb = pick(['炭水化物', '糖質+食物繊維', 'carb', 'carbg'])
    const sodiumMg = pick(['ナトリウム(mg)', 'ナトリウム', 'sodiummg'])
    const saltEquivalent = pick(['食塩相当量', '塩分', 'salt', 'saltequivalentg'])
    const fiber = pick(['食物繊維', '食物繊維総量', 'fiberg'])
    const sugar = pick(['糖質', 'sugarg'])
    const saturatedFat = pick(['飽和脂肪酸', 'saturatedfatg'])
    const potassium = pick(['カリウム(mg)', 'カリウム', 'potassiummg'])
    const calcium = pick(['カルシウム(mg)', 'カルシウム', 'calciummg'])
    const iron = pick(['鉄(mg)', '鉄', 'ironmg'])
    const vitaminC = pick(['ビタミンC(mg)', 'ビタミンC', 'vitamincmg'])

    if (typeof servingSizeFromColumn === 'number') base.servingSizeG = servingSizeFromColumn
    if (typeof energyFromColumn === 'number') base.energyKcal = energyFromColumn
    if (typeof protein === 'number') base.proteinG = protein
    if (typeof fat === 'number') base.fatG = fat
    if (typeof carb === 'number') base.carbG = carb
    if (typeof sodiumMg === 'number') base.sodiumMg = sodiumMg
    if (typeof saltEquivalent === 'number') base.saltEquivalentG = saltEquivalent
    if (typeof fiber === 'number') base.fiberG = fiber
    if (typeof sugar === 'number') base.sugarG = sugar
    if (typeof saturatedFat === 'number') base.saturatedFatG = saturatedFat
    if (typeof potassium === 'number') base.potassiumMg = potassium
    if (typeof calcium === 'number') base.calciumMg = calcium
    if (typeof iron === 'number') base.ironMg = iron
    if (typeof vitaminC === 'number') base.vitaminCMg = vitaminC

    return Object.keys(base).length > 0 ? base : undefined
}

function buildNutritionMeta(nutrition: Recipe['nutritionPerServing'] | undefined): Recipe['nutritionMeta'] | undefined {
    if (!nutrition) return undefined
    let score = 0
    if (typeof nutrition.energyKcal === 'number') score += 0.2
    if (typeof nutrition.saltEquivalentG === 'number' || typeof nutrition.sodiumMg === 'number') score += 0.2
    if (typeof nutrition.servingSizeG === 'number') score += 0.2

    return {
        source: 'csv',
        confidence: Math.min(0.9, 0.3 + score),
        schemaVersion: 1,
        updatedAt: new Date(),
    }
}

// --- Main import functions ---

export async function importHealsioCSV(csvText: string): Promise<{ imported: number; skipped: number }> {
    // Header: メニュー名,分量,カロリー,塩分,調理時間,画像URL,材料,作り方,URL
    const rows = parseCSV(csvText)
    const header = rows[0]
    if (!header || !header[0]?.includes('メニュー名')) {
        throw new Error('ヘルシオCSVのヘッダーが不正です')
    }
    const headerLookup = buildHeaderLookup(header)

    const dataRows = rows.slice(1).filter((r) => r.length >= 9 && r[0]?.trim())

    // Get existing titles using index for efficiency
    const existingTitles = new Set(await db.recipes.orderBy('title').uniqueKeys() as string[])

    let imported = 0
    let skipped = 0
    const recipesToAdd: Omit<Recipe, 'id'>[] = []

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const title = row[0].trim()
        if (existingTitles.has(title)) {
            skipped++
            continue
        }

        const servings = getCellByHeader(row, headerLookup, ['分量', '人数'], 1).trim()
        const calories = getCellByHeader(row, headerLookup, ['カロリー', 'エネルギー'], 2).trim()
        const saltContent = getCellByHeader(row, headerLookup, ['塩分', '食塩相当量'], 3).trim()
        const cookingTime = getCellByHeader(row, headerLookup, ['調理時間'], 4).trim()
        const imageUrl = getCellByHeader(row, headerLookup, ['画像URL', '画像'], 5).trim()
        const ingredientsText = getCellByHeader(row, headerLookup, ['材料'], 6)
        const stepsText = getCellByHeader(row, headerLookup, ['作り方', '手順'], 7)
        const sourceUrl = getCellByHeader(row, headerLookup, ['URL', 'リンク'], 8).trim()

        const ingredients = ingredientsText
            .split('\n')
            .map(parseIngredientLine)
            .filter((ing): ing is Ingredient => ing !== null)

        const rawSteps = parseRawSteps(stepsText)
        const steps = estimateCookingSteps('healsio', cookingTime, ingredients.length)
        const totalTimeMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0)

        // Estimate total weight from ingredients
        const totalWeightG = estimateTotalWeight(ingredients)
        const baseServings = parseServings(servings)
        const nutritionPerServing = buildNutritionPerServingFromRow(
            row,
            headerLookup,
            totalWeightG,
            baseServings,
            calories,
            saltContent,
        )
        const nutritionMeta = buildNutritionMeta(nutritionPerServing)

        recipesToAdd.push({
            title,
            recipeNumber: generateCsvRecipeNumber('healsio', i),
            device: 'healsio',
            category: guessCategory(title),
            baseServings,
            totalWeightG,
            ingredients,
            steps,
            totalTimeMinutes,
            sourceUrl: sourceUrl || undefined,
            servings: servings || undefined,
            calories: calories || undefined,
            saltContent: saltContent || undefined,
            cookingTime: cookingTime || undefined,
            rawSteps: rawSteps.length > 0 ? rawSteps : undefined,
            imageUrl: imageUrl || undefined,
            ...(nutritionPerServing ? { nutritionPerServing } : {}),
            ...(nutritionMeta ? { nutritionMeta } : {}),
        })

        existingTitles.add(title)
        imported++
    }

    if (recipesToAdd.length > 0) {
        await db.recipes.bulkAdd(recipesToAdd as Recipe[])
    }

    return { imported, skipped }
}

export async function importHotcookCSV(csvText: string): Promise<{ imported: number; skipped: number }> {
    // Header: メニュー名,メニュー番号,分量,カロリー,調理時間,画像URL,材料,作り方,URL
    const rows = parseCSV(csvText)
    const header = rows[0]
    if (!header || !header[0]?.includes('メニュー名')) {
        throw new Error('ホットクックCSVのヘッダーが不正です')
    }
    const headerLookup = buildHeaderLookup(header)

    const dataRows = rows.slice(1).filter((r) => r.length >= 9 && r[0]?.trim())

    const existingTitles = new Set(await db.recipes.orderBy('title').uniqueKeys() as string[])

    let imported = 0
    let skipped = 0
    const recipesToAdd: Omit<Recipe, 'id'>[] = []

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const title = row[0].trim()
        if (existingTitles.has(title)) {
            skipped++
            continue
        }

        const menuNumber = getCellByHeader(row, headerLookup, ['メニュー番号', 'メニューNo'], 1).trim()
        const servings = getCellByHeader(row, headerLookup, ['分量', '人数'], 2).trim()
        const calories = getCellByHeader(row, headerLookup, ['カロリー', 'エネルギー'], 3).trim()
        const cookingTime = getCellByHeader(row, headerLookup, ['調理時間'], 4).trim()
        const imageUrl = getCellByHeader(row, headerLookup, ['画像URL', '画像'], 5).trim()
        const ingredientsText = getCellByHeader(row, headerLookup, ['材料'], 6)
        const stepsText = getCellByHeader(row, headerLookup, ['作り方', '手順'], 7)
        const sourceUrl = getCellByHeader(row, headerLookup, ['URL', 'リンク'], 8).trim()

        const ingredients = ingredientsText
            .split('\n')
            .map(parseIngredientLine)
            .filter((ing): ing is Ingredient => ing !== null)

        const rawSteps = parseRawSteps(stepsText)
        const steps = estimateCookingSteps('hotcook', cookingTime, ingredients.length)
        const totalTimeMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0)

        const totalWeightG = estimateTotalWeight(ingredients)
        const baseServings = parseServings(servings)
        const nutritionPerServing = buildNutritionPerServingFromRow(
            row,
            headerLookup,
            totalWeightG,
            baseServings,
            calories,
            '',
        )
        const nutritionMeta = buildNutritionMeta(nutritionPerServing)

        recipesToAdd.push({
            title,
            recipeNumber: menuNumber || generateCsvRecipeNumber('hotcook', i),
            device: 'hotcook',
            category: guessCategory(title),
            baseServings,
            totalWeightG,
            ingredients,
            steps,
            totalTimeMinutes,
            sourceUrl: sourceUrl || undefined,
            servings: servings || undefined,
            calories: calories || undefined,
            cookingTime: cookingTime || undefined,
            rawSteps: rawSteps.length > 0 ? rawSteps : undefined,
            imageUrl: imageUrl || undefined,
            ...(nutritionPerServing ? { nutritionPerServing } : {}),
            ...(nutritionMeta ? { nutritionMeta } : {}),
        })

        existingTitles.add(title)
        imported++
    }

    if (recipesToAdd.length > 0) {
        await db.recipes.bulkAdd(recipesToAdd as Recipe[])
    }

    return { imported, skipped }
}

// --- Helpers ---

function parseServings(servingsStr: string): number {
    if (!servingsStr) return 2
    const match = servingsStr.match(/(\d+)/)
    return match ? parseInt(match[1]) : 2
}

function estimateTotalWeight(ingredients: Ingredient[]): number {
    let weight = 0
    for (const ing of ingredients) {
        if (typeof ing.quantity !== 'number') continue

        if (ing.unit === 'g' || ing.unit === 'ml' || ing.unit === 'mL') {
            weight += ing.quantity
        } else if (ing.unit === '適量') {
            // skip
        } else {
            const unitWeight = INGREDIENT_UNIT_WEIGHT_G[ing.unit] ?? UNKNOWN_UNIT_FALLBACK_WEIGHT_G
            weight += ing.quantity * unitWeight
        }
    }
    return Math.max(200, Math.round(weight / 50) * 50) // round to nearest 50g, min 200g
}

// --- Auto-detect CSV type ---

export function detectCSVType(csvText: string): 'hotcook' | 'healsio' | null {
    const firstLine = csvText.split('\n')[0] || ''
    if (firstLine.includes('メニュー番号')) return 'hotcook'
    if (firstLine.includes('塩分')) return 'healsio'
    return null
}
