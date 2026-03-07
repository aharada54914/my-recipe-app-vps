import { startTransition, useState, useRef, useCallback, useDeferredValue, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import type { Recipe, RecipeCategory, DeviceType } from '../db/db'
import { Clock3, Flame, Leaf, Loader2 } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { CategoryTags } from './CategoryTags'
import { RecipeCard } from './RecipeCard'
import { useRecipeSearchModel } from '../hooks/useRecipeSearchModel'

const RECIPE_CATEGORIES: RecipeCategory[] = ['すべて', '主菜', '副菜', 'スープ', '一品料理', 'スイーツ']
const SEARCH_HISTORY_KEY = 'recipe_search_history'

function formatViewedAtLabel(date: Date): string {
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffMinutes < 60) return `${diffMinutes || 1}分前`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}時間前`
  return `${Math.floor(diffHours / 24)}日前`
}

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

  const recipeById = useMemo(
    () => new Map(data.recipes.filter((recipe): recipe is Recipe & { id: number } => recipe.id != null).map((recipe) => [recipe.id, recipe])),
    [data.recipes]
  )

  const recentViewedRecipes = useMemo(() => {
    const seen = new Set<number>()
    return data.viewHistory
      .map((entry) => {
        const recipe = recipeById.get(entry.recipeId)
        if (!recipe || seen.has(recipe.id!)) return null
        seen.add(recipe.id!)
        return { recipe, viewedAt: entry.viewedAt }
      })
      .filter((entry): entry is { recipe: Recipe; viewedAt: Date } => !!entry)
      .slice(0, 4)
  }, [data.viewHistory, recipeById])

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

  const hasActiveFilters = !!activeFilterLabel || selectedCategories.length > 0

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

  const quickFilterButtons = [
    {
      key: 'device:hotcook',
      label: 'ホットクック',
      icon: null,
      active: deviceFilter === 'hotcook',
      onClick: () => {
        setDeviceFilter(deviceFilter === 'hotcook' ? null : 'hotcook')
        setSelectedCategories([])
        setQuickFilter(false)
        setSeasonalFilter(false)
      },
    },
    {
      key: 'device:healsio',
      label: 'ヘルシオ',
      icon: null,
      active: deviceFilter === 'healsio',
      onClick: () => {
        setDeviceFilter(deviceFilter === 'healsio' ? null : 'healsio')
        setSelectedCategories([])
        setQuickFilter(false)
        setSeasonalFilter(false)
      },
    },
    {
      key: 'quick',
      label: '時短 30分以内',
      icon: <Flame className="h-3.5 w-3.5" />,
      active: quickFilter,
      onClick: () => {
        setQuickFilter((prev) => !prev)
        setSelectedCategories([])
        setDeviceFilter(null)
        setSeasonalFilter(false)
      },
    },
    {
      key: 'seasonal',
      label: '旬を優先',
      icon: <Leaf className="h-3.5 w-3.5" />,
      active: seasonalFilter,
      onClick: () => {
        setSeasonalFilter((prev) => !prev)
        setSelectedCategories([])
        setDeviceFilter(null)
        setQuickFilter(false)
      },
    },
  ]

  return (
    <>
      <div className="pt-4">
        <p className="ui-section-kicker">Search</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-text-primary">レシピ検索</h2>
            <p className="mt-1 text-sm text-text-secondary">料理名、食材、カテゴリからすぐ探せます。</p>
          </div>
          {hasActiveFilters && (
            <span className="ui-chip-muted text-xs">
              絞り込み中
            </span>
          )}
        </div>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={commitSearchQuery}
        history={searchHistory}
        onSubmit={handleSubmitSearch}
        onSelectHistory={handleSelectHistory}
        searching={isFiltering}
      />

      <div data-testid="search-quick-filters" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {quickFilterButtons.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={filter.onClick}
            className={`ui-btn flex min-h-[44px] shrink-0 items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
              filter.active
                ? 'bg-accent text-white'
                : 'ui-btn-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            {filter.icon}
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      <CategoryTags
        selectedCategories={selectedCategories}
        onToggle={handleCategoryToggle}
        counts={categoryCounts}
      />

      {!searchQuery.trim() && searchHistory.length > 0 && !hasActiveFilters && (
        <section data-testid="search-recent-searches" className="ui-panel mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-text-primary">最近の検索</h3>
            <span className="text-xs text-text-secondary">ワンタップで再検索</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => handleSelectHistory(entry)}
                className="ui-btn ui-btn-secondary px-3 py-2 text-sm"
              >
                {entry}
              </button>
            ))}
          </div>
        </section>
      )}

      {!searchQuery.trim() && recentViewedRecipes.length > 0 && !hasActiveFilters && (
        <section data-testid="search-recent-viewed" className="ui-panel mb-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-text-primary">最近見たレシピ</h3>
              <p className="mt-1 text-xs text-text-secondary">前回の続きから見返せます</p>
            </div>
            <Clock3 className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="space-y-2">
            {recentViewedRecipes.map(({ recipe, viewedAt }) => (
              <button
                key={`${recipe.id}-${viewedAt.toISOString()}`}
                type="button"
                onClick={() => handleSelectRecipe(recipe.id!)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-border-soft bg-bg-card-hover px-3 py-3 text-left transition-colors hover:bg-bg-card"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{recipe.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {recipe.device === 'hotcook' ? 'ホットクック' : recipe.device === 'healsio' ? 'ヘルシオ' : '手動調理'}
                    {' · '}
                    {recipe.totalTimeMinutes}分
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-text-secondary">
                  {formatViewedAtLabel(viewedAt)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Active special filter badge */}
      {activeFilterLabel && (
        <div className="mb-4 flex items-center gap-2">
          <span className="ui-chip-muted border-accent/30 bg-accent/12 px-3 py-1 text-sm font-medium text-accent">
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
        <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-border-soft bg-bg-card px-3 py-1.5 text-xs text-text-secondary">
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
            height: 'calc(100dvh - 18.5rem)',
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
