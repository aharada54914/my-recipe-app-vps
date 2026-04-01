import { GoogleGenerativeAI } from '@google/generative-ai'

export type GeminiProvider = 'generic' | 'photo' | 'advice'

export interface GeminiProviderResult {
  text: string
  provider: GeminiProvider
  modelName: string
  projectId?: string
  usedFallback: boolean
}

type GeminiProviderConfig = {
  provider: GeminiProvider
  apiKey: string | null
  projectId?: string
  primaryModel: string
  fallbackModel?: string
}

type AlertThresholdProvider = Extract<GeminiProvider, 'photo' | 'advice'>

const DEFAULT_MODELS = {
  genericText: 'gemini-2.0-flash-lite',
  genericImage: 'gemini-2.0-flash',
  photoPrimary: 'gemini-2.0-flash-lite',
  photoFallback: 'gemini-2.5-flash-lite',
  advicePrimary: 'gemini-2.5-flash',
  adviceFallback: 'gemini-2.5-flash-lite',
} as const

const genAiCache = new Map<string, GoogleGenerativeAI>()
const providerFailures = new Map<AlertThresholdProvider, number[]>()

function getEnv(name: string): string | undefined {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function getGenAI(apiKey: string): GoogleGenerativeAI {
  const cached = genAiCache.get(apiKey)
  if (cached) return cached
  const client = new GoogleGenerativeAI(apiKey)
  genAiCache.set(apiKey, client)
  return client
}

function resolveProviderConfig(provider: GeminiProvider, modelName?: string): GeminiProviderConfig {
  if (provider === 'photo') {
    return {
      provider,
      apiKey: getEnv('GEMINI_PHOTO_API_KEY') ?? getEnv('GEMINI_API_KEY') ?? null,
      projectId: getEnv('GEMINI_PHOTO_PROJECT_ID'),
      primaryModel: modelName ?? getEnv('GEMINI_MODEL_PHOTO_PRIMARY') ?? DEFAULT_MODELS.photoPrimary,
      fallbackModel: getEnv('GEMINI_MODEL_PHOTO_FALLBACK') ?? DEFAULT_MODELS.photoFallback,
    }
  }

  if (provider === 'advice') {
    return {
      provider,
      apiKey: getEnv('GEMINI_ADVICE_API_KEY') ?? getEnv('GEMINI_API_KEY') ?? null,
      projectId: getEnv('GEMINI_ADVICE_PROJECT_ID'),
      primaryModel: modelName ?? getEnv('GEMINI_MODEL_ADVICE_PRIMARY') ?? DEFAULT_MODELS.advicePrimary,
      fallbackModel: getEnv('GEMINI_MODEL_ADVICE_FALLBACK') ?? DEFAULT_MODELS.adviceFallback,
    }
  }

  return {
    provider,
    apiKey: getEnv('GEMINI_API_KEY') ?? null,
    primaryModel: modelName ?? DEFAULT_MODELS.genericText,
    fallbackModel: undefined,
  }
}

function isQuotaOrTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('429')
    || message.includes('quota')
    || message.includes('rate limit')
    || message.includes('resource exhausted')
    || message.includes('temporarily unavailable')
    || message.includes('deadline exceeded')
    || message.includes('timed out')
  )
}

function getAlertThreshold(provider: AlertThresholdProvider): number {
  const value = provider === 'photo'
    ? getEnv('GEMINI_PHOTO_ERROR_THRESHOLD')
    : getEnv('GEMINI_ADVICE_ERROR_THRESHOLD')
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5
}

function getAlertWindowMs(): number {
  const parsed = Number(getEnv('GEMINI_RATE_LIMIT_WINDOW_MINUTES'))
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : 10
  return minutes * 60_000
}

async function sendGeminiAlert(provider: AlertThresholdProvider, message: string): Promise<void> {
  const webhook = getEnv('GEMINI_ALERT_WEBHOOK_URL')
  if (!webhook) return

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `[gemini:${provider}] ${message}`,
      }),
    })
    if (!response.ok) {
      console.error('[gemini:alert]', { provider, status: response.status, message: 'Failed to deliver webhook alert' })
    }
  } catch (error) {
    console.error('[gemini:alert]', {
      provider,
      message: 'Failed to send webhook alert',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function recordProviderFailure(provider: GeminiProvider, error: unknown, modelName: string, projectId?: string): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[gemini:failure]', { provider, modelName, projectId, message })

  if (provider !== 'photo' && provider !== 'advice') return

  const now = Date.now()
  const windowMs = getAlertWindowMs()
  const failures = (providerFailures.get(provider) ?? []).filter((timestamp) => now - timestamp < windowMs)
  failures.push(now)
  providerFailures.set(provider, failures)

  if (failures.length >= getAlertThreshold(provider)) {
    providerFailures.set(provider, [])
    await sendGeminiAlert(
      provider,
      `${failures.length} failures within ${Math.round(windowMs / 60000)} minutes. latest="${message}" model=${modelName}${projectId ? ` project=${projectId}` : ''}`,
    )
  }
}

async function generateWithProvider(params: {
  provider: GeminiProvider
  modelName?: string
  prompt: string
  image?: InlineImagePart
}): Promise<GeminiProviderResult> {
  const config = resolveProviderConfig(params.provider, params.modelName)
  if (!config.apiKey) {
    const envHint = params.provider === 'photo'
      ? 'GEMINI_PHOTO_API_KEY'
      : params.provider === 'advice'
        ? 'GEMINI_ADVICE_API_KEY'
        : 'GEMINI_API_KEY'
    throw new Error(`${envHint} environment variable is required`)
  }

  const ai = getGenAI(config.apiKey)
  const attempt = async (modelName: string): Promise<string> => {
    const model = ai.getGenerativeModel({ model: modelName })
    const result = params.image
      ? await model.generateContent([
        { text: params.prompt },
        { inlineData: { mimeType: params.image.mimeType, data: params.image.data } },
      ])
      : await model.generateContent(params.prompt)
    return result.response.text()
  }

  try {
    return {
      text: await attempt(config.primaryModel),
      provider: config.provider,
      modelName: config.primaryModel,
      ...(config.projectId ? { projectId: config.projectId } : {}),
      usedFallback: false,
    }
  } catch (primaryError) {
    await recordProviderFailure(config.provider, primaryError, config.primaryModel, config.projectId)
    if (!config.fallbackModel || !isQuotaOrTransientError(primaryError)) {
      throw primaryError
    }

    try {
      return {
        text: await attempt(config.fallbackModel),
        provider: config.provider,
        modelName: config.fallbackModel,
        ...(config.projectId ? { projectId: config.projectId } : {}),
        usedFallback: true,
      }
    } catch (fallbackError) {
      await recordProviderFailure(config.provider, fallbackError, config.fallbackModel, config.projectId)
      throw fallbackError
    }
  }
}

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

export function extractJsonObjectText(text: string): string {
  const stripped = stripCodeFences(text)
  const match = stripped.match(/\{[\s\S]*\}/)
  return match ? match[0] : stripped
}

export async function generateGeminiText(
  prompt: string,
  modelName = DEFAULT_MODELS.genericText,
  provider: GeminiProvider = 'generic',
): Promise<string> {
  const result = await generateWithProvider({ prompt, modelName, provider })
  return result.text
}

export interface ConsultationContext {
  todayMenuTitle?: string
  sideMenuTitle?: string
  stockItems?: Array<{ name: string; inStock: boolean }>
  userPrompt?: string
  requestedServings?: number
  history?: Array<{ actor: 'user' | 'assistant'; content: string }>
  guidance?: string
}

export async function askGeminiConsultation(
  message: string,
  context: ConsultationContext,
  provider: GeminiProvider = 'advice',
): Promise<string> {
  const systemParts: string[] = [
    'あなたは家庭料理のアドバイザーです。ホットクックやヘルシオを使った料理について相談を受けます。',
    '回答は簡潔に、日本語で、実用的なアドバイスを心がけてください。',
    '食材の代替案や調理のコツも積極的に提案してください。',
  ]

  if (context.todayMenuTitle) {
    systemParts.push(`今日の献立（主菜）: ${context.todayMenuTitle}`)
  }
  if (context.sideMenuTitle) {
    systemParts.push(`今日の献立（副菜）: ${context.sideMenuTitle}`)
  }
  if (context.stockItems && context.stockItems.length > 0) {
    const inStock = context.stockItems
      .filter(item => item.inStock)
      .map(item => item.name)
    if (inStock.length > 0) {
      systemParts.push(`在庫がある食材: ${inStock.join('、')}`)
    }
  }
  if (context.userPrompt) {
    systemParts.push(`ユーザーの食の好み・制限: ${context.userPrompt}`)
  }
  if (context.requestedServings) {
    systemParts.push(`今回の想定人数: ${context.requestedServings}人分`)
  }
  if (context.guidance) {
    systemParts.push(`追加ガイダンス: ${context.guidance}`)
  }
  if (context.history && context.history.length > 0) {
    const historyText = context.history
      .slice(-6)
      .map((entry) => `${entry.actor === 'user' ? 'ユーザー' : 'アシスタント'}: ${entry.content}`)
      .join('\n')
    systemParts.push(`直近の会話:\n${historyText}`)
  }

  const systemPrompt = systemParts.join('\n')
  const fullPrompt = `${systemPrompt}\n\nユーザーの質問: ${message}`
  const result = await generateWithProvider({ prompt: fullPrompt, provider })
  return result.text
}

export interface InlineImagePart {
  mimeType: string
  data: string
}

export async function generateGeminiTextFromImageAndPrompt(
  prompt: string,
  image: InlineImagePart,
  modelName?: string,
  provider: GeminiProvider = 'photo',
): Promise<string> {
  const result = await generateWithProvider({
    prompt,
    image,
    modelName,
    provider,
  })
  return result.text
}
