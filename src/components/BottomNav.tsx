import { Home, Search, Package, Star, Clock } from 'lucide-react'
import type { TabId } from '../db/db'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; icon: typeof Search; label: string }[] = [
  { id: 'home', icon: Home, label: 'ホーム' },
  { id: 'search', icon: Search, label: '検索' },
  { id: 'stock', icon: Package, label: '在庫' },
  { id: 'favorites', icon: Star, label: 'お気に入り' },
  { id: 'history', icon: Clock, label: '履歴' },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-bg-primary/90 backdrop-blur-lg">
      <div className="flex justify-around py-2">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${activeTab === id ? 'text-accent' : 'text-text-secondary hover:text-accent'
              }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
