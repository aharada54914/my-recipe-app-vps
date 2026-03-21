import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ShoppingCategory } from '@kitchen/shared-types'

const VALID_CATEGORIES: readonly ShoppingCategory[] = [
  '野菜・果物', '肉類', '魚介類', '乳製品・卵',
  '調味料', '冷凍食品', '乾物・缶詰', '豆腐・大豆製品', 'その他',
] as const

export async function askGeminiClassification(ingredientName: string): Promise<ShoppingCategory> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) return 'その他'

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `食材「${ingredientName}」をスーパーマーケットの売り場に分類してください。
以下のカテゴリの中から1つだけ選んで、カテゴリ名のみを回答してください:
${VALID_CATEGORIES.join(', ')}

回答:`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const matched = VALID_CATEGORIES.find(cat => text.includes(cat))
    return matched ?? 'その他'
  } catch {
    return 'その他'
  }
}
