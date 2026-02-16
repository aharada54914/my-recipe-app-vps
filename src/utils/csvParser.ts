import type { Recipe, Ingredient, CookingStep, DeviceType, RecipeCategory } from '../db/db'
import { db } from '../db/db'

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
        [['ご飯', 'ピラフ', 'リゾット', 'チャーハン', 'おにぎり', 'パスタ', 'うどん', 'そば', 'ラーメン'], 'ご飯もの'],
        [['ケーキ', 'クッキー', 'プリン', 'ゼリー', 'アイス', 'チョコ', 'マフィン', 'パン', 'ヨーグルト', 'デザート', 'ジャム', 'コンポート', 'あんこ', '甘酒', 'おしるこ', 'メレンゲ'], 'デザート'],
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

// --- Main import functions ---

export async function importHealsioCSV(csvText: string): Promise<{ imported: number; skipped: number }> {
    // Header: メニュー名,分量,カロリー,塩分,調理時間,画像URL,材料,作り方,URL
    const rows = parseCSV(csvText)
    const header = rows[0]
    if (!header || !header[0]?.includes('メニュー名')) {
        throw new Error('ヘルシオCSVのヘッダーが不正です')
    }

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

        const servings = row[1]?.trim() || ''
        const calories = row[2]?.trim() || ''
        const saltContent = row[3]?.trim() || ''
        const cookingTime = row[4]?.trim() || ''
        const imageUrl = row[5]?.trim() || ''
        const ingredientsText = row[6] || ''
        const stepsText = row[7] || ''
        const sourceUrl = row[8]?.trim() || ''

        const ingredients = ingredientsText
            .split('\n')
            .map(parseIngredientLine)
            .filter((ing): ing is Ingredient => ing !== null)

        const rawSteps = parseRawSteps(stepsText)
        const steps = estimateCookingSteps('healsio', cookingTime, ingredients.length)
        const totalTimeMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0)

        // Estimate total weight from ingredients
        const totalWeightG = estimateTotalWeight(ingredients)

        recipesToAdd.push({
            title,
            recipeNumber: generateCsvRecipeNumber('healsio', i),
            device: 'healsio',
            category: guessCategory(title),
            baseServings: parseServings(servings),
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

        const menuNumber = row[1]?.trim() || ''
        const servings = row[2]?.trim() || ''
        const calories = row[3]?.trim() || ''
        const cookingTime = row[4]?.trim() || ''
        const imageUrl = row[5]?.trim() || ''
        const ingredientsText = row[6] || ''
        const stepsText = row[7] || ''
        const sourceUrl = row[8]?.trim() || ''

        const ingredients = ingredientsText
            .split('\n')
            .map(parseIngredientLine)
            .filter((ing): ing is Ingredient => ing !== null)

        const rawSteps = parseRawSteps(stepsText)
        const steps = estimateCookingSteps('hotcook', cookingTime, ingredients.length)
        const totalTimeMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0)

        const totalWeightG = estimateTotalWeight(ingredients)

        recipesToAdd.push({
            title,
            recipeNumber: menuNumber || generateCsvRecipeNumber('hotcook', i),
            device: 'hotcook',
            category: guessCategory(title),
            baseServings: parseServings(servings),
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
        if (ing.unit === 'g' || ing.unit === 'ml' || ing.unit === 'mL') {
            weight += ing.quantity
        } else if (ing.unit === '個' || ing.unit === '本' || ing.unit === '株') {
            weight += ing.quantity * 150 // rough estimate per piece
        } else if (ing.unit === '片') {
            weight += ing.quantity * 10
        } else if (ing.unit === '大さじ') {
            weight += ing.quantity * 15
        } else if (ing.unit === '小さじ') {
            weight += ing.quantity * 5
        } else if (ing.unit === '適量') {
            // skip
        } else {
            weight += 50 // unknown unit fallback
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
