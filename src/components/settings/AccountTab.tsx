import { useMemo } from 'react'
import {
  LogIn,
  LogOut,
  User,
  HardDriveUpload,
  RefreshCw,
  Cloud,
  Package,
  Star,
  FileText,
  Clock,
  CalendarDays,
  CalendarClock,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useGoogleDriveSync } from '../../hooks/useGoogleDriveSync'
import { db } from '../../db/db'
import { StatusNotice } from '../StatusNotice'
import { getGoogleIntegrationStatus } from '../../lib/integrationStatus'

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
  const navigate = useNavigate()
  const {
    user,
    loading: authLoading,
    isOAuthAvailable,
    providerToken,
    isQaGoogleMode,
    signInWithGoogle,
    signOut,
  } = useAuth()
  const { isBackingUp, isRestoring, lastBackupAt, backupNow, error: backupError } = useGoogleDriveSync()

  const backupCounts = useLiveQuery(async () => {
    const [stock, favorites, userNotes, viewHistory, weeklyMenus, calendarEvents] = await Promise.all([
      db.stock.count(),
      db.favorites.count(),
      db.userNotes.count(),
      db.viewHistory.count(),
      db.weeklyMenus.count(),
      db.calendarEvents.count(),
    ])

    return {
      stock,
      favorites,
      userNotes,
      viewHistory: Math.min(viewHistory, 200),
      weeklyMenus,
      calendarEvents,
    }
  }, [])

  const hasLocalGoogleClientId = useMemo(() => {
    if (typeof window === 'undefined') return false
    return Boolean(localStorage.getItem(GOOGLE_CLIENT_ID_KEY)?.trim())
  }, [])

  const googleStatus = useMemo(
    () => getGoogleIntegrationStatus({
      isOAuthAvailable,
      userPresent: !!user,
      providerTokenPresent: !!providerToken,
      isQaMode: isQaGoogleMode,
      backupError,
      isBackingUp,
      isRestoring,
    }),
    [backupError, isBackingUp, isOAuthAvailable, isQaGoogleMode, isRestoring, providerToken, user]
  )

  const handleGoogleStatusAction = () => {
    switch (googleStatus.actionId) {
      case 'configure-google-client':
        navigate('/settings/advanced')
        return
      case 'backup-now':
      case 'qa-backup':
      case 'retry-google':
        void backupNow()
        return
      case 'sign-in-google':
        signInWithGoogle()
        return
      default:
        if (!isOAuthAvailable) {
          navigate('/settings/advanced')
        }
    }
  }

  return (
    <div className="ui-panel">
      <div className="mb-3 flex items-center gap-2">
        <User className="h-4 w-4 text-accent" />
        <h4 className="text-sm font-bold text-text-secondary">Google ログインとバックアップ</h4>
      </div>

      <StatusNotice
        data-testid="account-google-status"
        tone={googleStatus.tone}
        title={googleStatus.title}
        message={googleStatus.message}
        actionLabel={googleStatus.actionLabel}
        onAction={googleStatus.actionLabel ? handleGoogleStatusAction : undefined}
        icon={<Cloud className="h-4 w-4" />}
        className="mb-4"
      />

      {authLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : user ? (
        <div className="space-y-3">
          <div className="ui-panel-muted flex items-center gap-3">
            {user.picture ? (
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <Cloud className="h-5 w-5 text-accent-fresh" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
              <p className="truncate text-xs text-text-secondary">{user.email}</p>
            </div>
            {isQaGoogleMode ? (
              <span className="rounded-full bg-[color:color-mix(in_srgb,var(--accent-fresh)_18%,transparent)] px-2.5 py-1 text-[11px] font-bold text-accent-fresh">
                QA モード
              </span>
            ) : null}
          </div>

          <div className="ui-panel-muted flex items-center gap-3">
            <HardDriveUpload className="h-4 w-4 shrink-0 text-text-secondary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-secondary">
                {isRestoring
                  ? 'Drive からデータを復元中...'
                  : isBackingUp
                    ? 'バックアップを保存中...'
                    : lastBackupAt
                      ? `最終バックアップ: ${formatTimeAgo(lastBackupAt)}`
                      : 'バックアップはまだ作成されていません'}
              </p>
              {backupError ? <p className="mt-0.5 text-xs text-error">{backupError}</p> : null}
            </div>
          </div>

          <div className="ui-panel-muted space-y-2">
            <p className="mb-2 text-xs font-medium text-text-secondary">バックアップ対象データ</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Package, label: '在庫', count: backupCounts?.stock },
                { icon: Star, label: 'お気に入り', count: backupCounts?.favorites },
                { icon: FileText, label: 'メモ', count: backupCounts?.userNotes },
                { icon: Clock, label: '履歴', count: backupCounts?.viewHistory, suffix: '件（最大200）' },
                { icon: CalendarDays, label: '献立', count: backupCounts?.weeklyMenus },
                { icon: CalendarClock, label: 'カレンダー', count: backupCounts?.calendarEvents },
              ].map(({ icon: Icon, label, count, suffix }) => (
                <div key={label} className="flex items-center gap-2 rounded-xl bg-bg-primary/40 px-2.5 py-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                  <span className="truncate text-xs text-text-secondary">{label}</span>
                  <span className="ml-auto text-xs font-bold tabular-nums text-text-primary">
                    {count === undefined ? '…' : count}
                    <span className="font-normal text-text-secondary">
                      {count !== undefined && (suffix ?? '件')}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={backupNow}
            disabled={isBackingUp || isRestoring}
            className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2 disabled:opacity-30"
          >
            <RefreshCw className={`h-4 w-4 ${isBackingUp ? 'animate-spin' : ''}`} />
            {isBackingUp ? 'バックアップを保存中...' : '今すぐ手動でバックアップする'}
          </button>

          <button
            onClick={signOut}
            className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            {isQaGoogleMode ? 'QA モードを終了' : 'ログアウト'}
          </button>
        </div>
      ) : isOAuthAvailable || hasLocalGoogleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
        <div className="space-y-3">
          {isOAuthAvailable ? (
            <button
              onClick={signInWithGoogle}
              className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              Googleでログイン
            </button>
          ) : (
            <div className="status-notice status-notice--warning text-sm">
              Google Client ID は設定されていますが、GoogleOAuthProvider の読み込みが完了していないか、再読み込みが必要です。ページをリロードしてください。
            </div>
          )}

          <p className="text-xs leading-relaxed text-text-secondary">
            ログインすると、在庫・お気に入り・メモ・履歴・献立などの個人データが Google Drive のアプリ専用領域にバックアップされます。レシピを含む完全控えが必要な場合は、設定の「データ」から JSON エクスポートも利用できます。
          </p>
          <p className="text-xs leading-relaxed text-text-secondary">
            Google Client ID は配布環境ごとの設定なので、Drive バックアップには含まれません。必要な場合は「詳細設定」で確認してください。
          </p>
        </div>
      ) : (
        <div className="ui-panel-muted space-y-3">
          <p className="text-sm text-text-primary">Googleアカウントでログインするには、Google Client ID の設定が必要です。</p>
          <p className="text-xs text-text-secondary">
            `VITE_GOOGLE_CLIENT_ID` を設定して再デプロイするか、「詳細設定」で Client ID を保存するとログイン導線が有効になります。
          </p>
          <button
            type="button"
            onClick={() => navigate('/settings/advanced')}
            className="ui-btn ui-btn-secondary inline-flex text-xs"
          >
            詳細設定で Google Client ID を確認する
          </button>
        </div>
      )}
    </div>
  )
}
