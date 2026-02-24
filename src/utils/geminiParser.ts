import type { Recipe, Ingredient, CookingStep } from '../db/db'
import { extractJsonObjectText, generateGeminiText } from '../lib/geminiClient'
import { SUPPORTED_RECIPE_DOMAINS, resolveRecipeImportStrategy } from '../constants/supportedRecipeSites'
import { ParsedRecipeSchema } from '../db/zodSchemas'

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

  image?: JsonLdImageValue
type JsonLdImageObject = { url?: string }
type JsonLdImageValue = string | JsonLdImageObject | Array<string | JsonLdImageObject>

  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `AI-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

export function validateParsedRecipe(data: unknown): Omit<Recipe, 'id'> {
  const result = ParsedRecipeSchema.safeParse(data)
  if (!result.success) {
    const formattedIssues = result.error.issues
      .map((issue) => {
        const path = issue.path.reduce<string>((acc, segment) => {
          const part = String(segment)
          if (typeof segment === 'number') return `${acc}[${part}]`
          return acc ? `${acc}.${part}` : part
        }, '')
        return path ? `${path}: ${issue.message}` : issue.message
      })
      .join('; ')

    throw new Error(`Data validation failed: ${formattedIssues}`)
  }

  const parsed = result.data

  const totalTimeMinutes = typeof parsed.totalTimeMinutes === 'number'
    ? parsed.totalTimeMinutes
    : parsed.steps.reduce((sum, s) => sum + s.durationMinutes, 0)

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

function pickFirstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') return value
  }
  return undefined
}

function resolveJsonLdImageUrl(image: JsonLdImageValue | undefined): string | undefined {
  if (typeof image === 'string') return image
  if (Array.isArray(image)) {
    return pickFirstString(image)
  }
  if (image && typeof image === 'object' && typeof image.url === 'string') {
    return image.url
  }
  return undefined
}

  const imageUrl = resolveJsonLdImageUrl(recipe.image)
    throw new Error(data.error || 'URLの解析に失敗しました。')
  }

  if (Array.isArray(data.warnings) && data.warnings.length > 0) {
    console.warn('recipe-extract warnings:', data.warnings)
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

  const recipe = await parseRecipeText(sourceSections.join('\n\n'), 'url')
  recipe.sourceUrl = parsedUrl.toString()

  if (data.imageUrl && !recipe.imageUrl) {
    recipe.imageUrl = data.imageUrl
  }

    const formatIssuePath = (segments: Array<string | number>): string => {
      let path = ''
      for (const segment of segments) {
        if (typeof segment === 'number') {
          path += `[${segment}]`
          continue
        }
        path = path ? `${path}.${segment}` : segment
      }
      return path
    }

    const formattedIssueMessages: string[] = []
    for (const issue of result.error.issues) {
      const path = formatIssuePath(issue.path)
      formattedIssueMessages.push(path ? `${path}: ${issue.message}` : issue.message)
    }
    const formattedIssues = formattedIssueMessages.join('; ')
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
