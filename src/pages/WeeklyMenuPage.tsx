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
import { Lock, Unlock, RefreshCw, ShoppingCart, Calendar, CalendarClock, Clock3, UtensilsCrossed } from 'lucide-react'
import { format, addDays, parse, addMinutes } from 'date-fns'
import { ja } from 'date-fns/locale'
import { db, type Recipe, type WeeklyMenu } from '../db/db'
import { usePreferences } from '../hooks/usePreferences'
import { useAuth } from '../hooks/useAuth'
import { useDebounce } from '../hooks/useDebounce'
import { selectWeeklyMenu, getWeekStartDate } from '../utils/weeklyMenuSelector'
import {
  aggregateIngredients,
  buildWeeklyMenuRecipesWithServings,
  filterBySeasoningOption,
  formatWeeklyShoppingListByStoreSection,
  getMissingWeeklyIngredients,
} from '../utils/weeklyShoppingUtils'
import { registerWeeklyMenuToCalendar, registerShoppingListToCalendar } from '../utils/weeklyMenuCalendar'
import { calculateMatchRate, isHelsioDeli } from '../utils/recipeUtils'
import { RecipeCard } from '../components/RecipeCard'
import { EditableShoppingList } from '../components/EditableShoppingList'
import { createWeeklyMenuShareCode, parseWeeklyMenuShareCode } from '../utils/weeklyMenuShare'
import { getNotificationPermission, showLocalNotification } from '../utils/notifications'
import { isRecipeAllowedForRole } from '../utils/mealRoleRules'
import { SwapModal } from '../components/weekly/SwapModal'
import { GanttDayModal } from '../components/weekly/GanttDayModal'
import { ShareMenuModal } from '../components/weekly/ShareMenuModal'
import { ServingsStepper } from '../components/weekly/ServingsStepper'

export function WeeklyMenuPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { preferences } = usePreferences()
  const { providerToken, signInWithGoogle, isOAuthAvailable } = useAuth()

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
  const [includeSeasonings, setIncludeSeasonings] = useState(false)
  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null)
  const [swapType, setSwapType] = useState<'main' | 'side'>('main')
  const [swapCandidates, setSwapCandidates] = useState<Recipe[]>([])
  const [swapFavorites, setSwapFavorites] = useState<Recipe[]>([])
  const [swapSearchQuery, setSwapSearchQuery] = useState('')
  const debouncedSwapSearch = useDebounce(swapSearchQuery, 250)
  const [ganttDayIndex, setGanttDayIndex] = useState<number | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCodeInput, setShareCodeInput] = useState('')
  const [swapLoading, setSwapLoading] = useState(false)

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
    setSwapLoading(true)
    try {
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
      const role = type === 'main' ? 'main' : 'side'
      const candidates = allRecipes
        .filter((r) => r.id != null && !usedIds.has(r.id) && !isHelsioDeli(r))
        .filter((r) => isRecipeAllowedForRole(r, role))
        .map(r => ({ recipe: r, matchRate: calculateMatchRate(r.ingredients ?? [], stockNames) }))
        .sort((a, b) => b.matchRate - a.matchRate)
        .map(r => r.recipe)

      const favorites = candidates.filter(r => favIds.has(r.id!))

      setSwapCandidates(candidates)
      setSwapFavorites(favorites)
      setSwapSearchQuery('')
      setSwapDayIndex(dayIndex)
      setSwapType(type)
    } catch (error) {
      console.error('Failed to open swap modal', error)
      alert('レシピ変更候補の読み込みに失敗しました。データを確認して再度お試しください。')
    } finally {
      setSwapLoading(false)
    }
  }, [menu, stockNames])

  const handleSelectSwap = useCallback(async (recipe: Recipe) => {
    if (!menu || swapDayIndex === null) return
    if (!isRecipeAllowedForRole(recipe, swapType === 'main' ? 'main' : 'side')) {
      alert('選択したレシピはこの枠に割り当てできません。')
      return
    }
    const newItems = [...menu.items]
    if (swapType === 'main') {
      newItems[swapDayIndex] = { ...newItems[swapDayIndex], recipeId: recipe.id!, mainServings: undefined }
    } else {
      newItems[swapDayIndex] = { ...newItems[swapDayIndex], sideRecipeId: recipe.id!, sideServings: undefined }
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
    return buildWeeklyMenuRecipesWithServings(menu, recipes)
  }, [menu, recipes])

  const handleAdjustServings = useCallback((dayIndex: number, type: 'main' | 'side', delta: number) => {
    if (!menu) return
    const item = menu.items[dayIndex]
    if (!item) return

    const recipe = type === 'main'
      ? recipes.get(item.recipeId)
      : item.sideRecipeId != null ? recipes.get(item.sideRecipeId) : undefined
    if (!recipe) return

    const current = type === 'main'
      ? (item.mainServings ?? recipe.baseServings)
      : (item.sideServings ?? recipe.baseServings)
    const nextValue = Math.min(10, Math.max(1, current + delta))

    const newItems = [...menu.items]
    newItems[dayIndex] = type === 'main'
      ? { ...item, mainServings: nextValue }
      : { ...item, sideServings: nextValue }

    const updated = { ...menu, items: newItems, updatedAt: new Date() }
    setMenu(updated)
    if (menu.id != null) {
      db.weeklyMenus.update(menu.id, { items: newItems, updatedAt: new Date() })
    }
  }, [menu, recipes])

  // Calendar registration
  const handleRegisterCalendar = useCallback(async () => {
    if (!menu) return
    if (!isOAuthAvailable) {
      alert('Google OAuthが未設定です。環境変数 VITE_GOOGLE_CLIENT_ID を設定してください。')
      return
    }
    if (!providerToken) {
      signInWithGoogle()
      return
    }

    setRegistering(true)
    try {
      const mealRecipes = Array.from(recipes.values())
      const result = await registerWeeklyMenuToCalendar(providerToken, menu, mealRecipes, preferences)

      if (stockItems) {
        const missing = filterBySeasoningOption(
          getMissingWeeklyIngredients(selectedRecipes, stockItems),
          includeSeasonings
        )
        if (missing.length > 0) {
          const shoppingListText = formatWeeklyShoppingListByStoreSection(weekStartStr, missing)
          await registerShoppingListToCalendar(providerToken, shoppingListText, weekStart, preferences)
        }
      }

      if (result.errors.length > 0) {
        alert(`カレンダー登録: ${result.registered}件成功 / ${result.errors.length}件失敗\n${result.errors.join('\n')}`)
      } else {
        alert(`カレンダー登録が完了しました（${result.registered}件）`)
      }
    } finally {
      setRegistering(false)
    }
  }, [includeSeasonings, isOAuthAvailable, menu, preferences, providerToken, recipes, selectedRecipes, signInWithGoogle, stockItems, weekStart, weekStartStr])

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
  const isOverlayOpen = swapDayIndex !== null || ganttDayIndex !== null || shareOpen

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

      <div className="space-y-4 pb-44">
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
                const mainServings = mainRecipe ? (item.mainServings ?? mainRecipe.baseServings) : 0
                const sideServings = sideRecipe ? (item.sideServings ?? sideRecipe.baseServings) : 0

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
                          <span className="rounded-md bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                            今日
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
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
                      type="button"
                      onClick={() => setGanttDayIndex(i)}
                      className="mb-3 flex w-full items-center justify-between rounded-xl bg-white/5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/10"
                    >
                      <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                        {cookStart && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-5 w-5 shrink-0 text-text-secondary" />
                            調理開始 <span className="font-bold text-text-primary">{format(cookStart, 'HH:mm')}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <UtensilsCrossed className="h-5 w-5 shrink-0 text-accent" />
                          いただきます <span className="font-bold text-accent">{format(desiredMealTime, 'HH:mm')}</span>
                        </span>
                      </div>
                      <CalendarClock className="h-5 w-5 shrink-0 text-text-secondary" />
                    </button>

                    {/* 2-tile grid: main | side */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Main dish */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-text-secondary">
                          <span>分量</span>
                          {mainRecipe && (
                            <ServingsStepper
                              value={mainServings}
                              ariaLabel="主菜の人数"
                              onChange={(next) => handleAdjustServings(i, 'main', next - mainServings)}
                            />
                          )}
                        </div>
                        {mainRecipe ? (
                          <RecipeCard
                            recipe={mainRecipe}
                            matchRate={mainMatchRate}
                            onClick={() => navigate(`/recipe/${mainRecipe.id}`)}
                            variant="menu"
                          />
                        ) : (
                          <div className="flex h-24 items-center justify-center rounded-xl bg-white/5 text-xs text-text-secondary">
                            レシピなし
                          </div>
                        )}
                      </div>

                      {/* Side dish */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-text-secondary">
                          <span>分量</span>
                          {sideRecipe && (
                            <ServingsStepper
                              value={sideServings}
                              ariaLabel="副菜・スープの人数"
                              onChange={(next) => handleAdjustServings(i, 'side', next - sideServings)}
                            />
                          )}
                        </div>
                        {sideRecipe ? (
                          <RecipeCard
                            recipe={sideRecipe}
                            matchRate={sideMatchRate}
                            onClick={() => navigate(`/recipe/${sideRecipe.id}`)}
                            variant="menu"
                          />
                        ) : (
                          <div className="flex h-24 items-center justify-center rounded-xl bg-white/5 text-xs text-text-secondary">
                            副菜なし
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Swap buttons */}
                    {!item.locked && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSwap(i, 'main')}
                          disabled={swapLoading}
                          className="rounded-lg bg-white/5 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-accent disabled:opacity-50"
                        >
                          {swapLoading ? '読込中...' : '主菜を変更'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSwap(i, 'side')}
                          disabled={swapLoading}
                          className="rounded-lg bg-white/5 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-accent disabled:opacity-50"
                        >
                          {swapLoading ? '読込中...' : '副菜を変更'}
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
                  ingredients={aggregateIngredients(selectedRecipes, stockItems)}
                  storageKey={`shopping_checked_${weekStartStr}`}
                  includeSeasonings={includeSeasonings}
                  onToggleIncludeSeasonings={() => setIncludeSeasonings((v) => !v)}
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

      {/* Bottom action bar — always visible in Weekly tab, above BottomNav */}
      {!isOverlayOpen && (
        <div className="fixed left-0 right-0 z-40 border-t border-border bg-bg-primary/90 backdrop-blur-xl" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
          <div className="grid grid-cols-3 gap-2 px-4 py-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-bg-card py-2.5 text-sm font-semibold transition-colors hover:bg-bg-card-hover disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              再生成
            </button>
            <button
              type="button"
              onClick={() => setShowShoppingList(prev => !prev)}
              disabled={!menu}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-bg-card py-2.5 text-sm font-semibold transition-colors hover:bg-bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" />
              買い物リスト
            </button>
            <button
              type="button"
              onClick={handleRegisterCalendar}
              disabled={!menu || registering}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Calendar className="h-4 w-4" />
              {registering ? '登録中...' : providerToken ? 'カレンダー登録' : 'ログインして登録'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
