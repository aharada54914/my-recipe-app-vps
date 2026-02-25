import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

export function getRecentSearchSuggestions(history: string[], focused: boolean): string[] {
  if (!focused) return []
  return history.slice(0, 5)
}

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  history?: string[]
  onSubmit?: () => void
  onSelectHistory?: (value: string) => void
}

export function SearchBar({
  value,
  onChange,
  history = [],
  onSubmit,
  onSelectHistory,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false)
  const suggestions = useMemo(() => {
    return getRecentSearchSuggestions(history, focused)
  }, [focused, history])

  return (
    <div className="mb-6 relative">
      <form
        className="flex min-h-[48px] items-center gap-3 rounded-2xl bg-bg-card px-4 py-3 ring-1 ring-white/10"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit?.()
        }}
      >
        <button type="submit" className="shrink-0" aria-label="検索実行">
          <Search className="h-5 w-5 text-text-secondary" />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder="レシピを検索..."
          className="w-full bg-transparent text-base text-text-primary placeholder:text-text-secondary outline-none"
        />
      </form>

      {focused && suggestions.length > 0 && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl bg-bg-card py-2 ring-1 ring-white/10">
          {suggestions.map((entry) => (
            <button
              key={entry}
              onClick={() => onSelectHistory?.(entry)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary"
            >
              <Search className="h-4 w-4" />
              <span>{entry}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
