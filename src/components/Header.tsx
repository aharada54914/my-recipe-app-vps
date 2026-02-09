import { ChefHat, Search, Sparkles, CalendarClock } from 'lucide-react'

interface HeaderProps {
  onSearchToggle?: () => void
  onAiParse?: () => void
  onMultiSchedule?: () => void
}

export function Header({ onSearchToggle, onAiParse, onMultiSchedule }: HeaderProps) {
  return (
    <header className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="h-7 w-7 text-accent" />
          <h1 className="text-xl font-bold tracking-tight">レシピ</h1>
        </div>
        <div className="flex items-center gap-2">
          {onAiParse && (
            <button
              onClick={onAiParse}
              className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
            >
              <Sparkles className="h-5 w-5 text-text-secondary" />
            </button>
          )}
          {onMultiSchedule && (
            <button
              onClick={onMultiSchedule}
              className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
            >
              <CalendarClock className="h-5 w-5 text-text-secondary" />
            </button>
          )}
          {onSearchToggle && (
            <button
              onClick={onSearchToggle}
              className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
            >
              <Search className="h-5 w-5 text-text-secondary" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
