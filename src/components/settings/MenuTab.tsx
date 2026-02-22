import { useState, useEffect } from 'react'
import { Eye, EyeOff, Lock, Unlock, Wifi, WifiOff } from 'lucide-react'
import { MealPlanSettings } from '../MealPlanSettings'
import { generateGeminiText } from '../../lib/geminiClient'

const STORAGE_KEY = 'gemini_api_key'

export function MenuTab() {
  const [apiKey, setApiKey] = useState('')
  const [isLocked, setIsLocked] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [confirmSave, setConfirmSave] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || ''
    setApiKey(stored)
  }, [])

  const maskedKey = apiKey
    ? `${apiKey.slice(0, 6)}${'•'.repeat(Math.max(0, apiKey.length - 10))}${apiKey.slice(-4)}`
    : ''

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
      const text = await generateGeminiText('hello', key)
      if (text) {
        setTestStatus('success')
      } else {
        throw new Error('レスポンスが空です')
      }
    } catch {
      setTestStatus('error')
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  return (
    <>
      <MealPlanSettings />

      {/* API Key Section */}
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
