import { Search, Sparkles, CalendarClock, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ForkKnifeIcon } from './ForkKnifeIcon'
import { useAuth } from '../hooks/useAuth'

interface HeaderProps {
  onSearchToggle?: () => void
  onAiParse?: () => void
  onMultiSchedule?: () => void
  onSettings?: () => void
}

export function Header({ onSearchToggle, onAiParse, onMultiSchedule, onSettings }: HeaderProps) {
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-md px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ForkKnifeIcon className="h-7 w-7 text-accent" />
          <h1 className="text-xl font-bold tracking-tight">Kitchen App</h1>
        </div>
        <div className="flex items-center gap-2">
          {onAiParse && (
            <button
              onClick={onAiParse}
              aria-label="AIレシピ解析"
              className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
            >
              <Sparkles className="h-5 w-5 text-text-secondary" />
            </button>
          )}
          {onMultiSchedule && (
            <button
              onClick={onMultiSchedule}
              aria-label="複数レシピスケジュール"
              className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
            >
              <CalendarClock className="h-5 w-5 text-text-secondary" />
            </button>
          )}
          {onSearchToggle && (
            <button
              onClick={onSearchToggle}
              aria-label="検索"
              className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
            >
              <Search className="h-5 w-5 text-text-secondary" />
            </button>
          )}

          {/* Auth badge */}
          {user ? (
            <button
              onClick={() => navigate('/settings')}
              aria-label="アカウント設定"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-bold text-white transition-transform active:scale-90"
            >
              {user.picture ? (
                <img src={user.picture} alt="" className="h-full w-full object-cover" />
              ) : (
                user.email[0].toUpperCase()
              )}
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              aria-label="Googleでログイン"
              className="min-h-[44px] rounded-xl bg-bg-card px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-accent"
            >
              ログイン
            </button>
          )}

          {onSettings && (
            <button
              onClick={onSettings}
              aria-label="設定"
              className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
            >
              <Settings className="h-5 w-5 text-text-secondary" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
