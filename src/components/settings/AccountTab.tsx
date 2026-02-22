import { useState } from 'react'
import {
  Eye, EyeOff, Lock, Unlock,
  LogIn, LogOut, User, HardDriveUpload, RefreshCw, Cloud,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useGoogleDriveSync } from '../../hooks/useGoogleDriveSync'

const GOOGLE_CLIENT_ID_KEY = 'google_client_id'

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'たった今'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  return `${Math.floor(hours / 24)}日前`
}

export function AccountTab() {
  const { user, loading: authLoading, isOAuthAvailable, signInWithGoogle, signOut } = useAuth()
  const { isBackingUp, isRestoring, lastBackupAt, backupNow, error: backupError } = useGoogleDriveSync()

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
    <div className="rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <User className="h-4 w-4 text-accent" />
        <h4 className="text-sm font-bold text-text-secondary">アカウントとデータのバックアップ</h4>
      </div>

      {authLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : user ? (
        <div className="space-y-3">
          {/* User info */}
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
            {user.picture ? (
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <Cloud className="h-5 w-5 text-green-400" />
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
              <p className="truncate text-xs text-text-secondary">{user.email}</p>
            </div>
          </div>

          {/* Backup status */}
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2.5">
            <HardDriveUpload className="h-4 w-4 text-text-secondary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-secondary">
                {isRestoring
                  ? 'Drive からデータを復元中...'
                  : isBackingUp
                    ? 'バックアップを保存中...'
                    : lastBackupAt
                      ? `最終バックアップ: ${formatTimeAgo(lastBackupAt)}`
                      : 'バックアップはまだ作成されていません'}
              </p>
              {backupError && (
                <p className="text-xs text-red-400 mt-0.5">{backupError}</p>
              )}
            </div>
          </div>

          {/* Backup now */}
          <button
            onClick={backupNow}
            disabled={isBackingUp || isRestoring}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-accent disabled:opacity-30"
          >
            <RefreshCw className={`h-4 w-4 ${isBackingUp ? 'animate-spin' : ''}`} />
            {isBackingUp ? 'バックアップを保存中...' : '今すぐ手動でバックアップする'}
          </button>

          {/* Sign out */}
          <button
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      ) : isOAuthAvailable || googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
        <div className="space-y-3">
          {isOAuthAvailable ? (
            <button
              onClick={signInWithGoogle}
              className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2 transition-colors hover:bg-accent-hover"
            >
              <LogIn className="h-4 w-4" />
              Googleでログイン
            </button>
          ) : (
            <div className="rounded-xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              Google Client ID は設定されていますが、GoogleOAuthProviderのロードが完了していないか、再読み込みが必要です。ページをリロードしてください。
            </div>
          )}
          <p className="text-xs text-text-secondary leading-relaxed">
            ログインするとデータ（在庫・お気に入り・メモ・履歴・献立）があなたのGoogle Driveに自動バックアップされ、機種変更時も復元できます。
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl bg-white/5 px-4 py-3">
          <p className="text-sm text-text-primary">Googleアカウントでログインするには、環境変数の設定が必要です。</p>
          <p className="text-xs text-text-secondary">
            `VITE_GOOGLE_CLIENT_ID` を設定した上で再デプロイしていただくと、こちらにログインボタンが表示されます。
          </p>
          <a
            href="https://accounts.google.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg bg-bg-card px-3 py-2 text-xs font-medium text-text-secondary hover:text-accent"
          >
            Googleログインの設定ページを開く
          </a>
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-bg-card">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-text-secondary">Google Client ID（ログイン設定用）</h4>
          <button
            onClick={isGoogleIdLocked ? handleGoogleUnlock : () => setIsGoogleIdLocked(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-accent cursor-pointer"
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
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3">
            <span className="flex-1 text-sm text-text-secondary font-mono">
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
                className="w-full rounded-xl bg-white/5 px-4 py-3 pr-10 text-base text-text-primary font-mono placeholder:text-text-secondary outline-none ring-1 ring-accent/30 cursor-text"
              />
              <button
                onClick={() => setShowGoogleId(!showGoogleId)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent cursor-pointer"
              >
                {showGoogleId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleGoogleCancel}
                className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleGoogleSave}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors cursor-pointer ${confirmGoogleSave ? 'bg-red-500 hover:bg-red-600' : 'bg-accent hover:bg-accent-hover'}`}
              >
                {confirmGoogleSave ? '本当に保存しますか？' : '保存'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 rounded-2xl bg-white/5 px-4 py-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            クライアントIDはお客様のブラウザ内（手元の端末）にのみ保存されます。.envファイルで設定されている場合はそちらが優先されることがあります。<br />
            設定後、サインイン機能（バックアップ等）を利用するには、念のため一度ページを再読み込み（リロード）してください。
          </p>
        </div>
      </div>
    </div>
  )
}
