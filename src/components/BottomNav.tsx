import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, Package, Star, Clock } from 'lucide-react'
import type { TabId } from '../db/db'

const tabs: { id: TabId; path: string; icon: typeof Home; label: string }[] = [
  { id: 'home', path: '/', icon: Home, label: 'ホーム' },
  { id: 'menu', path: '/weekly-menu', icon: CalendarDays, label: '献立' },
  { id: 'stock', path: '/stock', icon: Package, label: '在庫' },
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
          return (
            <button
              key={id}
              onClick={() => navigate(path)}
              aria-label={label}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 py-1 transition-all duration-150 active:scale-90 ${
                isActive ? 'text-accent' : 'text-text-secondary hover:text-accent'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px]">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
