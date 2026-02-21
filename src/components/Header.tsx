import { Search, CalendarClock, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface HeaderProps {
  onSearchToggle?: () => void
  onMultiSchedule?: () => void
  onSettings?: () => void
}

export function Header({ onSearchToggle, onMultiSchedule, onSettings }: HeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 border-b border-white/15 bg-white/8 px-4 pb-2 pt-[env(safe-area-inset-top,0px)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <img
            src="/apple-touch-icon.png"
            alt="Kitchen App icon"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <h1 className="text-2xl font-extrabold tracking-tight">Kitchen App</h1>
        </div>
        <div className="flex items-center gap-2">
          {onMultiSchedule && (
            <button
              onClick={onMultiSchedule}
              aria-label="複数レシピスケジュール"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 p-2.5 transition-colors hover:bg-white/20"
            >
              <CalendarClock className="h-5 w-5 text-text-secondary" />
            </button>
          )}
          {onSearchToggle && (
            <button
              onClick={onSearchToggle}
              aria-label="検索"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 p-2.5 transition-colors hover:bg-white/20"
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
          ) : null}

          {onSettings && (
            <button
              onClick={onSettings}
              aria-label="設定"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/10 p-2.5 transition-colors hover:bg-white/20"
            >
              <Settings className="h-5 w-5 text-text-secondary" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
