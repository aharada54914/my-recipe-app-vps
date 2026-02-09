import type { RecipeCategory } from '../db/db'

const categories: RecipeCategory[] = [
  'すべて', '主菜', '副菜', 'スープ', 'ご飯もの', 'デザート',
]

interface CategoryTagsProps {
  selected: RecipeCategory
  onSelect: (category: RecipeCategory) => void
}

export function CategoryTags({ selected, onSelect }: CategoryTagsProps) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm transition-colors ${
            selected === cat
              ? 'bg-accent text-white'
              : 'bg-bg-card text-text-secondary hover:bg-accent hover:text-white'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
