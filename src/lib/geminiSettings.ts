export type GeminiModelId = 'gemini-2.0-flash-lite' | 'gemini-2.0-flash' | 'gemini-2.5-flash'

export type GeminiFeatureKey =
  | 'chat'
  | 'recipe_import_text'
  | 'recipe_import_url'
  | 'image_ingredient_extract'
  | 'stock_recipe_suggest'
  | 'weekly_menu_refine'

export interface GeminiFeatureModelConfig {
  models: Partial<Record<GeminiFeatureKey, GeminiModelId>>
  retryEscalationForUrlAndImage: boolean
  estimatedDailyLimit: number
}

export interface GeminiUsageDayStats {
  dayKey: string
  requestCount: number
  byFeature: Partial<Record<GeminiFeatureKey, number>>
  byModel: Partial<Record<GeminiModelId, number>>
  tokenTotals: {
    prompt: number
    candidates: number
    total: number
  }
}

const SETTINGS_KEY = 'gemini_feature_model_config_v1'
const USAGE_KEY = 'gemini_usage_stats_v1'

export const GEMINI_MODEL_OPTIONS: Array<{
  id: GeminiModelId
  label: string
  tierLabel: string
  description: string
}> = [
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash-Lite',
    tierLabel: '軽量 / 節約向け',
    description: '安く速く試したい用途向け。会話や簡易解析に。',
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    tierLabel: '標準 / バランス',
    description: '品質とコストのバランス重視。画像・構造化生成に。',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    tierLabel: '高精度 / 消費増',
    description: '難しい解析や失敗時の再試行向け。',
  },
]

export const GEMINI_FEATURE_LABELS: Record<GeminiFeatureKey, string> = {
  chat: '質問機能',
  recipe_import_text: 'テキスト解析',
  recipe_import_url: 'URL解析',
  image_ingredient_extract: '画像解析（食材抽出）',
  stock_recipe_suggest: '在庫から料理提案',
  weekly_menu_refine: '週間献立AI調整',
}

const DEFAULT_MODELS: Record<GeminiFeatureKey, GeminiModelId> = {
  chat: 'gemini-2.0-flash-lite',
  recipe_import_text: 'gemini-2.0-flash-lite',
  recipe_import_url: 'gemini-2.0-flash-lite',
  image_ingredient_extract: 'gemini-2.0-flash',
  stock_recipe_suggest: 'gemini-2.0-flash',
  weekly_menu_refine: 'gemini-2.0-flash-lite',
}

export const DEFAULT_GEMINI_FEATURE_CONFIG: GeminiFeatureModelConfig = {
  models: { ...DEFAULT_MODELS },
  retryEscalationForUrlAndImage: true,
  estimatedDailyLimit: 40,
}

export function getDefaultModelForFeature(feature: GeminiFeatureKey): GeminiModelId {
  return DEFAULT_MODELS[feature]
}

export function getGeminiFeatureConfig(): GeminiFeatureModelConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_GEMINI_FEATURE_CONFIG
    const parsed = JSON.parse(raw) as Partial<GeminiFeatureModelConfig>
    return {
      models: { ...DEFAULT_GEMINI_FEATURE_CONFIG.models, ...(parsed.models ?? {}) },
      retryEscalationForUrlAndImage:
        typeof parsed.retryEscalationForUrlAndImage === 'boolean'
          ? parsed.retryEscalationForUrlAndImage
          : DEFAULT_GEMINI_FEATURE_CONFIG.retryEscalationForUrlAndImage,
      estimatedDailyLimit:
        typeof parsed.estimatedDailyLimit === 'number' && Number.isFinite(parsed.estimatedDailyLimit)
          ? Math.max(1, Math.min(9999, Math.round(parsed.estimatedDailyLimit)))
          : DEFAULT_GEMINI_FEATURE_CONFIG.estimatedDailyLimit,
    }
  } catch {
    return DEFAULT_GEMINI_FEATURE_CONFIG
  }
}

export function setGeminiFeatureConfig(config: GeminiFeatureModelConfig): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(config))
}

export function getSelectedModelForFeature(feature: GeminiFeatureKey): GeminiModelId {
  const config = getGeminiFeatureConfig()
  return config.models[feature] ?? getDefaultModelForFeature(feature)
}

export function getTodayUsageStats(): GeminiUsageDayStats {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    if (!raw) throw new Error('missing')
    const parsed = JSON.parse(raw) as Partial<GeminiUsageDayStats>
    if (parsed.dayKey !== today) throw new Error('stale')
    return {
      dayKey: today,
      requestCount: Number(parsed.requestCount ?? 0),
      byFeature: parsed.byFeature ?? {},
      byModel: parsed.byModel ?? {},
      tokenTotals: {
        prompt: Number(parsed.tokenTotals?.prompt ?? 0),
        candidates: Number(parsed.tokenTotals?.candidates ?? 0),
        total: Number(parsed.tokenTotals?.total ?? 0),
      },
    }
  } catch {
    return {
      dayKey: today,
      requestCount: 0,
      byFeature: {},
      byModel: {},
      tokenTotals: { prompt: 0, candidates: 0, total: 0 },
    }
  }
}

export function recordGeminiUsage(params: {
  feature?: GeminiFeatureKey
  model: GeminiModelId
  promptTokens?: number
  candidateTokens?: number
  totalTokens?: number
}): GeminiUsageDayStats {
  const current = getTodayUsageStats()
  current.requestCount += 1
  if (params.feature) {
    current.byFeature[params.feature] = (current.byFeature[params.feature] ?? 0) + 1
  }
  current.byModel[params.model] = (current.byModel[params.model] ?? 0) + 1
  current.tokenTotals.prompt += Math.max(0, params.promptTokens ?? 0)
  current.tokenTotals.candidates += Math.max(0, params.candidateTokens ?? 0)
  current.tokenTotals.total += Math.max(0, params.totalTokens ?? 0)
  localStorage.setItem(USAGE_KEY, JSON.stringify(current))
  return current
}

export function getEscalatedModel(model: GeminiModelId): GeminiModelId | null {
  if (model === 'gemini-2.0-flash-lite') return 'gemini-2.0-flash'
  if (model === 'gemini-2.0-flash') return 'gemini-2.5-flash'
  return null
}

export function supportsAutoRetryEscalation(feature?: GeminiFeatureKey): boolean {
  return feature === 'recipe_import_url' || feature === 'image_ingredient_extract'
}
