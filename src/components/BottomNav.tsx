import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Star, Clock } from 'lucide-react'
import type { ComponentType } from 'react'
import type { TabId } from '../db/db'
import { GeminiIcon } from './GeminiIcon'
import { WeeklyPlanIcon } from './WeeklyPlanIcon'

type AnyIcon = typeof Home | ComponentType<{ className?: string }>

const tabs: { id: TabId; path: string; icon: AnyIcon; label: string }[] = [
  { id: 'home', path: '/', icon: Home, label: 'ホーム' },
  { id: 'menu', path: '/weekly-menu', icon: WeeklyPlanIcon, label: '献立' },
  { id: 'gemini', path: '/gemini', icon: GeminiIcon, label: 'Gemini' },
  { id: 'favorites', path: '/favorites', icon: Star, label: 'お気に入り' },
  { id: 'history', path: '/history', icon: Clock, label: '履歴' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-soft bg-bg-primary/98 shadow-[0_-18px_32px_rgba(32,24,15,0.14)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-screen-sm items-center justify-around gap-1 px-2 py-2">
        {tabs.map(({ id, path, icon: Icon, label }) => {
          const isActive = path === '/'
            ? location.pathname === path
            : location.pathname === path || location.pathname.startsWith(`${path}/`)
          const iconClass = 'h-5 w-5'
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`bottom-nav-${id}`}
              className={`flex min-h-[60px] min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? 'border-accent/30 bg-bg-card text-accent shadow-[0_10px_24px_rgba(227,127,67,0.16)]'
                  : 'border-transparent text-text-secondary hover:bg-bg-card hover:text-text-primary'
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-2xl ${isActive ? 'bg-accent/14' : 'bg-transparent'}`}>
                <Icon className={iconClass} />
              </span>
              <span className={`text-[11px] font-bold leading-none ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
