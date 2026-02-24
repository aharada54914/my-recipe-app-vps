import type { Recipe, Ingredient, CookingStep } from '../db/db'
import { ParsedRecipeSchema } from '../db/zodSchemas'
import { SUPPORTED_RECIPE_DOMAINS, resolveRecipeImportStrategy } from '../constants/supportedRecipeSites'
import { extractJsonObjectText, generateGeminiText } from '../lib/geminiClient'

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
  "totalTimeMinutes": 全ステップの合計時間(number)
}

ルール:
- 調理手順（steps）は元のテキストの手順や表現を要約せず、そのままの粒度でステップごとに分解して抽出してください。勝手に手順をまとめないでください。
- 主材料(肉、魚、野菜、豆腐等)はcategory: "main"、調味料・だし・油等はcategory: "sub"
- ホットクックを使うステップはisDeviceStep: true、device: "hotcook"
- ヘルシオを使うステップはisDeviceStep: true、device: "healsio"
- それ以外はdevice: "manual"
- 「適量」の場合はquantity: "適量"、unit: ""（空文字）としてください
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
  fetchStrategy?: 'direct' | 'jina-ai-proxy'
  warnings?: string[]
}

type JsonLdImageObject = { url?: unknown }
type JsonLdImageValue = string | JsonLdImageObject | Array<string | JsonLdImageObject>

interface JsonLdRecipe {
  name?: unknown
  recipeYield?: unknown
  recipeIngredient?: unknown
  recipeInstructions?: unknown
  totalTime?: unknown
  image?: JsonLdImageValue
}

function generateRecipeNumber(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `AI-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function formatIssuePath(segments: PropertyKey[]): string {
  let path = ''
  for (const segment of segments) {
    if (typeof segment === 'number') {
      path += `[${segment}]`
      continue
    }
    const key = typeof segment === 'symbol' ? String(segment) : segment
    path = path ? `${path}.${key}` : key
  }
  return path
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function pickFirstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (isObjectRecord(value) && typeof value.url === 'string' && value.url.trim()) return value.url.trim()
  }
  return undefined
}

function resolveJsonLdImageUrl(image: JsonLdImageValue | undefined): string | undefined {
  if (typeof image === 'string') return image.trim() || undefined
  if (Array.isArray(image)) return pickFirstString(image)
  if (!image || typeof image !== 'object') return undefined

  if (typeof image.url === 'string') return image.url.trim() || undefined
  if (Array.isArray(image.url)) return pickFirstString(image.url)
  return undefined
}

function parseIso8601DurationMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const match = value.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i)
  if (!match) return undefined

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  if (![hours, minutes, seconds].every((n) => Number.isFinite(n))) return undefined

  const total = (hours * 60) + minutes + Math.ceil(seconds / 60)
  return total > 0 ? total : undefined
}

function parseBaseServings(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value

  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:\.\d+)?)/)
    if (!match) return undefined
    const parsed = Number(match[1])
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
    return undefined
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseBaseServings(entry)
      if (parsed) return parsed
    }
  }

  return undefined
}

function toJsonLdIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return []

  const ingredients: Ingredient[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    if (!name) continue
    ingredients.push({
      name,
      quantity: '適量',
      unit: '',
      category: 'main',
    })
  }

  return ingredients
}

function collectInstructionTexts(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    const text = value.trim()
    if (text) out.push(text)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectInstructionTexts(item, out)
    }
    return
  }

  if (!isObjectRecord(value)) return

  if (typeof value.text === 'string') {
    const text = value.text.trim()
    if (text) out.push(text)
  }

  if (Array.isArray(value.itemListElement)) {
    for (const item of value.itemListElement) {
      collectInstructionTexts(item, out)
    }
  }
}

function toJsonLdSteps(value: unknown): CookingStep[] {
  const texts: string[] = []
  collectInstructionTexts(value, texts)

  const steps: CookingStep[] = []
  for (const text of texts) {
    steps.push({
      name: text,
      durationMinutes: 5,
      isDeviceStep: false,
    })
  }
  return steps
}

function toJsonLdRecipe(raw: unknown, sourceUrl: string): Omit<Recipe, 'id'> | null {
  if (!isObjectRecord(raw)) return null

  const recipe = raw as JsonLdRecipe
  const title = typeof recipe.name === 'string' ? recipe.name.trim() : ''
  if (!title) return null

  const ingredients = toJsonLdIngredients(recipe.recipeIngredient)
  const steps = toJsonLdSteps(recipe.recipeInstructions)
  if (ingredients.length === 0 || steps.length === 0) return null

  try {
    const parsed = validateParsedRecipe({
      title,
      device: 'manual',
      category: '主菜',
      baseServings: parseBaseServings(recipe.recipeYield),
      totalWeightG: undefined,
      ingredients,
      steps,
      totalTimeMinutes: parseIso8601DurationMinutes(recipe.totalTime),
    })

    const imageUrl = resolveJsonLdImageUrl(recipe.image)
    if (imageUrl) parsed.imageUrl = imageUrl
    parsed.sourceUrl = sourceUrl
    return parsed
  } catch {
    return null
  }
}

export function validateParsedRecipe(data: unknown): Omit<Recipe, 'id'> {
  const result = ParsedRecipeSchema.safeParse(data)
  if (!result.success) {
    const formattedIssueMessages: string[] = []
    for (const issue of result.error.issues) {
      const path = formatIssuePath(issue.path)
      formattedIssueMessages.push(path ? `${path}: ${issue.message}` : issue.message)
    }
    const formattedIssues = formattedIssueMessages.join('; ')
    throw new Error(`Data validation failed: ${formattedIssues}`)
  }

  const parsed = result.data
  const totalTimeMinutes = typeof parsed.totalTimeMinutes === 'number'
    ? parsed.totalTimeMinutes
    : parsed.steps.reduce((sum, step) => sum + step.durationMinutes, 0)

  return {
    title: parsed.title,
    recipeNumber: generateRecipeNumber(),
    device: parsed.device,
    category: parsed.category,
    baseServings: parsed.baseServings,
    totalWeightG: parsed.totalWeightG,
    ingredients: parsed.ingredients as Ingredient[],
    steps: parsed.steps as CookingStep[],
    totalTimeMinutes,
  }
}

export async function parseRecipeText(text: string, source: 'text' | 'url' = 'text'): Promise<Omit<Recipe, 'id'>> {
  const raw = await generateGeminiText(`${SYSTEM_PROMPT}\n\nレシピテキスト:\n---\n${text}\n---`, undefined, {
    feature: source === 'url' ? 'recipe_import_url' : 'recipe_import_text',
    enableAutoRetryEscalation: source === 'url',
  })
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

  if (Array.isArray(data.warnings) && data.warnings.length > 0) {
    console.warn('recipe-extract warnings:', data.warnings)
  }

  const parseFromJsonLd = (): Omit<Recipe, 'id'> | null => {
    if (!Array.isArray(data.jsonLdRecipes) || data.jsonLdRecipes.length === 0) return null

    for (const candidate of data.jsonLdRecipes) {
      const parsed = toJsonLdRecipe(candidate, parsedUrl.toString())
      if (!parsed) continue
      if (data.imageUrl && !parsed.imageUrl) {
        parsed.imageUrl = data.imageUrl
      }
      return parsed
    }

    return null
  }

  const sourceSections: string[] = []
  if (Array.isArray(data.jsonLdRecipes) && data.jsonLdRecipes.length > 0) {
    sourceSections.push(`JSON-LD Recipe Data:\n${JSON.stringify(data.jsonLdRecipes[0], null, 2)}`)
  }
  if (data.title) sourceSections.push(`ページタイトル: ${data.title}`)
  if (data.description) sourceSections.push(`説明: ${data.description}`)
  if (data.text) sourceSections.push(`本文テキスト:\n${data.text}`)

  const strategy = resolveRecipeImportStrategy(parsedUrl.hostname)
  if (strategy === 'jsonld-first') {
    const jsonLdRecipe = parseFromJsonLd()
    if (jsonLdRecipe) return jsonLdRecipe
  }

  if (sourceSections.length === 0) {
    const jsonLdRecipe = parseFromJsonLd()
    if (jsonLdRecipe) return jsonLdRecipe
    throw new Error('URLからレシピ情報を抽出できませんでした。')
  }

  const sourceText = sourceSections.join('\n\n')

  try {
    const recipe = await parseRecipeText(sourceText, 'url')
    recipe.sourceUrl = parsedUrl.toString()
    if (data.imageUrl && !recipe.imageUrl) {
      recipe.imageUrl = data.imageUrl
    }
    return recipe
  } catch (error) {
    if (strategy === 'gemini-first') {
      const jsonLdRecipe = parseFromJsonLd()
      if (jsonLdRecipe) return jsonLdRecipe
    }
    throw error
  }
}
