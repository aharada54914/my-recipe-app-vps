import { Search, Sparkles, CalendarClock, Upload, Settings } from 'lucide-react'
import { ForkKnifeIcon } from './ForkKnifeIcon'

interface HeaderProps {
  onSearchToggle?: () => void
  onAiParse?: () => void
  onMultiSchedule?: () => void
  onImport?: () => void
  onSettings?: () => void
}

export function Header({ onSearchToggle, onAiParse, onMultiSchedule, onImport, onSettings }: HeaderProps) {
  return (
    <header className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ForkKnifeIcon className="h-7 w-7 text-accent" />
          <h1 className="text-xl font-bold tracking-tight">Kitchen App</h1>
        </div>
        <div className="flex items-center gap-2">
          {onImport && (
            <button
              onClick={onImport}
              className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
            >
              <Upload className="h-5 w-5 text-text-secondary" />
            </button>
          )}
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
          {onSettings && (
            <button
              onClick={onSettings}
              className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
            >
              <Settings className="h-5 w-5 text-text-secondary" />
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
