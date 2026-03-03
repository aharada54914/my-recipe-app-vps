import type { RecipeCategory } from '../db/db'

const categories: RecipeCategory[] = [
  'すべて', '主菜', '副菜', 'スープ', '一品料理', 'スイーツ',
]

interface CategoryTagsProps {
  selectedCategories: RecipeCategory[]
  onToggle: (category: RecipeCategory) => void
  counts?: Partial<Record<RecipeCategory, number>>
}

export function CategoryTags({ selectedCategories, onToggle, counts }: CategoryTagsProps) {
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
            className={`category-tag-button shrink-0 rounded-xl px-4 py-2 text-sm ${isSelected
              ? 'category-tag-selected'
              : 'bg-bg-card text-text-secondary hover:bg-accent hover:text-white'
              }`}
          >
            {cat}
            {typeof counts?.[cat] === 'number' && (
              <span className="ml-1.5 text-[11px] opacity-80">{counts[cat]}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
