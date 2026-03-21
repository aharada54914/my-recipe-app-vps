#!/usr/bin/env node
/**
 * prebuild-recipes.mjs
 * Reads Hotcook and Healsio CSV files and outputs pre-parsed JSON for bundling.
 * Reuses parsing logic from src/utils/csvParser.ts (ported to pure ESM JS).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fuse from 'fuse.js'

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

function classifyIngredient(name) {
  return subKeywords.some((kw) => name.includes(kw)) ? 'sub' : 'main'
}

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
  // Handle "大さじ・1/2" or "小さじ・1/2" → spoon unit with fraction (parsing artifact fix)
  const spoonNakaMatch = raw.match(/^(大さじ|小さじ)・([\d/]+(?:\s*と\s*[\d/]+)?)$/)
  if (spoonNakaMatch) {
    return { quantity: parseFraction(spoonNakaMatch[2]), unit: spoonNakaMatch[1] }
  }

  const spoonMatch = raw.match(/^(大さじ|小さじ)([\d/]+(?:\s*と\s*[\d/]+)?)$/)
  if (spoonMatch) {
    return { quantity: parseFraction(spoonMatch[2]), unit: spoonMatch[1] }
  }

  // Handle "1・1/2カップ" → 1.5 カップ (parsing artifact fix)
  const nakaNumMatch = raw.match(/^([\d.]+)・([\d./]+)\s*(.*)$/)
  if (nakaNumMatch) {
    const qty = parseFloat(nakaNumMatch[1]) + parseFraction(nakaNumMatch[2])
    const unit = nakaNumMatch[3].replace(/\(.*?\)/g, '').trim() || '個'
    return { quantity: qty, unit }
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

// ─── Ingredient normalization (expand grouped entries) ───

/**
 * Assign qty/unit to a list of split ingredient names.
 * - unit starts with 各 → each gets qty + unit-without-各
 * - unit contains 合わせて/合計 → each gets 適量 (combined total, no per-item amount)
 * - otherwise → each gets the same qty/unit
 */
function assignQtyToExpanded(names, quantity, unit) {
  const cleanNames = names
    .map((n) => n.replace(/[など等]+$/, '').replace(/^[^：、・]+：/, '').trim())
    .filter((n) => n)

  if (unit.startsWith('各')) {
    const cleanUnit = unit.slice(1)
    return cleanNames.map((n) => ({ name: n, quantity, unit: cleanUnit, category: classifyIngredient(n) }))
  }

  if (unit.includes('合わせて') || unit.includes('合計')) {
    return cleanNames.map((n) => ({ name: n, quantity: 0, unit: '適量', category: classifyIngredient(n) }))
  }

  return cleanNames.map((n) => ({ name: n, quantity, unit, category: classifyIngredient(n) }))
}

/**
 * Expand a single ingredient entry into multiple if its name contains
 * 、(Japanese comma) or ・(middle dot) separating multiple ingredients.
 * Also handles grouped items inside Japanese parentheses: "野菜（A・B・C）"
 */
function expandGroupedIngredient(ing) {
  const { quantity, unit } = ing

  // Strip leading ・ or whitespace from name (occasional CSV artifact)
  const cleanedName = ing.name.replace(/^[・\s]+/, '').trim()
  if (!cleanedName) return []

  // Pattern: Japanese parens contain ・ or 、-separated ingredient list
  // e.g. "野菜（ピーマン・たけのこ・きくらげ）" or "野菜（玉ねぎ、パプリカ、なす）"
  const jaParenMatch = cleanedName.match(/[（(]([^）)]+)[）)]/)
  if (jaParenMatch) {
    const inner = jaParenMatch[1]
    const sep = inner.includes('・') ? '・' : inner.includes('、') ? '、' : null
    if (sep) {
      const contents = inner
        .split(sep)
        .map((s) => s.replace(/[など等]+$/, '').trim())
        .filter((s) => s)
      if (contents.length > 1) {
        return contents.map((n) => ({ name: n, quantity: 0, unit: '適量', category: classifyIngredient(n) }))
      }
    }
  }

  // Remove Japanese parens before splitting on separators
  const nameForSplit = cleanedName.replace(/[（(][^）)]*[）)]/g, '').trim()

  // Split on ・
  if (nameForSplit.includes('・')) {
    const names = nameForSplit.split('・').map((n) => n.trim()).filter((n) => n)
    if (names.length > 1) {
      return assignQtyToExpanded(names, quantity, unit)
    }
  }

  // Split on 、
  if (nameForSplit.includes('、')) {
    const names = nameForSplit.split('、').map((n) => n.trim()).filter((n) => n)
    if (names.length > 1) {
      return assignQtyToExpanded(names, quantity, unit)
    }
  }

  // No expansion — return with cleaned name and reclassified category
  return [{ ...ing, name: cleanedName, category: classifyIngredient(cleanedName) }]
}

function normalizeIngredients(ingredients) {
  // Two passes: first splits on ・, second handles any 、 left inside split parts
  let pass1 = []
  for (const ing of ingredients) pass1.push(...expandGroupedIngredient(ing))
  let pass2 = []
  for (const ing of pass1) pass2.push(...expandGroupedIngredient(ing))
  return pass2
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

function guessCategory(title, ingredients) {
  const titleCategoryMap = [
    [['スープ', 'みそ汁', '味噌汁', 'シチュー', 'ポタージュ', '汁'], 'スープ'],
    [['ご飯', 'ピラフ', 'リゾット', 'チャーハン', 'おにぎり', 'パスタ', 'うどん', 'そば', 'ラーメン'], 'ご飯もの'],
    [['ケーキ', 'クッキー', 'プリン', 'ゼリー', 'アイス', 'チョコ', 'マフィン', 'パン', 'ヨーグルト', 'デザート', 'ジャム', 'コンポート', 'あんこ', '甘酒', 'おしるこ', 'メレンゲ'], 'デザート'],
    [['サラダ', 'ナムル', 'きんぴら', '漬', 'マリネ', 'おひたし', '和え', 'ピクルス'], '副菜'],
  ]

  for (const [keywords, cat] of titleCategoryMap) {
    if (keywords.some((kw) => title.includes(kw))) return cat
  }

  const mainIngredients = (ingredients ?? [])
    .filter((ing) => ing.category === 'main')
    .map((ing) => ing.name)
  const joined = mainIngredients.join(' ')

  if (/米|ご飯|麺|うどん|そば|パスタ|餅/.test(joined)) return 'ご飯もの'
  if (/豆腐|ほうれん草|小松菜|きゅうり|トマト|ブロッコリー|なす|かぼちゃ/.test(joined)) return '副菜'
  if (/牛乳|生クリーム|チーズ/.test(joined) && /砂糖|はちみつ|ジャム|チョコ/.test(joined)) return 'デザート'

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
    } else if (ing.unit === 'kg') {
      weight += ing.quantity * 1000
    } else if (ing.unit === '個' || ing.unit === '本' || ing.unit === '株') {
      weight += ing.quantity * 150
    } else if (ing.unit === '片') {
      weight += ing.quantity * 10
    } else if (ing.unit === '大さじ') {
      weight += ing.quantity * 15
    } else if (ing.unit === '小さじ') {
      weight += ing.quantity * 5
    } else if (ing.unit === 'カップ' || ing.unit === 'cup') {
      weight += ing.quantity * 200
    } else if (ing.unit === '合') {
      weight += ing.quantity * 150
    } else if (ing.unit === '人前' || ing.unit === '人分') {
      weight += ing.quantity * 150
    } else if (ing.unit === '膳') {
      weight += ing.quantity * 160
    } else if (ing.unit === '皿分' || ing.unit === '皿') {
      weight += ing.quantity * 180
    } else if (ing.unit === '大皿') {
      weight += ing.quantity * 300
    } else if (ing.unit === '中皿') {
      weight += ing.quantity * 200
    } else if (ing.unit === '小皿') {
      weight += ing.quantity * 120
    } else if (ing.unit === '深皿') {
      weight += ing.quantity * 250
    } else if (ing.unit === '丼' || ing.unit === '丼杯分') {
      weight += ing.quantity * 350
    } else if (ing.unit === '茶碗' || ing.unit === 'お茶碗' || ing.unit === 'お茶碗杯分') {
      weight += ing.quantity * 160
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

    const ingredients = normalizeIngredients(
      ingredientsText
        .split('\n')
        .map(parseIngredientLine)
        .filter((ing) => ing !== null)
    )

    const rawSteps = parseRawSteps(stepsText)
    const steps = estimateCookingSteps('healsio', cookingTime, ingredients.length)
    const totalTimeMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0)
    const totalWeightG = estimateTotalWeight(ingredients)

    recipes.push({
      title,
      recipeNumber: generateCsvRecipeNumber('healsio', i),
      device: 'healsio',
      category: guessCategory(title, ingredients),
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

    const ingredients = normalizeIngredients(
      ingredientsText
        .split('\n')
        .map(parseIngredientLine)
        .filter((ing) => ing !== null)
    )

    const rawSteps = parseRawSteps(stepsText)
    const steps = estimateCookingSteps('hotcook', cookingTime, ingredients.length)
    const totalTimeMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0)
    const totalWeightG = estimateTotalWeight(ingredients)

    recipes.push({
      title,
      recipeNumber: menuNumber || generateCsvRecipeNumber('hotcook', i),
      device: 'hotcook',
      category: guessCategory(title, ingredients),
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

function attachEstimatedNutrition(
  recipes,
  estimateRecipeNutritionDetailed,
  deriveEstimationConfidence,
  nutritionReference
) {
  return recipes.map((recipe) => {
    const { nutrition: nutritionPerServing, diagnostics } = estimateRecipeNutritionDetailed(recipe)
    return {
      ...recipe,
      nutritionPerServing,
      nutritionMeta: {
        source: 'estimated',
        confidence: deriveEstimationConfidence(diagnostics),
        schemaVersion: 3,
        referenceDataset: nutritionReference.dataset,
        referenceLabel: nutritionReference.label,
        estimatorVersion: nutritionReference.estimatorVersion,
        totalIngredientCount: diagnostics.totalIngredientCount,
        matchedIngredientCount: diagnostics.matchedIngredientCount,
        ingredientMatchRatio: diagnostics.ingredientMatchRatio,
        matchedWeightRatio: diagnostics.matchedWeightRatio,
        usedFallback: diagnostics.usedFallback,
        lowConfidence: diagnostics.lowConfidence,
        officialFoodCodeCount: diagnostics.officialFoodCodeCount,
        derivedFoodCodeCount: diagnostics.derivedFoodCodeCount,
        matchedFoodCodes: diagnostics.matchedFoodCodes,
      },
    }
  })
}

// ─── Main ───

async function main() {
  const {
    estimateRecipeNutritionDetailed,
    deriveEstimationConfidence,
  } = await import('../src/utils/nutritionEstimator.ts')
  const { NUTRITION_REFERENCE } = await import('../src/data/nutritionLookup.ts')
  const { normalizeJaText } = await import('../src/utils/jaText.ts')
  const { buildSearchDocSeed } = await import('../src/utils/searchIndexCore.ts')
  const outDir = join(ROOT, 'src', 'data')
  const publicSeedDir = join(ROOT, 'public', 'seed')
  mkdirSync(outDir, { recursive: true })
  mkdirSync(publicSeedDir, { recursive: true })

  const kuromojiModule = await import('kuromoji')
  const kuromoji = kuromojiModule.default
  const nodeKuromojiTokenizer = await new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: join(ROOT, 'node_modules', 'kuromoji', 'dict') }).build((err, built) => {
      if (err || !built) {
        reject(err ?? new Error('kuromoji tokenizer build failed in prebuild'))
        return
      }
      resolve(built)
    })
  })

  function getNodeKuromojiTitleVariants(text) {
    if (!text.trim()) return []
    const tokens = nodeKuromojiTokenizer.tokenize(text)
    if (!Array.isArray(tokens) || tokens.length === 0) return []

    const readingJoined = tokens
      .map((token) => {
        if (token.reading && token.reading !== '*') return normalizeJaText(token.reading)
        return normalizeJaText(token.surface_form ?? '')
      })
      .join('')
      .trim()

    if (!readingJoined || readingJoined === normalizeJaText(text)) return []
    return [readingJoined]
  }

  // Healsio
  console.log('📖 Reading Healsio CSV...')
  const healsioCsv = readFileSync(join(ROOT, 'AX-XA20_recipes_complete.csv'), 'utf-8')
  const healsioRecipes = attachEstimatedNutrition(
    convertHealsioCSV(healsioCsv),
    estimateRecipeNutritionDetailed,
    deriveEstimationConfidence,
    NUTRITION_REFERENCE
  )
  const healsioOut = join(outDir, 'recipes-healsio.json')
  const healsioPublicOut = join(publicSeedDir, 'recipes-healsio.json')
  writeFileSync(healsioOut, JSON.stringify(healsioRecipes, null, 2), 'utf-8')
  writeFileSync(healsioPublicOut, JSON.stringify(healsioRecipes), 'utf-8')
  console.log(`✅ Healsio: ${healsioRecipes.length} recipes → ${healsioOut}`)

  // Hotcook
  console.log('📖 Reading Hotcook CSV...')
  const hotcookCsv = readFileSync(join(ROOT, 'KN-HW24H_recipes_complete_complete.csv'), 'utf-8')
  const hotcookRecipes = attachEstimatedNutrition(
    convertHotcookCSV(hotcookCsv),
    estimateRecipeNutritionDetailed,
    deriveEstimationConfidence,
    NUTRITION_REFERENCE
  )
  const hotcookOut = join(outDir, 'recipes-hotcook.json')
  const hotcookPublicOut = join(publicSeedDir, 'recipes-hotcook.json')
  writeFileSync(hotcookOut, JSON.stringify(hotcookRecipes, null, 2), 'utf-8')
  writeFileSync(hotcookPublicOut, JSON.stringify(hotcookRecipes), 'utf-8')
  console.log(`✅ Hotcook: ${hotcookRecipes.length} recipes → ${hotcookOut}`)

  // Booklet recipes (Sharp COCORO KITCHEN TCAD CA055KRRZ 23H②)
  const bookletSrc = join(outDir, 'recipes-booklet.json')
  const bookletPublicOut = join(publicSeedDir, 'recipes-booklet.json')
  const bookletRaw = readFileSync(bookletSrc, 'utf-8')
  const bookletRecipes = JSON.parse(bookletRaw)
  writeFileSync(bookletPublicOut, JSON.stringify(bookletRecipes), 'utf-8')
  console.log(`✅ Booklet: ${bookletRecipes.length} recipes → ${bookletPublicOut}`)

  const searchDocSeeds = [...hotcookRecipes, ...healsioRecipes, ...bookletRecipes].map((recipe) =>
    buildSearchDocSeed(recipe, getNodeKuromojiTitleVariants(recipe.title)),
  )
  const searchDocOut = join(publicSeedDir, 'recipe-search-docs.json')
  writeFileSync(searchDocOut, JSON.stringify(searchDocSeeds), 'utf-8')

  const searchIndex = Fuse.createIndex(
    ['titleSearchText', 'ingredientSearchText', 'searchText'],
    searchDocSeeds,
  )
  const searchIndexOut = join(publicSeedDir, 'recipe-search-index.json')
  writeFileSync(searchIndexOut, JSON.stringify(searchIndex.toJSON()), 'utf-8')
  console.log(`🔎 Search index: ${searchDocSeeds.length} docs → ${searchDocOut}`)

  console.log(`📦 Seed assets: ${healsioPublicOut}, ${hotcookPublicOut}, ${bookletPublicOut}`)

  console.log(`\n🎉 Total: ${healsioRecipes.length + hotcookRecipes.length + bookletRecipes.length} recipes pre-built`)
}

main().catch((error) => {
  console.error('❌ Failed to prebuild recipes:', error)
  process.exitCode = 1
})
