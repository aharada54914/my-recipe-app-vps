import { GoogleGenerativeAI } from '@google/generative-ai'

export const GEMINI_MODEL = 'gemini-3-flash-preview'

export function resolveGeminiApiKey(override?: string): string | null {
  if (override?.trim()) return override.trim()
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (envKey?.trim()) return envKey.trim()
  const storedKey = localStorage.getItem('gemini_api_key')
  if (storedKey?.trim()) return storedKey.trim()
  return null
}

function getModel(apiKey?: string) {
  const key = resolveGeminiApiKey(apiKey)
  if (!key) {
    throw new Error('Gemini APIキーが未設定です。設定画面からキーを登録してください。')
  }

  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({ model: GEMINI_MODEL })
}

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

export function extractJsonObjectText(text: string): string {
  const stripped = stripCodeFences(text)
  const match = stripped.match(/\{[\s\S]*\}/)
  return match ? match[0] : stripped
}

export async function generateGeminiText(prompt: string, apiKey?: string): Promise<string> {
  const model = getModel(apiKey)
  const result = await model.generateContent(prompt)
  return result.response.text()
}

export interface InlineImagePart {
  mimeType: string
  data: string
}

export async function generateGeminiTextFromImageAndPrompt(
  prompt: string,
  image: InlineImagePart,
  apiKey?: string
): Promise<string> {
  const model = getModel(apiKey)
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: image.mimeType, data: image.data } },
  ])
  return result.response.text()
}
