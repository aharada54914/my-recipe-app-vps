import { extractJsonObjectText, generateGeminiTextFromImageAndPrompt } from '../lib/geminiClient'
import type { InlineImagePart } from '../lib/geminiClient'

const INGREDIENT_EXTRACTION_PROMPT = `あなたは冷蔵庫食材の抽出アシスタントです。
画像に写っている食材を日本語で抽出し、JSONのみで返してください。

出力形式:
{
  "ingredients": ["鶏もも肉", "玉ねぎ", "にんじん"]
}

ルール:
- 調味料(塩、こしょう、醤油、みりん、酒、砂糖、味噌、酢、油など)は出力しない
- 重複は除外
- 不確実な食材は含めない
- 食材名のみ(分量は不要)
- JSON以外の説明文を出さない`

export async function extractIngredientsFromPhotoCollage(image: InlineImagePart, apiKey?: string): Promise<string[]> {
  const text = await generateGeminiTextFromImageAndPrompt(INGREDIENT_EXTRACTION_PROMPT, image, apiKey)
  const json = extractJsonObjectText(text)

  const parsed = JSON.parse(json) as { ingredients?: unknown }
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : []

  const names = ingredients
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((name) => name.trim())

  return Array.from(new Set(names))
}
