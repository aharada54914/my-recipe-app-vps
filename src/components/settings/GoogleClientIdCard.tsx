import { useState } from 'react'
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react'

const GOOGLE_CLIENT_ID_KEY = 'google_client_id'

export function GoogleClientIdCard() {
  const [googleClientId, setGoogleClientId] = useState(
    () => localStorage.getItem(GOOGLE_CLIENT_ID_KEY) ?? ''
  )
  const [isGoogleIdLocked, setIsGoogleIdLocked] = useState(true)
  const [showGoogleId, setShowGoogleId] = useState(false)
  const [confirmGoogleSave, setConfirmGoogleSave] = useState(false)

  const maskedGoogleId = googleClientId
    ? `${googleClientId.slice(0, 6)}${'•'.repeat(Math.max(0, googleClientId.length - 10))}${googleClientId.slice(-4)}`
    : ''

  const handleGoogleUnlock = () => {
    setIsGoogleIdLocked(false)
    setShowGoogleId(true)
  }

  const handleGoogleSave = () => {
    if (!confirmGoogleSave) {
      setConfirmGoogleSave(true)
      return
    }
    localStorage.setItem(GOOGLE_CLIENT_ID_KEY, googleClientId.trim())
    window.dispatchEvent(new Event('storage'))
    setIsGoogleIdLocked(true)
    setShowGoogleId(false)
    setConfirmGoogleSave(false)
  }

  const handleGoogleCancel = () => {
    const stored = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || ''
    setGoogleClientId(stored)
    setIsGoogleIdLocked(true)
    setShowGoogleId(false)
    setConfirmGoogleSave(false)
  }

  return (
    <div className="ui-panel">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-text-secondary">Google Client ID（詳細設定）</h4>
        <button
          onClick={isGoogleIdLocked ? handleGoogleUnlock : () => setIsGoogleIdLocked(true)}
          className="ui-btn ui-btn-secondary flex min-h-[38px] items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
        >
          {isGoogleIdLocked ? (
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

      {isGoogleIdLocked ? (
        <div className="ui-panel-muted flex items-center gap-2">
          <span className="flex-1 font-mono text-sm text-text-secondary">
            {googleClientId ? maskedGoogleId : '未設定'}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showGoogleId ? 'text' : 'password'}
              value={googleClientId}
              onChange={(e) => { setGoogleClientId(e.target.value); setConfirmGoogleSave(false) }}
              placeholder="Google Client ID を入力..."
              className="ui-input w-full pr-10 font-mono"
            />
            <button
              onClick={() => setShowGoogleId(!showGoogleId)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent"
            >
              {showGoogleId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGoogleCancel}
              className="ui-btn ui-btn-secondary flex-1"
            >
              キャンセル
            </button>
            <button
              onClick={handleGoogleSave}
              className={`ui-btn flex-1 text-white ${confirmGoogleSave ? 'bg-error' : 'ui-btn-primary'}`}
            >
              {confirmGoogleSave ? '本当に保存しますか？' : '保存'}
            </button>
          </div>
        </div>
      )}

      <div className="ui-inline-note mt-3">
        <p className="text-xs leading-relaxed text-text-secondary">
          Google Client ID は配布環境や検証環境ごとの設定です。通常利用では環境変数で供給する想定で、Google Drive バックアップにも含まれません。
        </p>
      </div>
    </div>
  )
}
