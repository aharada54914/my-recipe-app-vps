import { startTransition, useState, useRef, useCallback, useDeferredValue, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import type { Recipe, RecipeCategory, DeviceType } from '../db/db'
import { Loader2 } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { CategoryTags } from './CategoryTags'
import { RecipeCard } from './RecipeCard'
import { useRecipeSearchModel } from '../hooks/useRecipeSearchModel'

const RECIPE_CATEGORIES: RecipeCategory[] = ['すべて', '主菜', '副菜', 'スープ', '一品料理', 'スイーツ']
const SEARCH_HISTORY_KEY = 'recipe_search_history'

interface RecipeListProps {
  onSelectRecipe: (id: number) => void
}

export function RecipeList({ onSelectRecipe }: RecipeListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<RecipeCategory[]>([])
  const [deviceFilter, setDeviceFilter] = useState<DeviceType | null>(null)
  const [quickFilter, setQuickFilter] = useState(false)
  const [seasonalFilter, setSeasonalFilter] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (!stored) return []
    try {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, 5) : []
    } catch {
      return []
    }
  })

  // T-22: useDeferredValue defers re-renders during rapid input
  const deferredSearch = useDeferredValue(searchQuery)
  const parentRef = useRef<HTMLDivElement>(null)
  const [isFiltering, setIsFiltering] = useState(false)

  // Read URL ?filter= param and initialize state
  const [searchParams] = useSearchParams()
  const filterParam = searchParams.get('filter') ?? ''

  useEffect(() => {
    if (filterParam.startsWith('device:')) {
      const device = filterParam.replace('device:', '') as DeviceType
      setDeviceFilter(device)
      setSelectedCategories([])
      setQuickFilter(false)
      setSeasonalFilter(false)
    } else if (filterParam === 'quick') {
      setQuickFilter(true)
      setSelectedCategories([])
      setDeviceFilter(null)
      setSeasonalFilter(false)
    } else if (filterParam === 'seasonal') {
      setSeasonalFilter(true)
      setSelectedCategories([])
      setDeviceFilter(null)
      setQuickFilter(false)
    } else if (filterParam && (RECIPE_CATEGORIES as string[]).includes(filterParam)) {
      const parsedCategory = filterParam as RecipeCategory
      setSelectedCategories(parsedCategory === 'すべて' ? [] : [parsedCategory])
      setDeviceFilter(null)
      setQuickFilter(false)
      setSeasonalFilter(false)
    }
  }, [filterParam])

  // T-03: DB-side filtering with combined query (T-09)
  const data = useLiveQuery(
    async () => {
      let fetchedRecipes: Recipe[] = []
      if (deviceFilter) {
        fetchedRecipes = await db.recipes.where('device').equals(deviceFilter).toArray()
      } else if (selectedCategories.length > 0) {
        fetchedRecipes = await db.recipes.where('category').anyOf(selectedCategories).toArray()
      } else {
        fetchedRecipes = await db.recipes.toArray()
      }

      const [recipes, stockItems] = await Promise.all([
        Promise.resolve(fetchedRecipes),
        db.stock.filter(item => item.inStock).toArray(),
      ])

      recipes.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))

      const [viewHistory, favorites, weeklyMenus, calendarEvents] = await Promise.all([
        db.viewHistory.orderBy('viewedAt').reverse().limit(200).toArray(),
        db.favorites.orderBy('addedAt').reverse().limit(200).toArray(),
        db.weeklyMenus.orderBy('weekStartDate').reverse().limit(12).toArray(),
        db.calendarEvents.toArray().then((events) =>
          events
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 200)
        ),
      ])

      return { recipes, stockItems, viewHistory, favorites, weeklyMenus, calendarEvents }
    },
    [selectedCategories, deviceFilter],
    { recipes: [], stockItems: [], viewHistory: [], favorites: [], weeklyMenus: [], calendarEvents: [] }
  )

  const searchModelInput = useMemo(() => ({
    recipes: data.recipes,
    stockItems: data.stockItems,
    viewHistory: data.viewHistory,
    favorites: data.favorites,
    weeklyMenus: data.weeklyMenus,
    calendarEvents: data.calendarEvents,
    searchQuery: deferredSearch,
    selectedCategories,
    quickFilter,
    seasonalFilter,
  }), [
    data.recipes,
    data.stockItems,
    data.viewHistory,
    data.favorites,
    data.weeklyMenus,
    data.calendarEvents,
    deferredSearch,
    selectedCategories,
    quickFilter,
    seasonalFilter,
  ])

  const { results: withRates, categoryCounts } = useRecipeSearchModel(searchModelInput)

  useEffect(() => {
    setIsFiltering(true)
    const timer = window.setTimeout(() => setIsFiltering(false), 100)
    return () => window.clearTimeout(timer)
  }, [deferredSearch, selectedCategories, quickFilter, seasonalFilter, deviceFilter])

  // T-04: Virtual scrolling
  // eslint-disable-next-line react-hooks/incompatible-library
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

  // When user picks a category tag, clear device/quick/seasonal filters
  const handleCategoryToggle = useCallback((cat: RecipeCategory) => {
    setSelectedCategories((prev) => {
      if (cat === 'すべて') return []
      if (prev.includes(cat)) return prev.filter((value) => value !== cat)
      return [...prev, cat]
    })
    setDeviceFilter(null)
    setQuickFilter(false)
    setSeasonalFilter(false)
  }, [])

  // Active filter label for display
  const activeFilterLabel = deviceFilter
    ? deviceFilter === 'hotcook' ? 'ホットクック' : 'ヘルシオ'
    : quickFilter ? '時短 (30分以内)'
      : seasonalFilter ? '旬のレシピ'
        : null

  const saveSearchHistory = useCallback((keyword: string) => {
    const normalized = keyword.trim()
    if (!normalized) return

    setSearchHistory((prev) => {
      const next = [normalized, ...prev.filter((entry) => entry !== normalized)].slice(0, 5)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const commitSearchQuery = useCallback((value: string) => {
    startTransition(() => {
      setSearchQuery(value)
    })
  }, [])

  const handleSubmitSearch = useCallback((value: string) => {
    commitSearchQuery(value)
    saveSearchHistory(value)
  }, [commitSearchQuery, saveSearchHistory])

  const handleSelectHistory = useCallback((value: string) => {
    commitSearchQuery(value)
    saveSearchHistory(value)
  }, [commitSearchQuery, saveSearchHistory])

  return (
    <>
      <SearchBar
        value={searchQuery}
        onChange={commitSearchQuery}
        history={searchHistory}
        onSubmit={handleSubmitSearch}
        onSelectHistory={handleSelectHistory}
        searching={isFiltering}
      />
      <CategoryTags
        selectedCategories={selectedCategories}
        onToggle={handleCategoryToggle}
        counts={categoryCounts}
      />

      {/* Active special filter badge */}
      {activeFilterLabel && (
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-xl bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
            {activeFilterLabel}
          </span>
          <button
            onClick={() => {
              setDeviceFilter(null)
              setQuickFilter(false)
              setSeasonalFilter(false)
            }}
            className="text-xs text-text-secondary hover:text-accent"
          >
            ✕ 解除
          </button>
        </div>
      )}

      {isFiltering && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-bg-card px-3 py-1.5 text-xs text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          絞り込み中...
        </div>
      )}

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
            opacity: isFiltering ? 0.7 : 1,
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
