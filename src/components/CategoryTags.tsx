import type { RecipeCategory } from '../db/db'

const categories: RecipeCategory[] = [
  'すべて', '主菜', '副菜', 'スープ', '一品料理', 'スイーツ',
]

interface CategoryTagsProps {
  selectedCategories: RecipeCategory[]
  onToggle: (category: RecipeCategory) => void
}

export function CategoryTags({ selectedCategories, onToggle }: CategoryTagsProps) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
      {categories.map((cat) => {
        const isSelected = cat === 'すべて'
          ? selectedCategories.length === 0
          : selectedCategories.includes(cat)

        return (
          <button
            key={cat}
            onClick={() => onToggle(cat)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm transition-colors ${isSelected
              ? 'bg-accent text-white'
              : 'bg-bg-card text-text-secondary hover:bg-accent hover:text-white'
              }`}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
