import { useState, useRef, useCallback, useTransition, useDeferredValue, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { db } from '../db/db'
import type { RecipeCategory } from '../db/db'
import { calculateMatchRate } from '../utils/recipeUtils'
import { searchRecipes } from '../utils/searchUtils'
import { useDebounce } from '../hooks/useDebounce'
import { SearchBar } from './SearchBar'
import { CategoryTags } from './CategoryTags'
import { RecipeCard } from './RecipeCard'

interface RecipeListProps {
  onSelectRecipe: (id: number) => void
}

export function RecipeList({ onSelectRecipe }: RecipeListProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<RecipeCategory>('すべて')
  const debouncedSearch = useDebounce(search, 300)
  // T-22: useDeferredValue defers re-renders during rapid input
  const deferredSearch = useDeferredValue(debouncedSearch)
  const parentRef = useRef<HTMLDivElement>(null)
  // T-22: useTransition marks filtering as non-urgent so input stays responsive
  const [isPending] = useTransition()

  const PAGE_SIZE = 200

  // T-03: DB-side filtering with combined query (T-09)
  const data = useLiveQuery(
    async () => {
      const [recipes, stockItems] = await Promise.all([
        category !== 'すべて'
          ? db.recipes.where('category').equals(category).limit(PAGE_SIZE).toArray()
          : db.recipes.limit(PAGE_SIZE).toArray(),
        db.stock.filter(item => item.inStock).toArray(),
      ])
      return { recipes, stockItems }
    },
    [category],
    { recipes: [], stockItems: [] }
  )

  const stockNames = useMemo(() => new Set(data.stockItems.map((s) => s.name)), [data.stockItems])

  // T-01 + T-22: Fuzzy search wrapped in transition for smooth typing
  const withRates = useMemo(() => {
    const filtered = deferredSearch
      ? searchRecipes(data.recipes, deferredSearch)
      : data.recipes
    return filtered
      .map((r) => ({
        recipe: r,
        matchRate: calculateMatchRate(r.ingredients, stockNames),
      }))
      .sort((a, b) => b.matchRate - a.matchRate)
  }, [data.recipes, deferredSearch, stockNames])

  // T-04: Virtual scrolling
  const virtualizer = useVirtualizer({
    count: withRates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  })

  const handleSelectRecipe = useCallback(
    (id: number) => onSelectRecipe(id),
    [onSelectRecipe]
  )

  return (
    <>
      <SearchBar value={search} onChange={setSearch} />
      <CategoryTags selected={category} onSelect={setCategory} />

      {withRates.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-secondary">
          レシピが見つかりません
        </p>
      ) : (
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{
            height: 'calc(100dvh - 220px)',
            opacity: isPending ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const { recipe, matchRate } = withRates[virtualItem.index]
              return (
                <div
                  key={recipe.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="pb-2">
                    <RecipeCard
                      recipe={recipe}
                      matchRate={matchRate}
                      onClick={() => handleSelectRecipe(recipe.id!)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
