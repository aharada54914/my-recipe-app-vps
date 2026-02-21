/**
 * Category Grid Component
 *
 * Displays 8 food categories in a 4x2 grid.
 * Tapping a category navigates to the search page with that filter.
 */

import { useNavigate } from 'react-router-dom'

interface CategoryItem {
  label: string
  image: string
  filter: string
}

const categories: CategoryItem[] = [
  { label: '主菜', image: '/category/main.svg', filter: '主菜' },
  { label: '副菜', image: '/category/side.svg', filter: '副菜' },
  { label: 'スープ', image: '/category/soup.svg', filter: 'スープ' },
  { label: 'ご飯もの', image: '/category/rice.svg', filter: 'ご飯もの' },
  { label: 'デザート', image: '/category/dessert.svg', filter: 'デザート' },
  { label: 'ホットクック', image: '/category/hotcook.svg', filter: 'device:hotcook' },
  { label: 'ヘルシオ', image: '/category/healsio.svg', filter: 'device:healsio' },
  { label: '時短', image: '/category/quick.svg', filter: 'quick' },
]

export function CategoryGrid() {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-4 gap-3">
      {categories.map(cat => (
        <button
          key={cat.filter}
          onClick={() => navigate(`/search?filter=${encodeURIComponent(cat.filter)}`)}
          className="group relative overflow-hidden rounded-2xl ring-1 ring-white/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <img
            src={cat.image}
            alt=""
            className="h-24 w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
          <span className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/40 px-2 py-1 text-center text-xs font-bold text-white backdrop-blur-sm">
            {cat.label}
          </span>
        </button>
      ))}
    </div>
  )
}
