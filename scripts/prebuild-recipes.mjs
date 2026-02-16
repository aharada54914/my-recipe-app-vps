#!/usr/bin/env node
/**
 * prebuild-recipes.mjs
 * Reads Hotcook and Healsio CSV files and outputs pre-parsed JSON for bundling.
 * Reuses parsing logic from src/utils/csvParser.ts (ported to pure ESM JS).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// ─── RFC4180 CSV Parser (multiline-safe) ───

function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  const chars = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < chars.length && chars[i + 1] === '"') {
          field += '"'
          i++
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

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

// ─── Ingredient parser ───

const subKeywords = [
  '醤油', 'しょうゆ', '塩', '砂糖', '味噌', 'みそ', '酒', 'みりん',
  '酢', 'ソース', 'ケチャップ', 'マヨネーズ', 'だし', '顆粒',
  'コンソメ', 'バター', '油', 'オリーブ', 'ごま油', 'サラダ油',
  'こしょう', 'コショウ', '片栗粉', '薄力粉', '小麦粉',
  'バニラ', 'ココア', 'パン粉', '水', '牛乳',
]

function parseFraction(s) {
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

function parseQuantityUnit(raw) {
  const spoonMatch = raw.match(/^(大さじ|小さじ)([\d/]+(?:\s*と\s*[\d/]+)?)$/)
  if (spoonMatch) {
    return { quantity: parseFraction(spoonMatch[2]), unit: spoonMatch[1] }
  }

  const numMatch = raw.match(/^([\d./]+)\s*(.*)$/)
  if (numMatch) {
    const qty = parseFraction(numMatch[1])
    const unit = numMatch[2].replace(/\(.*?\)/g, '').trim() || 'g'
    return { quantity: qty, unit }
  }

  const anyNum = raw.match(/([\d.]+)/)
  if (anyNum) {
    const unit = raw.replace(anyNum[0], '').replace(/\(.*?\)/g, '').trim() || '個'
    return { quantity: parseFloat(anyNum[1]), unit }
  }

  return { quantity: 0, unit: '適量' }
}

function parseIngredientLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return null

  const colonIdx = trimmed.indexOf(':')
  if (colonIdx === -1) return null

  const rawName = trimmed.slice(0, colonIdx).trim()
  const rawQty = trimmed.slice(colonIdx + 1).trim()

  const name = rawName.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim()
  if (!name) return null

  const isSubIngredient = subKeywords.some((kw) => name.includes(kw))
  const category = isSubIngredient ? 'sub' : 'main'

  if (!rawQty || rawQty === '適量' || rawQty === '少々') {
    return { name, quantity: 0, unit: '適量', category }
  }

  const { quantity, unit } = parseQuantityUnit(rawQty)
  return { name, quantity, unit, category }
}

// ─── Raw steps parser ───

function parseRawSteps(stepsText) {
  if (!stepsText.trim()) return []
  return stepsText
    .split('\n')
    .map((line) => line.replace(/^\d+\s*/, '').trim())
    .filter((line) => line.length > 0)
}

// ─── Cooking time parser ───

function parseCookingTimeMinutes(timeStr) {
  if (!timeStr) return 30
  const cleaned = timeStr.replace(/約/g, '').trim()
  const hourMatch = cleaned.match(/(\d+)\s*時間/)
  const minMatch = cleaned.match(/(\d+)\s*分/)

  let minutes = 0
  if (hourMatch) minutes += parseInt(hourMatch[1]) * 60
  if (minMatch) minutes += parseInt(minMatch[1])

  return minutes > 0 ? minutes : 30
}

// ─── CookingStep estimator ───

function estimateCookingSteps(device, cookingTimeStr, ingredientCount) {
  const deviceTimeMinutes = parseCookingTimeMinutes(cookingTimeStr)
  const prepMinutes = Math.max(5, Math.min(20, Math.round(ingredientCount * 1.5)))
  const plateMinutes = 3
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

// ─── Category guesser ───

function guessCategory(title) {
  const categoryMap = [
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

// ─── Generate recipe number ───

function generateCsvRecipeNumber(device, index) {
  const prefix = device === 'hotcook' ? 'HC' : device === 'healsio' ? 'HS' : 'MN'
  return `${prefix}-${String(index + 1).padStart(3, '0')}`
}

// ─── Helpers ───

function parseServings(servingsStr) {
  if (!servingsStr) return 2
  const match = servingsStr.match(/(\d+)/)
  return match ? parseInt(match[1]) : 2
}

function estimateTotalWeight(ingredients) {
  let weight = 0
  for (const ing of ingredients) {
    if (ing.unit === 'g' || ing.unit === 'ml' || ing.unit === 'mL') {
      weight += ing.quantity
    } else if (ing.unit === '個' || ing.unit === '本' || ing.unit === '株') {
      weight += ing.quantity * 150
    } else if (ing.unit === '片') {
      weight += ing.quantity * 10
    } else if (ing.unit === '大さじ') {
      weight += ing.quantity * 15
    } else if (ing.unit === '小さじ') {
      weight += ing.quantity * 5
    } else if (ing.unit === '適量') {
      // skip
    } else {
      weight += 50
    }
  }
  return Math.max(200, Math.round(weight / 50) * 50)
}

// ─── CSV → Recipe[] converters ───

function convertHealsioCSV(csvText) {
  const rows = parseCSV(csvText)
  const header = rows[0]
  if (!header || !header[0]?.includes('メニュー名')) {
    throw new Error('ヘルシオCSVのヘッダーが不正です')
  }

  const dataRows = rows.slice(1).filter((r) => r.length >= 9 && r[0]?.trim())
  const recipes = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const title = row[0].trim()
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
      .filter((ing) => ing !== null)

    const rawSteps = parseRawSteps(stepsText)
    const steps = estimateCookingSteps('healsio', cookingTime, ingredients.length)
    const totalTimeMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0)
    const totalWeightG = estimateTotalWeight(ingredients)

    recipes.push({
      title,
      recipeNumber: generateCsvRecipeNumber('healsio', i),
      device: 'healsio',
      category: guessCategory(title),
      baseServings: parseServings(servings),
      totalWeightG,
      ingredients,
      steps,
      totalTimeMinutes,
      ...(sourceUrl && { sourceUrl }),
      ...(servings && { servings }),
      ...(calories && { calories }),
      ...(saltContent && { saltContent }),
      ...(cookingTime && { cookingTime }),
      ...(rawSteps.length > 0 && { rawSteps }),
      ...(imageUrl && { imageUrl }),
    })
  }

  return recipes
}

function convertHotcookCSV(csvText) {
  const rows = parseCSV(csvText)
  const header = rows[0]
  if (!header || !header[0]?.includes('メニュー名')) {
    throw new Error('ホットクックCSVのヘッダーが不正です')
  }

  const dataRows = rows.slice(1).filter((r) => r.length >= 9 && r[0]?.trim())
  const recipes = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const title = row[0].trim()
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
      .filter((ing) => ing !== null)

    const rawSteps = parseRawSteps(stepsText)
    const steps = estimateCookingSteps('hotcook', cookingTime, ingredients.length)
    const totalTimeMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0)
    const totalWeightG = estimateTotalWeight(ingredients)

    recipes.push({
      title,
      recipeNumber: menuNumber || generateCsvRecipeNumber('hotcook', i),
      device: 'hotcook',
      category: guessCategory(title),
      baseServings: parseServings(servings),
      totalWeightG,
      ingredients,
      steps,
      totalTimeMinutes,
      ...(sourceUrl && { sourceUrl }),
      ...(servings && { servings }),
      ...(calories && { calories }),
      ...(cookingTime && { cookingTime }),
      ...(rawSteps.length > 0 && { rawSteps }),
      ...(imageUrl && { imageUrl }),
    })
  }

  return recipes
}

// ─── Main ───

function main() {
  const outDir = join(ROOT, 'src', 'data')
  mkdirSync(outDir, { recursive: true })

  // Healsio
  console.log('📖 Reading Healsio CSV...')
  const healsioCsv = readFileSync(join(ROOT, 'AX-XA20_recipes_complete.csv'), 'utf-8')
  const healsioRecipes = convertHealsioCSV(healsioCsv)
  const healsioOut = join(outDir, 'recipes-healsio.json')
  writeFileSync(healsioOut, JSON.stringify(healsioRecipes, null, 2), 'utf-8')
  console.log(`✅ Healsio: ${healsioRecipes.length} recipes → ${healsioOut}`)

  // Hotcook
  console.log('📖 Reading Hotcook CSV...')
  const hotcookCsv = readFileSync(join(ROOT, 'KN-HW24H_recipes_complete_complete.csv'), 'utf-8')
  const hotcookRecipes = convertHotcookCSV(hotcookCsv)
  const hotcookOut = join(outDir, 'recipes-hotcook.json')
  writeFileSync(hotcookOut, JSON.stringify(hotcookRecipes, null, 2), 'utf-8')
  console.log(`✅ Hotcook: ${hotcookRecipes.length} recipes → ${hotcookOut}`)

  console.log(`\n🎉 Total: ${healsioRecipes.length + hotcookRecipes.length} recipes pre-built`)
}

main()
