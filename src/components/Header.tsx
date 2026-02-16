import { Search, Sparkles, CalendarClock, Settings } from 'lucide-react'
import { ForkKnifeIcon } from './ForkKnifeIcon'

interface HeaderProps {
  onSearchToggle?: () => void
  onAiParse?: () => void
  onMultiSchedule?: () => void
  onSettings?: () => void
}

export function Header({ onSearchToggle, onAiParse, onMultiSchedule, onSettings }: HeaderProps) {
  return (
    <header className="px-4 pt-6 pb-4">
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
          {onSettings && (
            <button
              onClick={onSettings}
              aria-label="設定"
              className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
            >
              <Settings className="h-5 w-5 text-text-secondary" />
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
        </div>
      </div>
    </header>
  )
}
