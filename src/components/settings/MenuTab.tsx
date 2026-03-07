import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Eye, EyeOff, Lock, Unlock, Wifi, WifiOff, Gauge, RotateCcw, Sparkles } from 'lucide-react'
import { MealPlanSettings } from '../MealPlanSettings'
import { generateGeminiText } from '../../lib/geminiClient'
import { usePreferences } from '../../hooks/usePreferences'
import { StatusNotice } from '../StatusNotice'
import {
  cacheGeminiApiKeyForSession,
  getCachedGeminiApiKey,
  getLegacyPlaintextGeminiApiKey,
  hasEncryptedGeminiApiKey,
  hasLegacyPlaintextGeminiApiKey,
  saveEncryptedGeminiApiKey,
  unlockEncryptedGeminiApiKey,
} from '../../lib/geminiKeyVault'
import {
  DEFAULT_GEMINI_FEATURE_CONFIG,
  GEMINI_FEATURE_LABELS,
  GEMINI_MODEL_OPTIONS,
  getGeminiFeatureConfigFromPreferences,
  getGeminiFeaturePreferenceUpdates,
  getTodayUsageStats,
  type GeminiFeatureKey,
  type GeminiFeatureModelConfig,
  type GeminiModelId,
} from '../../lib/geminiSettings'
import { getGeminiIntegrationStatus } from '../../lib/integrationStatus'

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
  const { preferences, updatePreferences } = usePreferences()
  const credentialsSectionRef = useRef<HTMLDivElement>(null)
  const modelsSectionRef = useRef<HTMLDivElement>(null)
  const usageSectionRef = useRef<HTMLDivElement>(null)
  const [apiKey, setApiKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [unlockPassphrase, setUnlockPassphrase] = useState('')
  const [isLocked, setIsLocked] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [vaultStatus, setVaultStatus] = useState<'idle' | 'saving' | 'unlocking' | 'saved' | 'unlocked' | 'error'>('idle')
  const [vaultMessage, setVaultMessage] = useState('')
  const [hasEncryptedKey, setHasEncryptedKey] = useState(() => hasEncryptedGeminiApiKey())
  const [hasLegacyKey, setHasLegacyKey] = useState(() => hasLegacyPlaintextGeminiApiKey())
  const [confirmSave, setConfirmSave] = useState(false)
  const [featureConfig, setFeatureConfigState] = useState<GeminiFeatureModelConfig>(() => getGeminiFeatureConfigFromPreferences(preferences))
  const [usageStats, setUsageStats] = useState(() => getTodayUsageStats())

  useEffect(() => {
    const cached = getCachedGeminiApiKey()
    const legacy = getLegacyPlaintextGeminiApiKey()
    setApiKey(cached || legacy || '')
    setHasEncryptedKey(hasEncryptedGeminiApiKey())
    setHasLegacyKey(hasLegacyPlaintextGeminiApiKey())
    setUsageStats(getTodayUsageStats())
  }, [])

  useEffect(() => {
    setFeatureConfigState(getGeminiFeatureConfigFromPreferences(preferences))
  }, [preferences])

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

  const geminiStatus = useMemo(
    () => getGeminiIntegrationStatus(featureConfig.estimatedDailyLimit, {
      isBusy: vaultStatus === 'saving' || vaultStatus === 'unlocking' || testStatus === 'testing',
      lastError: vaultStatus === 'error'
        ? vaultMessage || 'Gemini の鍵処理でエラーが発生しました。'
        : testStatus === 'error'
          ? '接続テストに失敗しました。APIキー、接続状況、利用制限を確認してください。'
          : null,
    }),
    [featureConfig.estimatedDailyLimit, testStatus, vaultMessage, vaultStatus]
  )

  const scrollToSection = (ref: RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleGeminiStatusAction = () => {
    switch (geminiStatus.actionId) {
      case 'open-gemini-settings':
      case 'unlock-gemini-key':
      case 'encrypt-gemini-key':
        handleUnlock()
        scrollToSection(credentialsSectionRef)
        return
      case 'open-gemini-models':
        scrollToSection(modelsSectionRef)
        return
      case 'open-gemini-usage':
        scrollToSection(usageSectionRef)
        return
      default:
        break
    }
  }

  const handleUnlock = () => {
    setIsLocked(false)
    setShowKey(true)
    setVaultMessage('')
  }

  const handleSave = () => {
    if (!confirmSave) {
      setConfirmSave(true)
      return
    }
    setVaultStatus('saving')
    setVaultMessage('')
    void saveEncryptedGeminiApiKey(apiKey, passphrase)
      .then(() => {
        cacheGeminiApiKeyForSession(apiKey.trim())
        setHasEncryptedKey(true)
        setHasLegacyKey(false)
        setVaultStatus('saved')
        setVaultMessage('APIキーを暗号化して保存しました')
        setIsLocked(true)
        setShowKey(false)
        setConfirmSave(false)
      })
      .catch((err) => {
        setVaultStatus('error')
        setVaultMessage(err instanceof Error ? err.message : 'APIキーの暗号化保存に失敗しました')
      })
  }

  const handleCancel = () => {
    const cached = getCachedGeminiApiKey()
    const legacy = getLegacyPlaintextGeminiApiKey()
    setApiKey(cached || legacy || '')
    setIsLocked(true)
    setShowKey(false)
    setConfirmSave(false)
    setVaultMessage('')
    setPassphrase('')
  }

  const handleUnlockEncryptedKey = async () => {
    setVaultStatus('unlocking')
    setVaultMessage('')
    try {
      const key = await unlockEncryptedGeminiApiKey(unlockPassphrase)
      setApiKey(key)
      setVaultStatus('unlocked')
      setVaultMessage('暗号化保存されたAPIキーを復号しました（このセッションで利用可能）')
    } catch (err) {
      setVaultStatus('error')
      setVaultMessage(err instanceof Error ? err.message : '復号に失敗しました')
    }
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
    void updatePreferences(getGeminiFeaturePreferenceUpdates(next))
  }

  const updateRetryEscalation = (enabled: boolean) => {
    const next = { ...featureConfig, retryEscalationForUrlAndImage: enabled }
    setFeatureConfigState(next)
    void updatePreferences(getGeminiFeaturePreferenceUpdates(next))
  }

  const updateEstimatedDailyLimit = (value: number) => {
    const next = {
      ...featureConfig,
      estimatedDailyLimit: Math.max(1, Math.min(9999, Math.round(value || 1))),
    }
    setFeatureConfigState(next)
    void updatePreferences(getGeminiFeaturePreferenceUpdates(next))
  }

  const resetAiConfig = () => {
    setFeatureConfigState(DEFAULT_GEMINI_FEATURE_CONFIG)
    void updatePreferences(getGeminiFeaturePreferenceUpdates(DEFAULT_GEMINI_FEATURE_CONFIG))
  }

  return (
    <>
      <MealPlanSettings />

      <StatusNotice
        tone={geminiStatus.tone}
        title={geminiStatus.title}
        message={geminiStatus.message}
        actionLabel={geminiStatus.actionLabel}
        onAction={geminiStatus.actionLabel ? handleGeminiStatusAction : undefined}
        icon={<Sparkles className="h-4 w-4" />}
        className="mb-4"
      />

      <div ref={credentialsSectionRef} className="ui-panel">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-text-secondary">Gemini API（AI連携機能）の設定</h4>
          <button
            onClick={isLocked ? handleUnlock : () => setIsLocked(true)}
            className="ui-btn ui-btn-secondary flex min-h-[38px] items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
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
          <div className="ui-panel-muted flex items-center gap-2">
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
                onChange={(e) => { setApiKey(e.target.value); setConfirmSave(false); setVaultMessage('') }}
                placeholder="APIキーを入力..."
                className="ui-input w-full pr-10 font-mono"
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
                className="ui-btn ui-btn-secondary flex-1"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={vaultStatus === 'saving'}
                className={`ui-btn flex-1 text-white ${confirmSave
                  ? 'bg-error'
                  : 'ui-btn-primary'
                  }`}
              >
                {vaultStatus === 'saving' ? '暗号化中...' : confirmSave ? '本当に保存しますか？' : '暗号化して保存'}
              </button>
            </div>

            <div className="ui-panel-muted p-3">
              <label className="mb-1 block text-xs font-bold text-text-secondary">
                保存用パスフレーズ（8文字以上）
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setConfirmSave(false) }}
                placeholder="パスフレーズを入力..."
                className="ui-input w-full"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">
                APIキーはこのパスフレーズでWebCrypto暗号化して端末内に保存されます。パスフレーズを忘れると復号できません。
              </p>
            </div>
          </div>
        )}

        {(hasEncryptedKey || hasLegacyKey) && (
          <div className="ui-panel-muted mt-3 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-text-secondary">保存状態</p>
              <span className="text-[11px] text-text-secondary">
                {hasEncryptedKey ? '暗号化保存あり' : hasLegacyKey ? '旧形式（平文）' : '未保存'}
              </span>
            </div>
            {hasEncryptedKey && (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={unlockPassphrase}
                  onChange={(e) => setUnlockPassphrase(e.target.value)}
                  placeholder="復号パスフレーズ"
                  className="ui-input flex-1 px-3 py-2 text-sm"
                />
                <button
                  onClick={handleUnlockEncryptedKey}
                  disabled={vaultStatus === 'unlocking'}
                  className="ui-btn ui-btn-secondary px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {vaultStatus === 'unlocking' ? '復号中...' : '復号'}
                </button>
              </div>
            )}
            {hasLegacyKey && !hasEncryptedKey && (
              <p className="text-[11px] leading-relaxed text-yellow-300">
                旧形式の平文保存APIキーが見つかりました。編集を開いて「暗号化して保存」で移行してください。
              </p>
            )}
          </div>
        )}

        {vaultMessage && (
          <p className={`mt-2 text-xs ${vaultStatus === 'error' ? 'text-red-400' : 'text-text-secondary'}`}>
            {vaultMessage}
          </p>
        )}

        <button
          onClick={handleTest}
          disabled={!apiKey.trim() || testStatus === 'testing'}
          className="ui-btn ui-btn-secondary mt-3 flex w-full items-center justify-center gap-2 text-sm font-semibold disabled:opacity-30"
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

      <div ref={modelsSectionRef} className="ui-panel">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-bold text-text-secondary">AIモデル設定（機能ごと）</h4>
          </div>
          <button
            onClick={resetAiConfig}
            className="ui-btn ui-btn-secondary flex min-h-[34px] items-center gap-1 px-2 py-1.5 text-xs"
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
            <div key={row.feature} className="ui-panel-muted p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{row.label}</p>
                  <p className="text-[11px] text-text-secondary">今日の推定利用: {row.count}回</p>
                </div>
                <span className="rounded-md bg-bg-primary/50 px-2 py-1 text-[10px] font-bold text-text-secondary">
                  {modelCaption(row.modelId)}
                </span>
              </div>
              <select
                value={row.modelId}
                onChange={(e) => updateFeatureModel(row.feature, e.target.value as GeminiModelId)}
                className="ui-input w-full"
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

        <label className="ui-panel-muted mt-4 flex cursor-pointer items-start gap-3">
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

      <div ref={usageSectionRef} className="ui-panel">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-bold text-text-secondary">AI推定使用量（今日）</h4>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="ui-stat-card">
            <p className="text-xs text-text-secondary">推定利用回数</p>
            <p className="mt-1 text-lg font-bold text-text-primary">{usageStats.requestCount}回</p>
          </div>
          <div className="ui-stat-card">
            <p className="text-xs text-text-secondary">推定残り回数</p>
            <p className="mt-1 text-lg font-bold text-accent">{estimatedRemaining}回</p>
          </div>
        </div>

        <div className="ui-panel-muted mt-3 p-3">
          <label className="mb-1 block text-xs font-bold text-text-secondary">1日の目安上限（推定残量の計算用）</label>
          <input
            type="number"
            min={1}
            max={9999}
            value={featureConfig.estimatedDailyLimit}
            onChange={(e) => updateEstimatedDailyLimit(Number(e.target.value))}
            className="ui-input w-full"
          />
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            この数値はアプリ内の目安です。公式の無料枠残量を直接取得しているわけではありません。
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {modelUsageRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-lg border border-border-soft bg-bg-card-hover px-3 py-2 text-xs">
              <span className="text-text-primary">{row.label}</span>
              <span className="font-bold text-text-secondary">{row.count}回</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-inline-note">
        <p className="text-xs text-text-secondary leading-relaxed">
          APIキーはユーザーパスフレーズを用いてWebCryptoで暗号化した上で端末のローカルストレージに保存され、Google Drive バックアップには含まれません。
          <code className="mx-1 rounded bg-bg-primary/50 px-1 py-0.5 text-[10px]">.env</code>
          ファイルにキーが設定されている場合はそちらが優先されます。
        </p>
      </div>
    </>
  )
}
