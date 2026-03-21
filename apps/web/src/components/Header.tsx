import { Search, CalendarClock, Settings, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface HeaderProps {
  onSearchToggle?: () => void
  onMultiSchedule?: () => void
  onSettings?: () => void
  onStock?: () => void
}

export function Header({ onSearchToggle, onMultiSchedule, onSettings, onStock }: HeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 border-b border-border-soft bg-bg-primary/98 px-4 pb-3 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="min-w-0 flex items-center gap-3">
          <img
            src="/apple-touch-icon.png"
            alt="Kitchen App icon"
            className="h-10 w-10 rounded-2xl object-cover shadow-[0_8px_18px_rgba(32,24,15,0.12)]"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-text-primary">Kitchen App</h1>
            <p className="text-[11px] font-medium tracking-[0.02em] text-text-secondary">
              レシピ検索と AI 相談
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onMultiSchedule && (
            <button
              type="button"
              onClick={onMultiSchedule}
              aria-label="複数レシピスケジュール"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-border-soft bg-bg-card p-2.5 text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            >
              <CalendarClock className="h-5 w-5" />
            </button>
          )}
          {onSearchToggle && (
            <button
              type="button"
              onClick={onSearchToggle}
              aria-label="検索"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-border-soft bg-bg-card p-2.5 text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
          {onStock && (
            <button
              type="button"
              onClick={onStock}
              aria-label="在庫管理"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-border-soft bg-bg-card p-2.5 text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            >
              <Package className="h-5 w-5" />
            </button>
          )}
          {(onSettings || user) && (
            <button
              type="button"
              onClick={() => {
                if (onSettings) {
                  onSettings()
                  return
                }
                navigate('/settings')
              }}
              aria-label={user ? 'アカウント設定' : '設定'}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center overflow-hidden rounded-2xl border p-1.5 transition-colors ${
                user
                  ? 'border-accent/30 bg-bg-card shadow-[0_8px_18px_rgba(227,127,67,0.14)]'
                  : 'border-border-soft bg-bg-card text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
              }`}
            >
              {user ? (
                user.picture ? (
                  <img src={user.picture} alt="" className="h-9 w-9 rounded-[14px] object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-accent text-sm font-extrabold text-white">
                    {user.email[0].toUpperCase()}
                  </span>
                )
              ) : (
                <Settings className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
