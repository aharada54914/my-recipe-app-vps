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
    <div
      data-testid="search-category-grid"
      className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {categories.map((cat) => {
        const isSelected = cat === 'すべて'
          ? selectedCategories.length === 0
          : selectedCategories.includes(cat)

        return (
          <button
            key={cat}
            type="button"
            onClick={() => onToggle(cat)}
            aria-pressed={isSelected}
            className={`category-tag-button min-h-[44px] w-full rounded-xl px-4 py-2 text-sm ${isSelected
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
