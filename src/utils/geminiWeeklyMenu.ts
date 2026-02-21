/**
 * Gemini API Weekly Menu Refinement (Optional)
 *
 * Uses Gemini to refine the locally-selected weekly menu.
 * If API key is not available, returns null (caller falls back to local result).
 */

import { extractJsonObjectText, generateGeminiText, resolveGeminiApiKey } from '../lib/geminiClient'

interface MenuRecipeInfo {
  recipeId: number
  title: string
  date: string
  category: string
  device: string
}

interface RefinedMenuItem {
  recipeId: number
  date: string
}

const REFINE_PROMPT = `あなたは家庭料理の献立アドバイザーです。
以下の7日分の献立を確認し、改善提案をしてください。

改善のポイント:
- 栄養バランス（タンパク質、野菜、炭水化物の偏りがないか）
- カテゴリの多様性（同じカテゴリが3日以上連続していないか）
- 調理機器の分散（同じ機器が4日以上連続していないか）

入れ替えが必要な場合は、日付と新しいレシピIDを指定してください。
入れ替え不要の場合は空の配列を返してください。

レスポンスはJSONのみ:
{ "swaps": [{ "date": "YYYY-MM-DD", "newRecipeId": number }] }
`

function getApiKey(): string | null {
  return resolveGeminiApiKey()
}

/**
 * Refine the weekly menu using Gemini API.
 * Returns swapped recipe assignments, or null if API is unavailable or fails.
 */
export async function refineWeeklyMenu(
  selectedRecipes: MenuRecipeInfo[],
  allRecipes: MenuRecipeInfo[],
  config: { userPrompt: string; seasonalIngredients: string[] }
): Promise<RefinedMenuItem[] | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const menuText = selectedRecipes.map(r =>
      `${r.date}: ${r.title} (${r.category}, ${r.device})`
    ).join('\n')

    const availableText = allRecipes
      .filter(r => !selectedRecipes.some(s => s.recipeId === r.recipeId))
      .slice(0, 30)
      .map(r => `ID:${r.recipeId} ${r.title} (${r.category}, ${r.device})`)
      .join('\n')

    const userPromptSection = config.userPrompt
      ? `\nユーザーの要望: ${config.userPrompt}`
      : ''

    const seasonalSection = config.seasonalIngredients.length > 0
      ? `\n旬の食材: ${config.seasonalIngredients.join(', ')}`
      : ''

    const prompt = `${REFINE_PROMPT}

現在の献立:
${menuText}

利用可能な代替レシピ:
${availableText}
${userPromptSection}
${seasonalSection}`

    const text = await generateGeminiText(prompt, apiKey)
    const parsed = JSON.parse(extractJsonObjectText(text)) as { swaps: { date: string; newRecipeId: number }[] }

    if (!parsed.swaps || parsed.swaps.length === 0) return null

    // Apply swaps to the selected recipes
    const swapMap = new Map(parsed.swaps.map(s => [s.date, s.newRecipeId]))
    return selectedRecipes.map(r => ({
      recipeId: swapMap.get(r.date) ?? r.recipeId,
      date: r.date,
    }))
  } catch {
    // Silently fail — local selection is used as fallback
    return null
  }
}
