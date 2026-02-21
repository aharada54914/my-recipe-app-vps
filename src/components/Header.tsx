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
    <header className="sticky top-0 z-50 border-b border-white/15 bg-white/8 px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/apple-touch-icon.png"
            alt="Kitchen App icon"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <h1 className="text-xl font-bold tracking-tight">Kitchen App</h1>
        </div>
        <div className="flex items-center gap-2">
          {onMultiSchedule && (
            <button
              onClick={onMultiSchedule}
              aria-label="複数レシピスケジュール"
              className="rounded-xl bg-white/10 p-3 transition-colors hover:bg-white/20"
            >
              <CalendarClock className="h-5 w-5 text-text-secondary" />
            </button>
          )}
          {onSearchToggle && (
            <button
              onClick={onSearchToggle}
              aria-label="検索"
              className="rounded-xl bg-white/10 p-3 transition-colors hover:bg-white/20"
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
              className="rounded-xl bg-white/10 p-3 transition-colors hover:bg-white/20"
            >
              <Settings className="h-5 w-5 text-text-secondary" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
