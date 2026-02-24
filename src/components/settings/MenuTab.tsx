import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Lock, Unlock, Wifi, WifiOff, Gauge, RotateCcw, Sparkles } from 'lucide-react'
import { MealPlanSettings } from '../MealPlanSettings'
import { generateGeminiText } from '../../lib/geminiClient'
import {
  DEFAULT_GEMINI_FEATURE_CONFIG,
  GEMINI_FEATURE_LABELS,
  GEMINI_MODEL_OPTIONS,
  getGeminiFeatureConfig,
  getTodayUsageStats,
  setGeminiFeatureConfig,
  type GeminiFeatureKey,
  type GeminiFeatureModelConfig,
  type GeminiModelId,
} from '../../lib/geminiSettings'

const STORAGE_KEY = 'gemini_api_key'

const FEATURE_ORDER: GeminiFeatureKey[] = [
  'chat',
  'recipe_import_text',
  'recipe_import_url',
  'image_ingredient_extract',
  'stock_recipe_suggest',
  'weekly_menu_refine',
]

function modelCaption(modelId: GeminiModelId): string {
  return GEMINI_MODEL_OPTIONS.find((option) => option.id === modelId)?.tierLabel ?? ''
}

export function MenuTab() {
  const [apiKey, setApiKey] = useState('')
  const [isLocked, setIsLocked] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [confirmSave, setConfirmSave] = useState(false)
  const [featureConfig, setFeatureConfigState] = useState<GeminiFeatureModelConfig>(() => getGeminiFeatureConfig())
  const [usageStats, setUsageStats] = useState(() => getTodayUsageStats())

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || ''
    setApiKey(stored)
    setFeatureConfigState(getGeminiFeatureConfig())
    setUsageStats(getTodayUsageStats())
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setUsageStats(getTodayUsageStats())
    }, 3000)
    return () => window.clearInterval(interval)
  }, [])

  const maskedKey = apiKey
    ? `${apiKey.slice(0, 6)}${'•'.repeat(Math.max(0, apiKey.length - 10))}${apiKey.slice(-4)}`
    : ''

  const estimatedRemaining = Math.max(0, featureConfig.estimatedDailyLimit - usageStats.requestCount)

  const modelUsageRows = useMemo(
    () => GEMINI_MODEL_OPTIONS.map((option) => ({
      ...option,
      count: usageStats.byModel[option.id] ?? 0,
    })),
    [usageStats.byModel]
  )

  const featureUsageRows = useMemo(
    () => FEATURE_ORDER.map((feature) => ({
      feature,
      label: GEMINI_FEATURE_LABELS[feature],
      count: usageStats.byFeature[feature] ?? 0,
      modelId: (featureConfig.models[feature] ?? DEFAULT_GEMINI_FEATURE_CONFIG.models[feature]) as GeminiModelId,
    })),
    [featureConfig.models, usageStats.byFeature]
  )

  const handleUnlock = () => {
    setIsLocked(false)
    setShowKey(true)
  }

  const handleSave = () => {
    if (!confirmSave) {
      setConfirmSave(true)
      return
    }
    localStorage.setItem(STORAGE_KEY, apiKey.trim())
    setIsLocked(true)
    setShowKey(false)
    setConfirmSave(false)
  }

  const handleCancel = () => {
    const stored = localStorage.getItem(STORAGE_KEY) || ''
    setApiKey(stored)
    setIsLocked(true)
    setShowKey(false)
    setConfirmSave(false)
  }

  const handleTest = async () => {
    setTestStatus('testing')
    try {
      const key = apiKey.trim()
      if (!key) throw new Error('APIキーが空です')
      const text = await generateGeminiText('料理の一言アドバイスを1文だけ返して', key, { feature: 'chat' })
      if (text) {
        setTestStatus('success')
        setUsageStats(getTodayUsageStats())
      } else {
        throw new Error('レスポンスが空です')
      }
    } catch {
      setTestStatus('error')
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  const updateFeatureModel = (feature: GeminiFeatureKey, modelId: GeminiModelId) => {
    const next = {
      ...featureConfig,
      models: { ...featureConfig.models, [feature]: modelId },
    }
    setFeatureConfigState(next)
    setGeminiFeatureConfig(next)
  }

  const updateRetryEscalation = (enabled: boolean) => {
    const next = { ...featureConfig, retryEscalationForUrlAndImage: enabled }
    setFeatureConfigState(next)
    setGeminiFeatureConfig(next)
  }

  const updateEstimatedDailyLimit = (value: number) => {
    const next = {
      ...featureConfig,
      estimatedDailyLimit: Math.max(1, Math.min(9999, Math.round(value || 1))),
    }
    setFeatureConfigState(next)
    setGeminiFeatureConfig(next)
  }

  const resetAiConfig = () => {
    setFeatureConfigState(DEFAULT_GEMINI_FEATURE_CONFIG)
    setGeminiFeatureConfig(DEFAULT_GEMINI_FEATURE_CONFIG)
  }

  return (
    <>
      <MealPlanSettings />

      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-text-secondary">Gemini API（AI連携機能）の設定</h4>
          <button
            onClick={isLocked ? handleUnlock : () => setIsLocked(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-accent"
          >
            {isLocked ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                ロック中
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5 text-accent" />
                編集中
              </>
            )}
          </button>
        </div>

        {isLocked ? (
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3">
            <span className="flex-1 text-sm text-text-secondary font-mono">
              {apiKey ? maskedKey : '未設定'}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setConfirmSave(false) }}
                placeholder="APIキーを入力..."
                className="w-full rounded-xl bg-white/5 px-4 py-3 pr-10 text-base text-text-primary font-mono placeholder:text-text-secondary outline-none ring-1 ring-accent/30"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors ${confirmSave
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-accent hover:bg-accent-hover'
                  }`}
              >
                {confirmSave ? '本当に保存しますか？' : '保存'}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={!apiKey.trim() || testStatus === 'testing'}
          className="ui-btn ui-btn-secondary mt-3 flex w-full items-center justify-center gap-2 text-sm font-semibold transition-colors hover:bg-white/10 hover:text-accent disabled:opacity-30"
        >
          {testStatus === 'testing' ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : testStatus === 'success' ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : testStatus === 'error' ? (
            <WifiOff className="h-4 w-4 text-red-400" />
          ) : (
            <Wifi className="h-4 w-4" />
          )}
          {testStatus === 'testing' ? '接続テスト中...'
            : testStatus === 'success' ? '✅ 接続成功'
              : testStatus === 'error' ? '❌ 接続失敗'
                : '接続テスト'
          }
        </button>
      </div>

      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-bold text-text-secondary">AIモデル設定（機能ごと）</h4>
          </div>
          <button
            onClick={resetAiConfig}
            className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs text-text-secondary hover:text-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            初期値に戻す
          </button>
        </div>

        <p className="mb-3 text-xs leading-relaxed text-text-secondary">
          軽量モデルは無料枠を節約しやすく、標準/高精度モデルは品質が上がる代わりに消費が増えやすくなります。
        </p>

        <div className="space-y-2">
          {featureUsageRows.map((row) => (
            <div key={row.feature} className="rounded-xl bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{row.label}</p>
                  <p className="text-[11px] text-text-secondary">今日の推定利用: {row.count}回</p>
                </div>
                <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-text-secondary">
                  {modelCaption(row.modelId)}
                </span>
              </div>
              <select
                value={row.modelId}
                onChange={(e) => updateFeatureModel(row.feature, e.target.value as GeminiModelId)}
                className="w-full rounded-xl bg-bg-card px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent"
              >
                {GEMINI_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}（{option.tierLabel}）
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 px-3 py-3">
          <input
            type="checkbox"
            checked={featureConfig.retryEscalationForUrlAndImage}
            onChange={(e) => updateRetryEscalation(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-accent focus:ring-accent"
          />
          <div>
            <p className="text-sm font-semibold text-text-primary">URL解析・画像解析の失敗時に上位モデルで再試行する</p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              解析の成功率は上がりますが、AIの利用回数（推定）が増える場合があります。
            </p>
          </div>
        </label>
      </div>

      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-bold text-text-secondary">AI推定使用量（今日）</h4>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-text-secondary">推定利用回数</p>
            <p className="mt-1 text-lg font-bold text-text-primary">{usageStats.requestCount}回</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-text-secondary">推定残り回数</p>
            <p className="mt-1 text-lg font-bold text-accent">{estimatedRemaining}回</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-white/5 p-3">
          <label className="mb-1 block text-xs font-bold text-text-secondary">1日の目安上限（推定残量の計算用）</label>
          <input
            type="number"
            min={1}
            max={9999}
            value={featureConfig.estimatedDailyLimit}
            onChange={(e) => updateEstimatedDailyLimit(Number(e.target.value))}
            className="w-full rounded-xl bg-bg-card px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent"
          />
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            この数値はアプリ内の目安です。公式の無料枠残量を直接取得しているわけではありません。
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {modelUsageRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
              <span className="text-text-primary">{row.label}</span>
              <span className="font-bold text-text-secondary">{row.count}回</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 px-4 py-3">
        <p className="text-xs text-text-secondary leading-relaxed">
          APIキーは端末のローカルストレージに保存されます。
          <code className="mx-1 rounded bg-white/10 px-1 py-0.5 text-[10px]">.env</code>
          ファイルにキーが設定されている場合はそちらが優先されます。
        </p>
      </div>
    </>
  )
}
