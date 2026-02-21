/**
 * Weekly Menu Preview/Edit Page
 *
 * Shows 7 days of selected recipes with lock, swap, regenerate,
 * calendar registration, and shopping list features.
 * Each day shows main dish + side dish in a 2-tile horizontal grid.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import { Lock, Unlock, RefreshCw, Calendar, ShoppingCart, CalendarClock, Clock3, UtensilsCrossed, X, Search, Star, Share2, Download } from 'lucide-react'
import { format, addDays, parse, addMinutes } from 'date-fns'
import { ja } from 'date-fns/locale'
import Fuse from 'fuse.js'
import { db, type Recipe, type WeeklyMenu } from '../db/db'
import { usePreferences } from '../hooks/usePreferences'
import { useAuth } from '../hooks/useAuth'
import { useDebounce } from '../hooks/useDebounce'
import { RecipeCard } from '../components/RecipeCard'
import { selectWeeklyMenu, getWeekStartDate } from '../utils/weeklyMenuSelector'
import { aggregateIngredients, getMissingWeeklyIngredients, formatWeeklyShoppingList } from '../utils/weeklyShoppingUtils'
import { registerWeeklyMenuToCalendar, registerShoppingListToCalendar } from '../utils/weeklyMenuCalendar'
import { calculateMatchRate, calculateMultiRecipeSchedule, isHelsioDeli } from '../utils/recipeUtils'
import { EditableShoppingList } from '../components/EditableShoppingList'
import { createWeeklyMenuShareCode, parseWeeklyMenuShareCode } from '../utils/weeklyMenuShare'
import { getNotificationPermission, showLocalNotification } from '../utils/notifications'

const LANE_COLORS = [
  { bg: 'rgba(249,115,22,0.25)', border: '#F97316', text: '#F97316' },
  { bg: 'rgba(59,130,246,0.25)', border: '#3B82F6', text: '#60A5FA' },
]

export function WeeklyMenuPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { preferences } = usePreferences()
  const { providerToken } = useAuth()

  const [weekStart, setWeekStart] = useState(() => getWeekStartDate(new Date()))
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  // Load existing menu for this week
  const existingMenu = useLiveQuery(
    () => db.weeklyMenus.where('weekStartDate').equals(weekStartStr).first(),
    [weekStartStr]
  )

  const [menu, setMenu] = useState<WeeklyMenu | null>(null)
  const [recipes, setRecipes] = useState<Map<number, Recipe>>(new Map())
  const [generating, setGenerating] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null)
  const [swapType, setSwapType] = useState<'main' | 'side'>('main')
  const [swapCandidates, setSwapCandidates] = useState<Recipe[]>([])
  const [swapFavorites, setSwapFavorites] = useState<Recipe[]>([])
  const [swapSearchQuery, setSwapSearchQuery] = useState('')
  const debouncedSwapSearch = useDebounce(swapSearchQuery, 250)
  const [ganttDayIndex, setGanttDayIndex] = useState<number | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCodeInput, setShareCodeInput] = useState('')

  const stockItems = useLiveQuery(() => db.stock.filter(s => s.inStock).toArray(), [])
  const stockNames = useMemo(() => new Set((stockItems ?? []).map(s => s.name)), [stockItems])

  const loadRecipes = useCallback(async (recipeIds: number[]) => {
    const loaded = await db.recipes.bulkGet(recipeIds)
    const map = new Map<number, Recipe>()
    for (const r of loaded) {
      if (r?.id != null) map.set(r.id, r)
    }
    setRecipes(map)
  }, [])

  // Load existing menu from DB
  useEffect(() => {
    if (existingMenu) {
      setMenu(existingMenu)
      const ids: number[] = []
      for (const item of existingMenu.items) {
        ids.push(item.recipeId)
        if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
      }
      loadRecipes(ids)
    }
  }, [existingMenu, loadRecipes])

  // Generate new menu
  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const items = await selectWeeklyMenu(weekStart, preferences, menu?.items)

      const newMenu: WeeklyMenu = {
        id: menu?.id,
        weekStartDate: weekStartStr,
        items,
        status: 'draft',
        createdAt: menu?.createdAt ?? new Date(),
        updatedAt: new Date(),
      }

      if (menu?.id != null) {
        await db.weeklyMenus.update(menu.id, {
          items,
          status: 'draft',
          updatedAt: new Date(),
        })
      } else {
        const id = await db.weeklyMenus.add(newMenu)
        newMenu.id = id
      }

      setMenu(newMenu)
      const ids: number[] = []
      for (const item of items) {
        ids.push(item.recipeId)
        if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
      }
      await loadRecipes(ids)

      if (preferences.notifyWeeklyMenuDone && getNotificationPermission() === 'granted') {
        await showLocalNotification({
          title: '週間献立を作成しました',
          body: `${format(weekStart, 'M/d')}開始の献立を更新しました。`,
          tag: `weekly_menu_${weekStartStr}`,
        })
      }
    } finally {
      setGenerating(false)
    }
  }, [weekStart, weekStartStr, preferences, menu, loadRecipes])

  // Toggle lock
  const handleToggleLock = useCallback((dayIndex: number) => {
    if (!menu) return
    const newItems = [...menu.items]
    newItems[dayIndex] = { ...newItems[dayIndex], locked: !newItems[dayIndex].locked }
    const updated = { ...menu, items: newItems, updatedAt: new Date() }
    setMenu(updated)
    if (menu.id != null) {
      db.weeklyMenus.update(menu.id, { items: newItems, updatedAt: new Date() })
    }
  }, [menu])

  // Swap recipe
  const handleOpenSwap = useCallback(async (dayIndex: number, type: 'main' | 'side') => {
    if (!menu) return
    const usedIds = new Set(menu.items.flatMap(i => {
      const ids: number[] = [i.recipeId]
      if (i.sideRecipeId != null) ids.push(i.sideRecipeId)
      return ids
    }))

    // Load candidates: top 200 recipes excluding used + ヘルシオデリ, sorted by stock match
    const [allRecipes, favRecords] = await Promise.all([
      db.recipes.limit(200).toArray(),
      db.favorites.toArray(),
    ])

    const favIds = new Set(favRecords.map(f => f.recipeId))
    const candidates = allRecipes
      .filter(r => r.id != null && !usedIds.has(r.id) && !isHelsioDeli(r))
      .map(r => ({ recipe: r, matchRate: calculateMatchRate(r.ingredients, stockNames) }))
      .sort((a, b) => b.matchRate - a.matchRate)
      .map(r => r.recipe)

    const favorites = candidates.filter(r => favIds.has(r.id!))

    setSwapCandidates(candidates)
    setSwapFavorites(favorites)
    setSwapSearchQuery('')
    setSwapDayIndex(dayIndex)
    setSwapType(type)
  }, [menu, stockNames])

  const handleSelectSwap = useCallback(async (recipe: Recipe) => {
    if (!menu || swapDayIndex === null) return
    const newItems = [...menu.items]
    if (swapType === 'main') {
      newItems[swapDayIndex] = { ...newItems[swapDayIndex], recipeId: recipe.id! }
    } else {
      newItems[swapDayIndex] = { ...newItems[swapDayIndex], sideRecipeId: recipe.id! }
    }
    const updated = { ...menu, items: newItems, updatedAt: new Date() }
    setMenu(updated)
    setRecipes(prev => new Map(prev).set(recipe.id!, recipe))
    setSwapDayIndex(null)
    if (menu.id != null) {
      db.weeklyMenus.update(menu.id, { items: newItems, updatedAt: new Date() })
    }
  }, [menu, swapDayIndex, swapType])

  const selectedRecipes = useMemo(() => {
    if (!menu) return [] as Recipe[]
    return menu.items.flatMap((item) => {
      const out: Recipe[] = []
      const main = recipes.get(item.recipeId)
      if (main) out.push(main)
      if (item.sideRecipeId != null) {
        const side = recipes.get(item.sideRecipeId)
        if (side) out.push(side)
      }
      return out
    })
  }, [menu, recipes])

  // Calendar registration
  const handleRegisterCalendar = useCallback(async () => {
    if (!menu || !providerToken) return
    setRegistering(true)
    try {
      const mainRecipeList = menu.items.map(i => recipes.get(i.recipeId)).filter(Boolean) as Recipe[]
      const result = await registerWeeklyMenuToCalendar(providerToken, menu, mainRecipeList, preferences)

      if (result.errors.length > 0) {
        alert(`${result.registered}件登録、${result.errors.length}件エラー:\n${result.errors.join('\n')}`)
      }

      if (stockItems) {
        const missing = getMissingWeeklyIngredients(selectedRecipes, stockItems)
        if (missing.length > 0) {
          const text = formatWeeklyShoppingList(weekStartStr, missing)
          await registerShoppingListToCalendar(providerToken, text, weekStart, preferences)
        }
      }
    } finally {
      setRegistering(false)
    }
  }, [menu, providerToken, recipes, preferences, selectedRecipes, stockItems, weekStart, weekStartStr])

  // Week navigation
  const adjustWeek = (delta: number) => {
    setWeekStart(prev => addDays(prev, delta * 7))
    setMenu(null)
    setShowShoppingList(false)
  }

  // Time display helpers
  const desiredMealTime = useMemo(() => {
    const d = new Date()
    d.setHours(preferences.desiredMealHour, preferences.desiredMealMinute, 0, 0)
    return d
  }, [preferences.desiredMealHour, preferences.desiredMealMinute])

  const getCookingStartTime = useCallback((mainRecipe: Recipe | undefined) => {
    if (!mainRecipe || !mainRecipe.totalTimeMinutes) return null
    return addMinutes(desiredMealTime, -mainRecipe.totalTimeMinutes)
  }, [desiredMealTime])

  const weekEndStr = format(addDays(weekStart, 6), 'M/d')
  const weekStartDisplay = format(weekStart, 'M/d')
  const shareCode = useMemo(() => {
    if (!menu) return ''
    return createWeeklyMenuShareCode(weekStartStr, menu.items)
  }, [menu, weekStartStr])

  const applySharedMenu = useCallback(async (code: string) => {
    const shared = parseWeeklyMenuShareCode(code)
    const existing = await db.weeklyMenus.where('weekStartDate').equals(shared.weekStartDate).first()

    const nextMenu: WeeklyMenu = {
      id: existing?.id,
      weekStartDate: shared.weekStartDate,
      items: shared.items,
      status: 'draft',
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    if (existing?.id != null) {
      await db.weeklyMenus.update(existing.id, {
        items: shared.items,
        status: 'draft',
        updatedAt: new Date(),
      })
    } else {
      const id = await db.weeklyMenus.add(nextMenu)
      nextMenu.id = id
    }

    const importedWeek = new Date(`${shared.weekStartDate}T00:00:00`)
    setWeekStart(importedWeek)
    setMenu(nextMenu)
    const ids: number[] = []
    for (const item of shared.items) {
      ids.push(item.recipeId)
      if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
    }
    await loadRecipes(ids)
  }, [loadRecipes])

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('shared')
    if (!code) return

    applySharedMenu(code)
      .then(() => {
        alert('共有された週間献立を読み込みました')
      })
      .catch((err) => {
        alert(`共有コードの読み込みに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
      })
      .finally(() => {
        navigate('/weekly-menu', { replace: true })
      })
  }, [location.search, applySharedMenu, navigate])

  const handleShareLink = useCallback(async () => {
    if (!menu) return
    const url = `${window.location.origin}/weekly-menu?shared=${encodeURIComponent(shareCode)}`

    if (navigator.share) {
      await navigator.share({
        title: `Kitchen App 週間献立 ${weekStartDisplay}〜${weekEndStr}`,
        text: '週間献立を共有します',
        url,
      })
      return
    }

    await navigator.clipboard.writeText(url)
    alert('共有リンクをコピーしました')
  }, [menu, shareCode, weekEndStr, weekStartDisplay])

  const handleImportFromCode = useCallback(async () => {
    if (!shareCodeInput.trim()) return
    try {
      await applySharedMenu(shareCodeInput)
      setShareOpen(false)
      setShareCodeInput('')
      alert('共有コードから週間献立を読み込みました')
    } catch (err) {
      alert(`共有コードが不正です: ${err instanceof Error ? err.message : '不明なエラー'}`)
    }
  }, [shareCodeInput, applySharedMenu])

  useEffect(() => {
    if (!showShoppingList) return
    if (!stockItems || !preferences.notifyShoppingListDone) return
    if (getNotificationPermission() !== 'granted') return

    const missing = getMissingWeeklyIngredients(selectedRecipes, stockItems)
    if (missing.length === 0) return

    showLocalNotification({
      title: '買い物リストを確認しましょう',
      body: `${missing.length}件の不足食材があります。`,
      tag: `shopping_${weekStartStr}`,
    })
  }, [showShoppingList, stockItems, preferences.notifyShoppingListDone, selectedRecipes, weekStartStr])

  return (
    <div>
      <h2 className="pt-4 pb-3 text-lg font-bold">週間献立</h2>

      <div className={`space-y-4 ${menu ? 'pb-44' : 'pb-24'}`}>
        {/* Week navigation */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => adjustWeek(-1)}
            className="rounded-xl bg-bg-card-hover px-3 py-1 text-sm transition-colors hover:text-accent"
          >
            前の週
          </button>
          <div className="text-center">
            <div className="text-xl font-bold text-accent">
              {weekStartDisplay} - {weekEndStr}
            </div>
          </div>
          <button
            onClick={() => adjustWeek(1)}
            className="rounded-xl bg-bg-card-hover px-3 py-1 text-sm transition-colors hover:text-accent"
          >
            次の週
          </button>
        </div>

        {/* Menu content */}
        {!menu ? (
          <div className="rounded-2xl bg-bg-card p-8 text-center">
            <p className="mb-4 text-sm text-text-secondary">
              この週の献立はまだ生成されていません
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50"
            >
              {generating ? '生成中...' : '献立を自動生成'}
            </button>
          </div>
        ) : (
          <>
            {/* Daily menu cards */}
            <div className="space-y-3">
              {menu.items.map((item, i) => {
                const mainRecipe = recipes.get(item.recipeId)
                const sideRecipe = item.sideRecipeId != null ? recipes.get(item.sideRecipeId) : undefined
                const date = parse(item.date, 'yyyy-MM-dd', new Date())
                const isToday = format(new Date(), 'yyyy-MM-dd') === item.date
                const mainMatchRate = mainRecipe ? calculateMatchRate(mainRecipe.ingredients, stockNames) : undefined
                const sideMatchRate = sideRecipe ? calculateMatchRate(sideRecipe.ingredients, stockNames) : undefined
                const cookStart = getCookingStartTime(mainRecipe)

                return (
                  <div
                    key={item.date}
                    className={`rounded-2xl bg-bg-card p-4 ${isToday ? 'ring-1 ring-accent/40' : ''}`}
                  >
                    {/* Day header */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-bold ${isToday ? 'text-accent' : 'text-text-primary'}`}>
                          {format(date, 'M/d (E)', { locale: ja })}
                        </span>
                        {isToday && (
                          <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                            今日
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleLock(i)}
                        className="rounded-lg p-1.5 text-text-secondary transition-colors hover:text-accent"
                      >
                        {item.locked
                          ? <Lock className="h-4 w-4 text-accent" />
                          : <Unlock className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Time info row — tap to open Gantt modal */}
                    <button
                      onClick={() => setGanttDayIndex(i)}
                      className="mb-3 flex w-full items-center justify-between rounded-xl bg-white/5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/10"
                    >
                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                        {cookStart && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-4 w-4 shrink-0 text-text-secondary" />
                            調理開始 <span className="font-bold text-text-primary">{format(cookStart, 'HH:mm')}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <UtensilsCrossed className="h-4 w-4 shrink-0 text-accent" />
                          いただきます <span className="font-bold text-accent">{format(desiredMealTime, 'HH:mm')}</span>
                        </span>
                      </div>
                      <CalendarClock className="h-4 w-4 shrink-0 text-text-secondary" />
                    </button>

                    {/* 2-tile grid: main | side */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Main dish */}
                      <div>
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">主菜</div>
                        {mainRecipe ? (
                          <RecipeCard
                            recipe={mainRecipe}
                            matchRate={mainMatchRate}
                            onClick={() => navigate(`/recipe/${mainRecipe.id}`)}
                            variant="menu"
                          />
                        ) : (
                          <div className="flex h-24 items-center justify-center rounded-xl bg-white/5 text-[10px] text-text-secondary">
                            レシピなし
                          </div>
                        )}
                      </div>

                      {/* Side dish */}
                      <div>
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">副菜・スープ</div>
                        {sideRecipe ? (
                          <RecipeCard
                            recipe={sideRecipe}
                            matchRate={sideMatchRate}
                            onClick={() => navigate(`/recipe/${sideRecipe.id}`)}
                            variant="menu"
                          />
                        ) : (
                          <div className="flex h-24 items-center justify-center rounded-xl bg-white/5 text-[10px] text-text-secondary">
                            副菜なし
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Swap buttons */}
                    {!item.locked && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenSwap(i, 'main')}
                          className="rounded-lg bg-white/5 py-1.5 text-[10px] text-text-secondary transition-colors hover:text-accent"
                        >
                          主菜を変更
                        </button>
                        <button
                          onClick={() => handleOpenSwap(i, 'side')}
                          className="rounded-lg bg-white/5 py-1.5 text-[10px] text-text-secondary transition-colors hover:text-accent"
                        >
                          副菜を変更
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Shopping list section */}
            {showShoppingList && stockItems && (
              <div className="rounded-2xl bg-bg-card p-4">
                <h4 className="mb-3 text-sm font-bold text-text-secondary">買い物リスト</h4>
                <EditableShoppingList
                  weekLabel={`${weekStartDisplay}〜${weekEndStr}`}
                  ingredients={aggregateIngredients(selectedRecipes, stockItems as never[])}
                  storageKey={`shopping_checked_${weekStartStr}`}
                />
              </div>
            )}
          </>
        )}

        {/* Swap modal */}
        {swapDayIndex !== null && (
          <SwapModal
            swapType={swapType}
            candidates={swapCandidates}
            favorites={swapFavorites}
            searchQuery={swapSearchQuery}
            debouncedSearch={debouncedSwapSearch}
            stockNames={stockNames}
            onSearchChange={setSwapSearchQuery}
            onSelect={handleSelectSwap}
            onClose={() => setSwapDayIndex(null)}
          />
        )}

        {/* Gantt chart day modal */}
        {ganttDayIndex !== null && menu && (
          <GanttDayModal
            item={menu.items[ganttDayIndex]}
            mainRecipe={recipes.get(menu.items[ganttDayIndex].recipeId)}
            sideRecipe={menu.items[ganttDayIndex].sideRecipeId != null
              ? recipes.get(menu.items[ganttDayIndex].sideRecipeId!)
              : undefined}
            desiredMealTime={desiredMealTime}
            onClose={() => setGanttDayIndex(null)}
          />
        )}

        {shareOpen && menu && (
          <ShareMenuModal
            weekLabel={`${weekStartDisplay}〜${weekEndStr}`}
            shareCode={shareCode}
            importCode={shareCodeInput}
            onImportCodeChange={setShareCodeInput}
            onShare={handleShareLink}
            onImport={handleImportFromCode}
            onClose={() => setShareOpen(false)}
          />
        )}
      </div>

      {/* Bottom action bar — positioned above BottomNav */}
      {menu && (
        <div className="fixed left-0 right-0 z-40 border-t border-border bg-bg-primary/90 backdrop-blur-xl" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
          <div className="grid grid-cols-2 gap-2 px-4 py-2 sm:grid-cols-4">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-bg-card py-2.5 text-xs font-medium transition-colors hover:bg-bg-card-hover disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              再生成
            </button>
            <button
              onClick={() => setShowShoppingList(prev => !prev)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-bg-card py-2.5 text-xs font-medium transition-colors hover:bg-bg-card-hover"
            >
              <ShoppingCart className="h-4 w-4" />
              買い物
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-bg-card py-2.5 text-xs font-medium transition-colors hover:bg-bg-card-hover"
            >
              <Share2 className="h-4 w-4" />
              共有
            </button>
            {providerToken && (
              <button
                onClick={handleRegisterCalendar}
                disabled={registering || menu.status === 'registered'}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-xs font-bold text-white transition-opacity disabled:opacity-50"
              >
                <Calendar className="h-4 w-4" />
                {registering ? '登録中...' : menu.status === 'registered' ? '登録済' : 'カレンダー'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Swap modal with search + favorites ---

interface SwapModalProps {
  swapType: 'main' | 'side'
  candidates: Recipe[]
  favorites: Recipe[]
  searchQuery: string
  debouncedSearch: string
  stockNames: Set<string>
  onSearchChange: (q: string) => void
  onSelect: (recipe: Recipe) => void
  onClose: () => void
}

function SwapModal({
  swapType, candidates, favorites, searchQuery, debouncedSearch,
  stockNames, onSearchChange, onSelect, onClose,
}: SwapModalProps) {
  const fuse = useMemo(
    () => new Fuse(candidates, { keys: ['title'], threshold: 0.4 }),
    [candidates]
  )

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return null
    return fuse.search(debouncedSearch).map(r => r.item).slice(0, 20)
  }, [fuse, debouncedSearch])

  const showSearch = !!filtered
  const topAlternatives = useMemo(
    () => candidates.slice(0, 10),
    [candidates]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full max-w-lg flex-col rounded-t-2xl bg-bg-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h3 className="text-sm font-bold">
            {swapType === 'main' ? '主菜' : '副菜・スープ'}を変更
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-bg-card px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-text-secondary" />
            <input
              autoFocus
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="レシピを検索..."
              className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-secondary outline-none"
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
          {showSearch ? (
            /* Search results */
            filtered!.length > 0 ? (
              <div className="space-y-2">
                {filtered!.map(recipe => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
                    onClick={() => onSelect(recipe)}
                  />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-text-secondary">該当するレシピがありません</p>
            )
          ) : (
            <>
              {/* Favorites section */}
              {favorites.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-accent" />
                    <h4 className="text-xs font-bold text-text-secondary">お気に入り</h4>
                  </div>
                  <div className="space-y-2">
                    {favorites.slice(0, 5).map(recipe => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
                        onClick={() => onSelect(recipe)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Stock-based recommendations */}
              <div>
                <div className="mb-2 text-xs font-bold text-text-secondary">在庫でつくれるレシピ</div>
                <div className="space-y-2">
                  {topAlternatives.map(recipe => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
                      onClick={() => onSelect(recipe)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Gantt chart modal for a single day ---

interface GanttDayModalProps {
  item: { recipeId: number; sideRecipeId?: number; date: string }
  mainRecipe: Recipe | undefined
  sideRecipe: Recipe | undefined
  desiredMealTime: Date
  onClose: () => void
}

function GanttDayModal({ item, mainRecipe, sideRecipe, desiredMealTime, onClose }: GanttDayModalProps) {
  const recipeInputs = useMemo(() => {
    const list: { recipeId: number; title: string; steps: Recipe['steps']; device: Recipe['device'] }[] = []
    if (mainRecipe) list.push({ recipeId: mainRecipe.id!, title: mainRecipe.title, steps: mainRecipe.steps, device: mainRecipe.device })
    if (sideRecipe) list.push({ recipeId: sideRecipe.id!, title: sideRecipe.title, steps: sideRecipe.steps, device: sideRecipe.device })
    return list
  }, [mainRecipe, sideRecipe])

  const schedule = useMemo(() => {
    if (recipeInputs.length === 0) return null
    return calculateMultiRecipeSchedule(desiredMealTime, recipeInputs)
  }, [recipeInputs, desiredMealTime])

  const totalSpanMs = schedule
    ? desiredMealTime.getTime() - schedule.overallStart.getTime()
    : 0

  const date = parse(item.date, 'yyyy-MM-dd', new Date())

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-bg-primary p-4 pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold">
              {format(date, 'M/d (E)', { locale: ja })} の調理スケジュール
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {schedule && totalSpanMs > 0 ? (
          <>
            {/* Time axis */}
            <div className="mb-3 flex justify-between text-[10px] text-text-secondary">
              <span>{format(schedule.overallStart, 'HH:mm')} 調理開始</span>
              <span className="font-bold text-accent">{format(desiredMealTime, 'HH:mm')} いただきます</span>
            </div>

            {/* Conflict warnings */}
            {schedule.conflicts.length > 0 && (
              <div className="mb-3 rounded-xl bg-yellow-500/10 px-3 py-2">
                <div className="text-xs font-bold text-yellow-400 mb-1">⚠️ デバイス競合あり</div>
                {schedule.conflicts.map((c, ci) => (
                  <div key={ci} className="text-[10px] text-yellow-300">
                    {c.device === 'hotcook' ? '🍲' : '♨️'} {c.recipeTitle}: {c.shiftMinutes}分前倒し
                  </div>
                ))}
              </div>
            )}

            {/* Gantt lanes */}
            <div className="space-y-3">
              {schedule.recipes.map((rs) => {
                const color = LANE_COLORS[rs.colorIndex % LANE_COLORS.length]
                return (
                  <div key={rs.recipeId}>
                    <div className="mb-1 text-xs font-medium" style={{ color: color.text }}>
                      {rs.recipeTitle}
                    </div>
                    <div className="relative h-14 rounded-lg bg-white/5">
                      {rs.entries.map((entry, ei) => {
                        const leftPct = ((entry.start.getTime() - schedule.overallStart.getTime()) / totalSpanMs) * 100
                        const widthPct = ((entry.end.getTime() - entry.start.getTime()) / totalSpanMs) * 100
                        const showText = widthPct > 5
                        const showTime = widthPct > 15
                        return (
                          <div
                            key={ei}
                            className="absolute top-0 flex h-full flex-col justify-center overflow-hidden rounded px-1.5"
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 3)}%`,
                              backgroundColor: color.bg,
                              borderLeft: entry.isDeviceStep ? `2px solid ${color.border}` : undefined,
                              color: color.text,
                            }}
                            title={`${entry.name} ${format(entry.start, 'HH:mm')}→${format(entry.end, 'HH:mm')}`}
                          >
                            {showText && (
                              <span className="block break-all text-[9px] font-medium leading-tight">
                                {entry.name}
                              </span>
                            )}
                            {showTime && (
                              <span className="block text-[8px] leading-tight opacity-70">
                                {format(entry.start, 'HH:mm')}〜{format(entry.end, 'HH:mm')}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-text-secondary">
            調理ステップの情報がありません
          </p>
        )}
      </div>
    </div>
  )
}

interface ShareMenuModalProps {
  weekLabel: string
  shareCode: string
  importCode: string
  onImportCodeChange: (value: string) => void
  onShare: () => Promise<void>
  onImport: () => Promise<void>
  onClose: () => void
}

function ShareMenuModal({
  weekLabel,
  shareCode,
  importCode,
  onImportCodeChange,
  onShare,
  onImport,
  onClose,
}: ShareMenuModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-bg-primary p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">週間献立を共有</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-xs text-text-secondary">
          {weekLabel} の献立をリンクまたは共有コードで送信できます。
        </p>

        <button
          onClick={onShare}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-white"
        >
          <Share2 className="h-4 w-4" />
          共有リンクを作成
        </button>

        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-text-secondary">
          <Download className="h-4 w-4" />
          共有コード
        </div>
        <textarea
          readOnly
          value={shareCode}
          className="mb-4 min-h-20 w-full rounded-xl bg-white/5 p-3 text-[11px] text-text-secondary outline-none"
        />

        <div className="mb-2 text-xs font-bold text-text-secondary">受信コードを読み込み</div>
        <textarea
          value={importCode}
          onChange={(e) => onImportCodeChange(e.target.value)}
          className="mb-3 min-h-20 w-full rounded-xl bg-white/5 p-3 text-[11px] text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent/50"
          placeholder="共有コードを貼り付け"
        />
        <button
          onClick={onImport}
          className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-text-primary transition-colors hover:bg-white/20"
        >
          コードを読み込む
        </button>
      </div>
    </div>
  )
}
