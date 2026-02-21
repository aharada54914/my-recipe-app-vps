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
    <nav className="fixed bottom-0 left-0 right-0 border-t border-white/20 bg-white/8 backdrop-blur-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex justify-around py-2.5">
        {tabs.map(({ id, path, icon: Icon, label }) => {
          const isActive = location.pathname === path
          const iconClass = id === 'gemini' ? 'h-8 w-8' : 'h-7 w-7'
          return (
            <button
              key={id}
              onClick={() => navigate(path)}
              aria-label={label}
              className={`flex min-h-[54px] min-w-[54px] items-center justify-center rounded-2xl px-3 py-2 transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-accent/20 text-accent shadow-[0_8px_24px_rgba(249,115,22,0.25)]'
                  : 'text-text-secondary hover:bg-white/10 hover:text-accent'
              }`}
            >
              <Icon className={iconClass} />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
