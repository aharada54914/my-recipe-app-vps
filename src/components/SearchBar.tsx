import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useSearchInputController } from '../hooks/useSearchInputController'
import { getRecentSearchSuggestions } from '../utils/searchUtils'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  history?: string[]
  onSubmit?: (value: string) => void
  onSelectHistory?: (value: string) => void
  searching?: boolean
}

export function SearchBar({
  value,
  onChange,
  history = [],
  onSubmit,
  onSelectHistory,
  searching = false,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false)
  const {
    draftValue,
    setDraftValue,
    commitDraft,
    handleCompositionStart,
    handleCompositionEnd,
  } = useSearchInputController({
    value,
    onCommit: onChange,
    delay: 150,
  })

  const suggestions = useMemo(() => {
    return getRecentSearchSuggestions(history, focused)
  }, [focused, history])

  return (
    <div className="mb-6 relative">
      <form
        className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-border-soft bg-bg-card px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          commitDraft(draftValue)
          onSubmit?.(draftValue)
        }}
      >
        <button
          type="submit"
          className={`shrink-0 transition-transform duration-[120ms] ${searching ? 'search-icon-sweep' : ''}`}
          aria-label="検索実行"
        >
          <Search className="h-5 w-5 text-text-secondary" />
        </button>
        <input
          type="text"
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={(e) => handleCompositionEnd(e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder="レシピを検索..."
          className="w-full bg-transparent text-base text-text-primary placeholder:text-text-secondary outline-none"
        />
      </form>

      {focused && suggestions.length > 0 && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-border-soft bg-bg-overlay py-2 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          {suggestions.map((entry) => (
            <button
              key={entry}
              onClick={() => {
                commitDraft(entry)
                onSelectHistory?.(entry)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
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
