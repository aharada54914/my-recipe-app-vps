import { startTransition, useState, useRef, useCallback, useDeferredValue, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import type { RecipeCategory, DeviceType } from '../db/db'
import { Flame, Leaf, Loader2, X } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { CategoryTags } from './CategoryTags'
import { RecipeCard } from './RecipeCard'
import { useRecipeSearchModel } from '../hooks/useRecipeSearchModel'
import {
  buildRecipeSearchFacetChips,
  clearRecipeSearchFacets,
  countActiveRecipeSearchFacets,
  createRecipeSearchParams,
  hasActiveRecipeSearchFacets,
  parseRecipeSearchFacetsFromParams,
  toggleRecipeSearchCategory,
  toggleRecipeSearchDevice,
  toggleRecipeSearchFlag,
  type RecipeSearchFacetState,
} from '../utils/searchFacets'

const SEARCH_HISTORY_KEY = 'recipe_search_history'

const DEVICE_BUTTONS: Array<{ key: DeviceType; label: string }> = [
  { key: 'hotcook', label: 'ホットクック' },
  { key: 'healsio', label: 'ヘルシオ' },
]

function areFacetStatesEqual(left: RecipeSearchFacetState, right: RecipeSearchFacetState) {
  return (
    left.quick === right.quick
    && left.seasonal === right.seasonal
    && left.devices.join(',') === right.devices.join(',')
    && left.categories.join(',') === right.categories.join(',')
  )
}

interface RecipeListProps {
  onSelectRecipe: (id: number) => void
}

type FacetStateUpdater =
  | RecipeSearchFacetState
  | ((current: RecipeSearchFacetState) => RecipeSearchFacetState)

export function RecipeList({ onSelectRecipe }: RecipeListProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamKey = searchParams.toString()

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '')
  const [facets, setFacets] = useState<RecipeSearchFacetState>(() => parseRecipeSearchFacetsFromParams(searchParams))
  const searchQueryRef = useRef(searchQuery)
  const facetsRef = useRef(facets)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (!stored) return []
    try {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 5) : []
    } catch {
      return []
    }
  })

  const deferredSearch = useDeferredValue(searchQuery)
  const parentRef = useRef<HTMLDivElement>(null)
  const [isFiltering, setIsFiltering] = useState(false)

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  useEffect(() => {
    facetsRef.current = facets
  }, [facets])

  useEffect(() => {
    const nextQuery = searchParams.get('q') ?? ''
    const nextFacets = parseRecipeSearchFacetsFromParams(searchParams)

    setSearchQuery((current) => (current === nextQuery ? current : nextQuery))
    setFacets((current) => (areFacetStatesEqual(current, nextFacets) ? current : nextFacets))
  }, [searchParamKey, searchParams])

  const data = useLiveQuery(
    async () => {
      const [recipes, stockItems, viewHistory, favorites, weeklyMenus, calendarEvents] = await Promise.all([
        db.recipes.toArray(),
        db.stock.filter((item) => item.inStock).toArray(),
        db.viewHistory.orderBy('viewedAt').reverse().limit(200).toArray(),
        db.favorites.orderBy('addedAt').reverse().limit(200).toArray(),
        db.weeklyMenus.orderBy('weekStartDate').reverse().limit(12).toArray(),
        db.calendarEvents.toArray().then((events) =>
          events
            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
            .slice(0, 200),
        ),
      ])

      recipes.sort((left, right) => (right.id ?? 0) - (left.id ?? 0))
      return { recipes, stockItems, viewHistory, favorites, weeklyMenus, calendarEvents }
    },
    [],
    { recipes: [], stockItems: [], viewHistory: [], favorites: [], weeklyMenus: [], calendarEvents: [] },
  )

  const searchModelInput = useMemo(() => ({
    recipes: data.recipes,
    stockItems: data.stockItems,
    viewHistory: data.viewHistory,
    favorites: data.favorites,
    weeklyMenus: data.weeklyMenus,
    calendarEvents: data.calendarEvents,
    searchQuery: deferredSearch,
    facets,
  }), [
    data.calendarEvents,
    data.favorites,
    data.recipes,
    data.stockItems,
    data.viewHistory,
    data.weeklyMenus,
    deferredSearch,
    facets,
  ])

  const { results: withRates, categoryCounts } = useRecipeSearchModel(searchModelInput)
  const activeFacetChips = useMemo(() => buildRecipeSearchFacetChips(facets), [facets])
  const activeFacetCount = countActiveRecipeSearchFacets(facets)
  const hasActiveFilters = hasActiveRecipeSearchFacets(facets)

  useEffect(() => {
    setIsFiltering(true)
    const timer = window.setTimeout(() => setIsFiltering(false), 100)
    return () => window.clearTimeout(timer)
  }, [deferredSearch, facets])

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: withRates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  })

  const handleSelectRecipe = useCallback((id: number) => onSelectRecipe(id), [onSelectRecipe])

  const syncSearchParams = useCallback((nextQuery: string, nextFacets: RecipeSearchFacetState) => {
    const nextParams = createRecipeSearchParams(nextQuery, nextFacets)
    const nextParamKey = nextParams.toString()
    if (nextParamKey === searchParamKey) return
    setSearchParams(nextParams, { replace: true })
  }, [searchParamKey, setSearchParams])

  const updateFacets = useCallback((updater: FacetStateUpdater) => {
    const current = facetsRef.current
    const next = typeof updater === 'function'
      ? updater(current)
      : updater

    if (areFacetStatesEqual(current, next)) return
    facetsRef.current = next
    setFacets(next)
    syncSearchParams(searchQueryRef.current, next)
  }, [syncSearchParams])

  const saveSearchHistory = useCallback((keyword: string) => {
    const normalized = keyword.trim()
    if (!normalized) return

    setSearchHistory((previous) => {
      const next = [normalized, ...previous.filter((entry) => entry !== normalized)].slice(0, 5)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const commitSearchQuery = useCallback((value: string) => {
    searchQueryRef.current = value
    startTransition(() => {
      setSearchQuery(value)
    })
  }, [])

  const handleSubmitSearch = useCallback((value: string) => {
    commitSearchQuery(value)
    syncSearchParams(value, facetsRef.current)
    saveSearchHistory(value)
  }, [commitSearchQuery, saveSearchHistory, syncSearchParams])

  const handleBlurCommit = useCallback((value: string) => {
    commitSearchQuery(value)
    syncSearchParams(value, facetsRef.current)
  }, [commitSearchQuery, syncSearchParams])

  const handleSelectHistory = useCallback((value: string) => {
    commitSearchQuery(value)
    syncSearchParams(value, facetsRef.current)
    saveSearchHistory(value)
  }, [commitSearchQuery, saveSearchHistory, syncSearchParams])

  const handleRemoveFacetChip = useCallback((chipKey: string) => {
    updateFacets((current) => {
      if (chipKey === 'quick') return toggleRecipeSearchFlag(current, 'quick')
      if (chipKey === 'seasonal') return toggleRecipeSearchFlag(current, 'seasonal')
      if (chipKey.startsWith('device:')) return toggleRecipeSearchDevice(current, chipKey.replace('device:', '') as DeviceType)
      if (chipKey.startsWith('category:')) return toggleRecipeSearchCategory(current, chipKey.replace('category:', '') as RecipeCategory)
      return current
    })
  }, [updateFacets])

  const clearOneFacet = useCallback(() => {
    const lastChip = activeFacetChips[activeFacetChips.length - 1]
    if (!lastChip) return
    handleRemoveFacetChip(lastChip.key)
  }, [activeFacetChips, handleRemoveFacetChip])

  return (
    <>
      <div className="pt-4">
        <p className="ui-section-kicker">Search</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-text-primary">レシピ検索</h2>
            <p className="mt-1 text-sm text-text-secondary">料理名、食材、カテゴリを重ねて絞り込めます。</p>
          </div>
          {hasActiveFilters ? (
            <span className="ui-chip-muted text-xs">
              {activeFacetCount}条件で絞り込み中
            </span>
          ) : null}
        </div>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={commitSearchQuery}
        history={searchHistory}
        onSubmit={handleSubmitSearch}
        onBlurCommit={handleBlurCommit}
        onSelectHistory={handleSelectHistory}
        searching={isFiltering}
      />

      <section data-testid="search-device-filters" className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-tertiary">機種</p>
          <span className="text-[11px] text-text-secondary">同時選択可</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DEVICE_BUTTONS.map((device) => {
            const active = facets.devices.includes(device.key)
            return (
              <button
                key={device.key}
                type="button"
                onClick={() => updateFacets((current) => toggleRecipeSearchDevice(current, device.key))}
                className={`ui-btn min-h-[44px] px-4 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-accent text-white'
                    : 'ui-btn-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {device.label}
              </button>
            )
          })}
        </div>
      </section>

      <section data-testid="search-condition-filters" className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-tertiary">条件</p>
          <span className="text-[11px] text-text-secondary">別条件とは AND</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateFacets((current) => toggleRecipeSearchFlag(current, 'quick'))}
            className={`ui-btn flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
              facets.quick
                ? 'bg-accent text-white'
                : 'ui-btn-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            時短 30分以内
          </button>
          <button
            type="button"
            onClick={() => updateFacets((current) => toggleRecipeSearchFlag(current, 'seasonal'))}
            className={`ui-btn flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
              facets.seasonal
                ? 'bg-accent text-white'
                : 'ui-btn-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            <Leaf className="h-3.5 w-3.5" />
            旬を優先
          </button>
        </div>
      </section>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-tertiary">カテゴリ</p>
          <span className="text-[11px] text-text-secondary">同時選択可</span>
        </div>
        <CategoryTags
          selectedCategories={facets.categories}
          onToggle={(category) => updateFacets((current) => toggleRecipeSearchCategory(current, category))}
          counts={categoryCounts}
        />
      </section>

      {hasActiveFilters ? (
        <section data-testid="search-active-facets" className="ui-panel mb-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-text-primary">有効な条件</h3>
              <p className="mt-1 text-xs text-text-secondary">タップで個別解除できます</p>
            </div>
            <button
              type="button"
              data-testid="search-clear-facets"
              onClick={() => updateFacets(clearRecipeSearchFacets())}
              className="text-xs font-semibold text-accent"
            >
              すべて解除
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFacetChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleRemoveFacetChip(chip.key)}
                className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
              >
                {chip.label}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

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

      {isFiltering ? (
        <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-border-soft bg-bg-card px-3 py-1.5 text-xs text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          絞り込み中...
        </div>
      ) : null}

      {withRates.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-text-secondary">レシピが見つかりません</p>
          {hasActiveFilters ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <button type="button" onClick={clearOneFacet} className="ui-btn ui-btn-secondary px-4 text-sm">
                条件を1つ外す
              </button>
              <button type="button" onClick={() => updateFacets(clearRecipeSearchFacets())} className="text-sm font-semibold text-accent">
                すべて解除
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{
            height: hasActiveFilters
              ? 'max(18rem, calc(100dvh - 34rem))'
              : 'max(20rem, calc(100dvh - 30rem))',
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
