import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  getEscalatedModel,
  getGeminiFeatureConfig,
  getSelectedModelForFeature,
  recordGeminiUsage,
  supportsAutoRetryEscalation,
  type GeminiFeatureKey,
  type GeminiModelId,
} from './geminiSettings'

export const GEMINI_MODEL = 'gemini-2.0-flash'

export function resolveGeminiApiKey(override?: string): string | null {
  if (override?.trim()) return override.trim()
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (envKey?.trim()) return envKey.trim()
  const storedKey = localStorage.getItem('gemini_api_key')
  if (storedKey?.trim()) return storedKey.trim()
  return null
}

function getModel(modelName: string, apiKey?: string) {
  const key = resolveGeminiApiKey(apiKey)
  if (!key) {
    throw new Error('Gemini APIキーが未設定です。設定画面からキーを登録してください。')
  }

  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({ model: modelName })
}

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

export function extractJsonObjectText(text: string): string {
  const stripped = stripCodeFences(text)
  const match = stripped.match(/\{[\s\S]*\}/)
  return match ? match[0] : stripped
}

interface GeminiRequestOptions {
  feature?: GeminiFeatureKey
  enableAutoRetryEscalation?: boolean
}

function extractUsageMetadata(response: unknown): {
  promptTokens?: number
  candidateTokens?: number
  totalTokens?: number
} {
  const usage = (response as { usageMetadata?: Record<string, unknown> })?.usageMetadata
  if (!usage) return {}
  return {
    promptTokens: Number(usage.promptTokenCount ?? 0) || 0,
    candidateTokens: Number(usage.candidatesTokenCount ?? 0) || 0,
    totalTokens: Number(usage.totalTokenCount ?? 0) || 0,
  }
}

function resolveModelName(feature?: GeminiFeatureKey): GeminiModelId {
  return feature ? getSelectedModelForFeature(feature) : (GEMINI_MODEL as GeminiModelId)
}

function shouldRetryWithEscalation(feature: GeminiFeatureKey | undefined, requested?: boolean): boolean {
  if (!feature || !requested || !supportsAutoRetryEscalation(feature)) return false
  const config = getGeminiFeatureConfig()
  return config.retryEscalationForUrlAndImage
}

async function generateTextOnce(prompt: string, modelName: GeminiModelId, apiKey?: string, feature?: GeminiFeatureKey): Promise<string> {
  const model = getModel(modelName, apiKey)
  const result = await model.generateContent(prompt)
  const response = result.response
  const usage = extractUsageMetadata(response)
  recordGeminiUsage({
    feature,
    model: modelName,
    ...usage,
  })
  return response.text()
}

export async function generateGeminiText(
  prompt: string,
  apiKey?: string,
  options?: GeminiRequestOptions
): Promise<string> {
  const baseModel = resolveModelName(options?.feature)
  try {
    return await generateTextOnce(prompt, baseModel, apiKey, options?.feature)
  } catch (error) {
    if (!shouldRetryWithEscalation(options?.feature, options?.enableAutoRetryEscalation)) throw error
    const retryModel = getEscalatedModel(baseModel)
    if (!retryModel) throw error
    return generateTextOnce(prompt, retryModel, apiKey, options?.feature)
  }
}

export interface InlineImagePart {
  mimeType: string
  data: string
}

export async function generateGeminiTextFromImageAndPrompt(
  prompt: string,
  image: InlineImagePart,
  apiKey?: string,
  options?: GeminiRequestOptions
): Promise<string> {
  const feature = options?.feature
  const baseModel = resolveModelName(feature)
  const runOnce = async (modelName: GeminiModelId) => {
    const model = getModel(modelName, apiKey)
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: image.mimeType, data: image.data } },
    ])
    const response = result.response
    const usage = extractUsageMetadata(response)
    recordGeminiUsage({
      feature,
      model: modelName,
      ...usage,
    })
    return response.text()
  }

  try {
    return await runOnce(baseModel)
  } catch (error) {
    if (!shouldRetryWithEscalation(feature, options?.enableAutoRetryEscalation)) throw error
    const retryModel = getEscalatedModel(baseModel)
    if (!retryModel) throw error
    return runOnce(retryModel)
  }
}
