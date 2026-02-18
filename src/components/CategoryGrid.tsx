/**
 * Category Grid Component
 *
 * Displays 8 food categories in a 4x2 grid.
 * Tapping a category navigates to the search page with that filter.
 */

import { useNavigate } from 'react-router-dom'

interface CategoryItem {
  label: string
  emoji: string
  filter: string
}

const categories: CategoryItem[] = [
  { label: '主菜', emoji: '🍖', filter: '主菜' },
  { label: '副菜', emoji: '🥗', filter: '副菜' },
  { label: 'スープ', emoji: '🍜', filter: 'スープ' },
  { label: 'ご飯もの', emoji: '🍙', filter: 'ご飯もの' },
  { label: 'デザート', emoji: '🍰', filter: 'デザート' },
  { label: 'ホットクック', emoji: '🍲', filter: 'device:hotcook' },
  { label: 'ヘルシオ', emoji: '🔥', filter: 'device:healsio' },
  { label: '時短', emoji: '⚡', filter: 'quick' },
]

export function CategoryGrid() {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map(cat => (
        <button
          key={cat.filter}
          onClick={() => navigate(`/search?filter=${encodeURIComponent(cat.filter)}`)}
          className="flex flex-col items-center gap-1 rounded-xl bg-bg-card py-3 transition-colors hover:bg-bg-card-hover"
        >
          <span className="text-2xl">{cat.emoji}</span>
          <span className="text-[10px] font-medium text-text-secondary">{cat.label}</span>
        </button>
      ))}
    </div>
  )
}
