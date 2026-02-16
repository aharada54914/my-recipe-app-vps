import type { Recipe, Ingredient, CookingStep, DeviceType, RecipeCategory, IngredientCategory } from '../db/db'

const SYSTEM_PROMPT = `あなたはレシピ解析AIです。以下のレシピテキストを解析し、JSONのみを出力してください。説明文は不要です。

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
- JSONのみ出力すること`

function getApiKey(): string {
  // Priority: .env > localStorage
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string
  if (envKey) return envKey

  const storedKey = localStorage.getItem('gemini_api_key')
  if (storedKey) return storedKey

  throw new Error('APIキーが設定されていません。設定画面またはenvファイルにAPIキーを設定してください。')
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
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
  if (typeof obj.quantity !== 'number') {
    throw new Error(`ingredients[${index}].quantity が数値ではありません`)
  }
  if (typeof obj.unit !== 'string') {
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
  if (typeof obj.durationMinutes !== 'number') {
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

  const totalTimeMinutes = typeof obj.totalTimeMinutes === 'number'
    ? obj.totalTimeMinutes
    : steps.reduce((sum, s) => sum + s.durationMinutes, 0)

  return {
    title: obj.title,
    recipeNumber: generateRecipeNumber(),
    device,
    category,
    baseServings: typeof obj.baseServings === 'number' ? obj.baseServings : 2,
    totalWeightG: typeof obj.totalWeightG === 'number' ? obj.totalWeightG : 500,
    ingredients,
    steps,
    totalTimeMinutes,
  }
}

export async function parseRecipeText(text: string): Promise<Omit<Recipe, 'id'>> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(getApiKey())
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nレシピテキスト:\n---\n${text}\n---`)
  const response = result.response.text()
  const json = stripCodeFences(response)

  const parsed: unknown = JSON.parse(json)
  return validateParsedRecipe(parsed)
}

export async function parseRecipeFromUrl(url: string): Promise<Omit<Recipe, 'id'>> {
  let text: string
  try {
    const res = await fetch(url)
    const html = await res.text()
    // Strip HTML tags to get plain text
    const doc = new DOMParser().parseFromString(html, 'text/html')
    text = doc.body.textContent ?? ''
  } catch {
    throw new Error('URLの取得に失敗しました。テキストを直接貼り付けてお試しください。')
  }

  if (!text.trim()) {
    throw new Error('URLからテキストを抽出できませんでした。テキストを直接貼り付けてお試しください。')
  }

  return parseRecipeText(text)
}
