import type { Recipe, Ingredient, CookingStep, DeviceType, RecipeCategory, IngredientCategory } from '../db/db'
import { extractJsonObjectText, generateGeminiText } from '../lib/geminiClient'
import { SUPPORTED_RECIPE_DOMAINS } from '../constants/supportedRecipeSites'

const SYSTEM_PROMPT = `あなたはレシピ解析AIです。以下の情報を解析し、JSONのみを出力してください。説明文は不要です。

出力フォーマット:
{
  "title": "レシピ名",
  "device": "hotcook" | "healsio" | "manual",
  "category": "主菜" | "副菜" | "スープ" | "ご飯もの" | "デザート",
  "baseServings": 人数(number),
  "totalWeightG": 材料の総重量の推定値(number),
  "ingredients": [
    { "name": "食材名", "quantity": 数値(number), "unit": "単位", "category": "main" | "sub", "optional": false }
  ],
  "steps": [
    { "name": "工程名", "durationMinutes": 所要時間(number), "isDeviceStep": false }
  ],
  "totalTimeMinutes": 全ステップの合計時間(number)
}

ルール:
- 主材料(肉、魚、野菜、豆腐等)はcategory: "main"、調味料・だし・油等はcategory: "sub"
- ホットクックを使うステップはisDeviceStep: true、device: "hotcook"
- ヘルシオを使うステップはisDeviceStep: true、device: "healsio"
- それ以外はdevice: "manual"
- 「適量」の場合はquantity: 0、unit: "適量"
- 時間が不明なステップは5分と推定
- baseServings は必ず数値（1以上）
- JSONのみ出力すること`

interface ExtractApiResponse {
  ok: boolean
  error?: string
  jsonLdRecipes?: unknown[]
  text?: string
  title?: string
  imageUrl?: string
  description?: string
}

function generateRecipeNumber(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `AI-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

const VALID_DEVICES: DeviceType[] = ['hotcook', 'healsio', 'manual']
const VALID_CATEGORIES: RecipeCategory[] = ['主菜', '副菜', 'スープ', 'ご飯もの', 'デザート']
const VALID_INGREDIENT_CATEGORIES: IngredientCategory[] = ['main', 'sub']

function validateIngredient(data: unknown, index: number): Ingredient {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`ingredients[${index}] がオブジェクトではありません`)
  }
  const obj = data as Record<string, unknown>

  if (typeof obj.name !== 'string' || !obj.name) {
    throw new Error(`ingredients[${index}].name が文字列ではありません`)
  }
  if (typeof obj.quantity !== 'number' || Number.isNaN(obj.quantity)) {
    throw new Error(`ingredients[${index}].quantity が数値ではありません`)
  }
  if (typeof obj.unit !== 'string' || !obj.unit) {
    throw new Error(`ingredients[${index}].unit が文字列ではありません`)
  }

  const category = VALID_INGREDIENT_CATEGORIES.includes(obj.category as IngredientCategory)
    ? (obj.category as IngredientCategory)
    : 'main'

  return {
    name: obj.name,
    quantity: obj.quantity,
    unit: obj.unit,
    category,
    ...(obj.optional === true ? { optional: true } : {}),
  }
}

function validateStep(data: unknown, index: number): CookingStep {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`steps[${index}] がオブジェクトではありません`)
  }
  const obj = data as Record<string, unknown>

  if (typeof obj.name !== 'string' || !obj.name) {
    throw new Error(`steps[${index}].name が文字列ではありません`)
  }
  if (typeof obj.durationMinutes !== 'number' || Number.isNaN(obj.durationMinutes)) {
    throw new Error(`steps[${index}].durationMinutes が数値ではありません`)
  }

  return {
    name: obj.name,
    durationMinutes: obj.durationMinutes,
    ...(obj.isDeviceStep === true ? { isDeviceStep: true } : {}),
  }
}

export function validateParsedRecipe(data: unknown): Omit<Recipe, 'id'> {
  if (typeof data !== 'object' || data === null) {
    throw new Error('解析結果がオブジェクトではありません')
  }
  const obj = data as Record<string, unknown>

  if (typeof obj.title !== 'string' || !obj.title) {
    throw new Error('title が不正です')
  }
  if (!Array.isArray(obj.ingredients) || obj.ingredients.length === 0) {
    throw new Error('ingredients が不正です')
  }
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    throw new Error('steps が不正です')
  }

  const device = VALID_DEVICES.includes(obj.device as DeviceType)
    ? (obj.device as DeviceType)
    : 'manual'

  const category = VALID_CATEGORIES.includes(obj.category as RecipeCategory)
    ? (obj.category as RecipeCategory)
    : '主菜'

  const ingredients = obj.ingredients.map((ing: unknown, i: number) => validateIngredient(ing, i))
  const steps = obj.steps.map((step: unknown, i: number) => validateStep(step, i))

  const totalTimeMinutes = typeof obj.totalTimeMinutes === 'number' && !Number.isNaN(obj.totalTimeMinutes)
    ? obj.totalTimeMinutes
    : steps.reduce((sum, s) => sum + s.durationMinutes, 0)

  const baseServings = typeof obj.baseServings === 'number' && obj.baseServings > 0
    ? obj.baseServings
    : 2

  return {
    title: obj.title,
    recipeNumber: generateRecipeNumber(),
    device,
    category,
    baseServings,
    totalWeightG: typeof obj.totalWeightG === 'number' ? obj.totalWeightG : 500,
    ingredients,
    steps,
    totalTimeMinutes,
  }
}

export async function parseRecipeText(text: string): Promise<Omit<Recipe, 'id'>> {
  const raw = await generateGeminiText(`${SYSTEM_PROMPT}\n\nレシピテキスト:\n---\n${text}\n---`)
  const json = extractJsonObjectText(raw)
  const parsed: unknown = JSON.parse(json)
  return validateParsedRecipe(parsed)
}

function ensureSupportedHost(url: URL): void {
  const host = url.hostname.toLowerCase()
  const supported = SUPPORTED_RECIPE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
  if (!supported) {
    throw new Error('このURLは現在未対応です。対応サイト一覧を確認してください。')
  }
}

export async function parseRecipeFromUrl(url: string): Promise<Omit<Recipe, 'id'>> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('URL形式が不正です。')
  }

  ensureSupportedHost(parsedUrl)

  const response = await fetch(`/api/recipe-extract?url=${encodeURIComponent(parsedUrl.toString())}`)
  let data = await response.json() as ExtractApiResponse

  if (response.status === 404) {
    // Local dev fallback when Vercel function is not running
    try {
      const directRes = await fetch(parsedUrl.toString())
      const directText = await directRes.text()
      data = { ok: true, text: directText }
    } catch {
      throw new Error('URL解析APIが利用できません。Vercel上で実行するか、テキスト貼り付けで取り込みしてください。')
    }
  }

  const apiSucceeded = response.ok || response.status === 404
  if (!apiSucceeded || !data.ok) {
    throw new Error(data.error || 'URLの解析に失敗しました。')
  }

  const sourceSections: string[] = []

  if (Array.isArray(data.jsonLdRecipes) && data.jsonLdRecipes.length > 0) {
    sourceSections.push(`JSON-LD Recipe Data:\n${JSON.stringify(data.jsonLdRecipes[0], null, 2)}`)
  }

  if (data.title) sourceSections.push(`ページタイトル: ${data.title}`)
  if (data.description) sourceSections.push(`説明: ${data.description}`)
  if (data.text) sourceSections.push(`本文テキスト:\n${data.text}`)

  if (sourceSections.length === 0) {
    throw new Error('URLからレシピ情報を抽出できませんでした。')
  }

  const recipe = await parseRecipeText(sourceSections.join('\n\n'))
  recipe.sourceUrl = parsedUrl.toString()

  if (data.imageUrl && !recipe.imageUrl) {
    recipe.imageUrl = data.imageUrl
  }

  return recipe
}
