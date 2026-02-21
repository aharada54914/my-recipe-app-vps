import type { Recipe } from '../db/db'
import { extractJsonObjectText, generateGeminiText } from '../lib/geminiClient'
import { validateParsedRecipe } from './geminiParser'

interface GeneratedRecipeEnvelope {
  recipes?: unknown[]
}

function buildPrompt(ingredientNames: string[]): string {
  return `あなたは日本の家庭向け献立プランナーです。
以下の食材リストを使って、夕食向けのレシピを3品提案してください。

食材リスト:
${ingredientNames.join('、')}

前提:
- 日本の家庭にある基本調味料(塩、こしょう、醤油、みりん、酒、砂糖、味噌、酢、油、だし)は常備されているものとして扱ってよい

必須ルール:
- JSONのみを出力
- 各レシピは次の形式を必ず満たす
{
  "title": string,
  "device": "hotcook" | "healsio" | "manual",
  "category": "主菜" | "副菜" | "スープ" | "ご飯もの" | "デザート",
  "baseServings": number,
  "totalWeightG": number,
  "ingredients": [
    { "name": string, "quantity": number, "unit": string, "category": "main" | "sub", "optional": boolean }
  ],
  "steps": [
    { "name": string, "durationMinutes": number, "isDeviceStep": boolean }
  ],
  "totalTimeMinutes": number
}
- ingredients は最低3件、steps は最低2件
- baseServings は 2〜4 の整数
- quantity は必ず数値

出力形式:
{
  "recipes": [<recipe1>, <recipe2>, <recipe3>]
}`
}

export async function generateRecipesFromIngredients(
  ingredientNames: string[],
  apiKey?: string
): Promise<Omit<Recipe, 'id'>[]> {
  if (ingredientNames.length === 0) {
    throw new Error('食材リストが空です。')
  }

  const prompt = buildPrompt(ingredientNames)
  const text = await generateGeminiText(prompt, apiKey)
  const json = extractJsonObjectText(text)
  const parsed = JSON.parse(json) as GeneratedRecipeEnvelope

  if (!Array.isArray(parsed.recipes) || parsed.recipes.length === 0) {
    throw new Error('献立の生成結果が空でした。')
  }

  const normalized = parsed.recipes.map((recipe) => validateParsedRecipe(recipe))
  return normalized
}
