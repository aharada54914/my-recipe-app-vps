import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Recipe } from '../db/db'

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
  const key = import.meta.env.VITE_GEMINI_API_KEY as string
  if (!key) throw new Error('VITE_GEMINI_API_KEY が設定されていません。.envファイルにAPIキーを設定してください。')
  return key
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

function generateRecipeNumber(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `AI-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

export async function parseRecipeText(text: string): Promise<Omit<Recipe, 'id'>> {
  const genAI = new GoogleGenerativeAI(getApiKey())
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nレシピテキスト:\n---\n${text}\n---`)
  const response = result.response.text()
  const json = stripCodeFences(response)

  const parsed = JSON.parse(json)

  // Validate required fields
  if (!parsed.title || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.steps)) {
    throw new Error('解析結果に必要なフィールドが不足しています')
  }

  return {
    title: parsed.title,
    recipeNumber: generateRecipeNumber(),
    device: parsed.device ?? 'manual',
    category: parsed.category ?? '主菜',
    baseServings: parsed.baseServings ?? 2,
    totalWeightG: parsed.totalWeightG ?? 500,
    ingredients: parsed.ingredients,
    steps: parsed.steps,
    totalTimeMinutes: parsed.totalTimeMinutes ?? parsed.steps.reduce(
      (sum: number, s: { durationMinutes: number }) => sum + s.durationMinutes, 0
    ),
  }
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
