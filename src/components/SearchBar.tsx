import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 rounded-2xl bg-bg-card px-4 py-3">
        <Search className="h-5 w-5 text-text-secondary" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="レシピを検索..."
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
        />
      </div>
    </div>
  )
}
