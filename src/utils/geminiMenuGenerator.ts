import type { Recipe } from '../db/db'
import { extractJsonObjectText, generateGeminiText } from '../lib/geminiClient'
import { validateParsedRecipe } from './geminiParser'
import { formatMissingNutritionMessage, validateRequiredNutrition } from './nutritionValidation'

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
- なるべくヘルシオやホットクックを活用して調理しやすい（放置できる、手間がかからない）レシピを優先的に提案してください
- JSONのみを出力
- 各レシピは次の形式を必ず満たす
{
  "title": string,
  "device": "hotcook" | "healsio" | "manual",
  "category": "主菜" | "副菜" | "スープ" | "一品料理" | "スイーツ",
  "baseServings": number,
  "totalWeightG": number,
  "ingredients": [
    { "name": string, "quantity": number, "unit": string, "category": "main" | "sub", "optional": boolean }
  ],
  "steps": [
    { "name": string, "durationMinutes": number, "isDeviceStep": boolean }
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
- ingredients は最低3件、steps は最低2件
- baseServings は 2〜4 の整数
- quantity は必ず数値
- nutritionPerServing の各項目は必ず数値で埋める（推定可）

出力形式:
{
  "recipes": [<recipe1>, <recipe2>, <recipe3>]
}`
}

function buildRepairPrompt(rawJson: string, reason: string): string {
  return `あなたはレシピJSON修正AIです。
次のJSONの recipes 配列について、nutritionPerServing 必須項目をすべて埋めて修正してください。

必須項目:
- servingSizeG
- energyKcal
- proteinG
- fatG
- carbG
- saltEquivalentG

不足理由:
${reason}

元JSON:
${rawJson}

JSONのみ出力してください。`
}

function validateRecipeWithRequiredNutrition(recipe: unknown): Omit<Recipe, 'id'> {
  const parsed = validateParsedRecipe(recipe)
  const check = validateRequiredNutrition(parsed)
  if (!check.ok) {
    throw new Error(formatMissingNutritionMessage(check.missingFields))
  }
  return parsed
}

function parseAndValidateEnvelope(json: string): Omit<Recipe, 'id'>[] {
  const parsed = JSON.parse(json) as GeneratedRecipeEnvelope
  if (!Array.isArray(parsed.recipes) || parsed.recipes.length === 0) {
    throw new Error('献立の生成結果が空でした。')
  }
  return parsed.recipes.map((recipe) => validateRecipeWithRequiredNutrition(recipe))
}

export async function generateRecipesFromIngredients(
  ingredientNames: string[],
  apiKey?: string
): Promise<Omit<Recipe, 'id'>[]> {
  if (ingredientNames.length === 0) {
    throw new Error('食材リストが空です。')
  }

  const prompt = buildPrompt(ingredientNames)
  const text = await generateGeminiText(prompt, apiKey, { feature: 'stock_recipe_suggest' })
  const json = extractJsonObjectText(text)
  try {
    return parseAndValidateEnvelope(json)
  } catch (error) {
    const reason = error instanceof Error ? error.message : '栄養項目が不足しています'
    const repairedText = await generateGeminiText(buildRepairPrompt(json, reason), apiKey, { feature: 'stock_recipe_suggest' })
    const repairedJson = extractJsonObjectText(repairedText)
    return parseAndValidateEnvelope(repairedJson)
  }
}
