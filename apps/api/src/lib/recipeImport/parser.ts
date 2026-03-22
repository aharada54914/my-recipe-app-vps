import { z } from 'zod'
import {
  type CookingStep,
  type Ingredient,
  type Recipe,
  DeviceTypeSchema,
  EditableRecipeCategorySchema,
  NutritionPerServingSchema,
  type RecipeImportReviewField,
} from '@kitchen/shared-types'
import { extractJsonObjectText, generateGeminiText } from '../gemini.js'
import {
  type ExtractedRecipeSource,
  resolveRecipeImportStrategy,
} from './extract.js'

const SYSTEM_PROMPT = `あなたはレシピ解析AIです。以下の情報を解析し、JSONのみを出力してください。説明文は不要です。

出力フォーマット:
{
  "title": "レシピ名",
  "device": "hotcook" | "healsio" | "manual",
  "category": "主菜" | "副菜" | "スープ" | "一品料理" | "スイーツ",
  "baseServings": 人数(number),
  "totalWeightG": 材料の総重量の推定値(number),
  "ingredients": [
    { "name": "食材名", "quantity": 数値(number) または "適量", "unit": "単位", "category": "main" | "sub", "optional": false }
  ],
  "steps": [
    { "name": "工程名", "durationMinutes": 所要時間(number), "isDeviceStep": false }
  ],
  "nutritionPerServing": {
    "servingSizeG": number,
    "energyKcal": number,
    "proteinG": number,
    "fatG": number,
    "carbG": number,
    "saltEquivalentG": number
  },
  "totalTimeMinutes": number
}

ルール:
- 手順は元の粒度を維持する
- 主材料は category: "main"、調味料は "sub"
- ホットクック/ヘルシオの手順が明示されていれば device を合わせる
- 不明なものは manual としてよい
- baseServings は必ず 1 以上の整数
- nutritionPerServing は不足項目を推定補完してよい
- JSONのみ出力すること`

const NUTRITION_REPAIR_PROMPT = `あなたはレシピJSON修正AIです。
与えられたレシピJSONに対して、nutritionPerServing の必須項目を埋めてください。

必須項目:
- servingSizeG
- energyKcal
- proteinG
- fatG
- carbG
- saltEquivalentG

ルール:
- title/device/category/ingredients/steps は維持する
- JSONのみ出力すること`

const ParsedRecipeSchema = z.object({
  title: z.string().min(1),
  device: DeviceTypeSchema.catch('manual'),
  category: EditableRecipeCategorySchema.catch('主菜'),
  baseServings: z.number().int().positive().catch(2),
  totalWeightG: z.number().nonnegative().catch(500),
  ingredients: z.array(z.object({
    name: z.string().min(1),
    quantity: z.union([z.number(), z.string()]),
    unit: z.string(),
    category: z.enum(['main', 'sub']).catch('main'),
    optional: z.boolean().optional(),
  })).min(1),
  steps: z.array(z.object({
    name: z.string().min(1),
    durationMinutes: z.number().int().positive().catch(5),
    isDeviceStep: z.boolean().optional(),
  })).min(1),
  nutritionPerServing: NutritionPerServingSchema.optional(),
  totalTimeMinutes: z.number().int().positive().optional(),
})

interface JsonLdRecipe {
  name?: unknown
  recipeYield?: unknown
  recipeIngredient?: unknown
  recipeInstructions?: unknown
  totalTime?: unknown
  image?: unknown
}

export interface ParsedRecipeImportResult {
  recipe: Omit<Recipe, 'id'>
  reviewFields: RecipeImportReviewField[]
}

function generateRecipeNumber(): string {
  const now = new Date()
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `AI-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateRequiredNutrition(recipe: Pick<Recipe, 'nutritionPerServing'>): string[] {
  const nutrition = recipe.nutritionPerServing
  if (!nutrition) return ['nutritionPerServing']

  const requiredFields: Array<keyof NonNullable<typeof nutrition>> = [
    'servingSizeG',
    'energyKcal',
    'proteinG',
    'fatG',
    'carbG',
  ]

  const missing = requiredFields.filter((field) => !isFiniteNumber(nutrition[field]))
  if (!isFiniteNumber(nutrition.saltEquivalentG) && !isFiniteNumber(nutrition.sodiumMg)) {
    missing.push('saltEquivalentG')
  }

  return missing
}

function validateParsedRecipe(data: unknown): Omit<Recipe, 'id'> {
  const result = ParsedRecipeSchema.parse(data)
  const totalTimeMinutes = result.totalTimeMinutes
    ?? result.steps.reduce((sum, step) => sum + step.durationMinutes, 0)

  return {
    title: result.title,
    recipeNumber: generateRecipeNumber(),
    device: result.device,
    category: result.category,
    baseServings: result.baseServings,
    totalWeightG: result.totalWeightG,
    ingredients: result.ingredients as Ingredient[],
    steps: result.steps as CookingStep[],
    ...(result.nutritionPerServing ? { nutritionPerServing: result.nutritionPerServing } : {}),
    totalTimeMinutes,
  }
}

async function repairRecipeNutrition(sourceText: string, parsedJsonText: string): Promise<Omit<Recipe, 'id'>> {
  const repairPrompt = `${NUTRITION_REPAIR_PROMPT}

元のレシピJSON:
${parsedJsonText}

元テキスト:
${sourceText}`

  const repairedRaw = await generateGeminiText(repairPrompt)
  const repairedJson = extractJsonObjectText(repairedRaw)
  return validateParsedRecipe(JSON.parse(repairedJson) as unknown)
}

function parseIso8601DurationMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const match = value.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i)
  if (!match) return undefined
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  if (![hours, minutes, seconds].every(Number.isFinite)) return undefined
  const total = (hours * 60) + minutes + Math.ceil(seconds / 60)
  return total > 0 ? total : undefined
}

function parseBaseServings(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:\.\d+)?)/)
    if (!match) return undefined
    const parsed = Number(match[1])
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseBaseServings(item)
      if (parsed) return parsed
    }
  }
  return undefined
}

function collectInstructionTexts(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    const text = value.trim()
    if (text) out.push(text)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectInstructionTexts(item, out))
    return
  }

  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  if (typeof record.text === 'string' && record.text.trim()) {
    out.push(record.text.trim())
  }
  if (Array.isArray(record.itemListElement)) {
    record.itemListElement.forEach((item) => collectInstructionTexts(item, out))
  }
}

function resolveJsonLdImageUrl(image: unknown): string | undefined {
  if (typeof image === 'string') return image.trim() || undefined
  if (Array.isArray(image)) {
    for (const item of image) {
      const resolved = resolveJsonLdImageUrl(item)
      if (resolved) return resolved
    }
    return undefined
  }
  if (!image || typeof image !== 'object') return undefined
  const record = image as Record<string, unknown>
  return typeof record.url === 'string' && record.url.trim() ? record.url.trim() : undefined
}

function toJsonLdRecipe(raw: Record<string, unknown>, sourceUrl: string): ParsedRecipeImportResult | null {
  const recipe = raw as JsonLdRecipe
  const title = typeof recipe.name === 'string' ? recipe.name.trim() : ''
  if (!title) return null

  const ingredients = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => ({
        name: item.trim(),
        quantity: '適量',
        unit: '',
        category: 'main' as const,
      }))
    : []

  const instructionTexts: string[] = []
  collectInstructionTexts(recipe.recipeInstructions, instructionTexts)
  const steps = instructionTexts.map((text) => ({
    name: text,
    durationMinutes: 5,
    isDeviceStep: false,
  }))

  if (ingredients.length === 0 || steps.length === 0) return null

  const parsed = validateParsedRecipe({
    title,
    device: 'manual',
    category: '主菜',
    baseServings: parseBaseServings(recipe.recipeYield),
    totalWeightG: 500,
    ingredients,
    steps,
    totalTimeMinutes: parseIso8601DurationMinutes(recipe.totalTime),
  })

  const imageUrl = resolveJsonLdImageUrl(recipe.image)
  if (imageUrl) parsed.imageUrl = imageUrl
  parsed.sourceUrl = sourceUrl

  const reviewFields: RecipeImportReviewField[] = ['device', 'category']
  if (!parseBaseServings(recipe.recipeYield)) reviewFields.push('baseServings')
  if (!parseIso8601DurationMinutes(recipe.totalTime)) reviewFields.push('totalTimeMinutes')
  return { recipe: parsed, reviewFields }
}

function dedupeReviewFields(fields: RecipeImportReviewField[]): RecipeImportReviewField[] {
  return Array.from(new Set(fields))
}

async function parseRecipeText(sourceText: string): Promise<ParsedRecipeImportResult> {
  const raw = await generateGeminiText(`${SYSTEM_PROMPT}\n\nレシピテキスト:\n---\n${sourceText}\n---`)
  const json = extractJsonObjectText(raw)
  let recipe = validateParsedRecipe(JSON.parse(json) as unknown)

  if (validateRequiredNutrition(recipe).length > 0) {
    recipe = await repairRecipeNutrition(sourceText, json)
  }

  return {
    recipe,
    reviewFields: ['device', 'category'],
  }
}

export async function parseRecipeFromExtractedSource(
  extracted: ExtractedRecipeSource,
): Promise<ParsedRecipeImportResult> {
  const strategy = resolveRecipeImportStrategy(extracted.host)

  const parseFromJsonLd = (): ParsedRecipeImportResult | null => {
    for (const candidate of extracted.jsonLdRecipes) {
      if (!candidate || typeof candidate !== 'object') continue
      const parsed = toJsonLdRecipe(candidate as Record<string, unknown>, extracted.url)
      if (!parsed) continue
      if (extracted.imageUrl && !parsed.recipe.imageUrl) {
        parsed.recipe.imageUrl = extracted.imageUrl
      }
      return parsed
    }
    return null
  }

  const sourceSections: string[] = []
  if (extracted.jsonLdRecipes.length > 0) {
    sourceSections.push(`JSON-LD Recipe Data:\n${JSON.stringify(extracted.jsonLdRecipes[0], null, 2)}`)
  }
  if (extracted.title) sourceSections.push(`ページタイトル: ${extracted.title}`)
  if (extracted.description) sourceSections.push(`説明: ${extracted.description}`)
  if (extracted.text) sourceSections.push(`本文テキスト:\n${extracted.text}`)

  if (strategy === 'jsonld-first') {
    const jsonLdRecipe = parseFromJsonLd()
    if (jsonLdRecipe) return jsonLdRecipe
  }

  try {
    const parsed = await parseRecipeText(sourceSections.join('\n\n'))
    parsed.recipe.sourceUrl = extracted.url
    if (extracted.imageUrl && !parsed.recipe.imageUrl) {
      parsed.recipe.imageUrl = extracted.imageUrl
    }
    return {
      recipe: parsed.recipe,
      reviewFields: dedupeReviewFields(parsed.reviewFields),
    }
  } catch (error) {
    if (strategy === 'gemini-first') {
      const jsonLdRecipe = parseFromJsonLd()
      if (jsonLdRecipe) return jsonLdRecipe
    }
    throw error
  }
}
