import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, Star, Clock } from 'lucide-react'
import type { ComponentType } from 'react'
import type { TabId } from '../db/db'
import { GeminiIcon } from './GeminiIcon'

type AnyIcon = typeof Home | ComponentType<{ className?: string }>

const tabs: { id: TabId; path: string; icon: AnyIcon; label: string }[] = [
  { id: 'home', path: '/', icon: Home, label: 'ホーム' },
  { id: 'menu', path: '/weekly-menu', icon: CalendarDays, label: '献立' },
  { id: 'gemini', path: '/gemini', icon: GeminiIcon, label: 'Gemini' },
  { id: 'favorites', path: '/favorites', icon: Star, label: 'お気に入り' },
  { id: 'history', path: '/history', icon: Clock, label: '履歴' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-bg-primary/90 backdrop-blur-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex justify-around py-2">
        {tabs.map(({ id, path, icon: Icon, label }) => {
          const isActive = location.pathname === path
          const iconClass = id === 'gemini' ? 'h-[22px] w-[22px]' : 'h-5 w-5'
          return (
            <button
              key={id}
              onClick={() => navigate(path)}
              aria-label={label}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 py-1 transition-all duration-150 active:scale-90 ${
                isActive ? 'text-accent' : 'text-text-secondary hover:text-accent'
              }`}
            >
              <Icon className={iconClass} />
              <span className="text-[10px]">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
