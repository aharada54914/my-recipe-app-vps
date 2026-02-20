/**
 * Weekly Menu Preview/Edit Page
 *
 * Shows 7 days of selected recipes with lock, swap, regenerate,
 * calendar registration, and shopping list features.
 * Each day shows main dish + side dish in a 2-tile horizontal grid.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Lock, Unlock, RefreshCw, Calendar, ShoppingCart, Copy, Check, CalendarClock, X } from 'lucide-react'
import { format, addDays, parse, addMinutes } from 'date-fns'
import { ja } from 'date-fns/locale'
import { db, type Recipe, type WeeklyMenu } from '../db/db'
import { usePreferences } from '../hooks/usePreferences'
import { useAuth } from '../hooks/useAuth'
import { RecipeCard } from '../components/RecipeCard'
import { selectWeeklyMenu, getWeekStartDate, getAlternativeRecipes } from '../utils/weeklyMenuSelector'
import { aggregateIngredients, formatWeeklyShoppingList, getMissingWeeklyIngredients } from '../utils/weeklyShoppingUtils'
import { registerWeeklyMenuToCalendar, registerShoppingListToCalendar } from '../utils/weeklyMenuCalendar'
import { calculateMatchRate, calculateMultiRecipeSchedule } from '../utils/recipeUtils'
import { copyToClipboard } from '../utils/shoppingUtils'

const LANE_COLORS = [
  { bg: 'rgba(249,115,22,0.25)', border: '#F97316', text: '#F97316' },
  { bg: 'rgba(59,130,246,0.25)', border: '#3B82F6', text: '#60A5FA' },
]

export function WeeklyMenuPage() {
  const navigate = useNavigate()
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
  const [copied, setCopied] = useState(false)
  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null)
  const [swapType, setSwapType] = useState<'main' | 'side'>('main')
  const [alternatives, setAlternatives] = useState<Recipe[]>([])
  const [ganttDayIndex, setGanttDayIndex] = useState<number | null>(null)

  const stockItems = useLiveQuery(() => db.stock.filter(s => s.inStock).toArray(), [])
  const stockNames = useMemo(() => new Set((stockItems ?? []).map(s => s.name)), [stockItems])

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
  }, [existingMenu])

  const loadRecipes = useCallback(async (recipeIds: number[]) => {
    const loaded = await db.recipes.bulkGet(recipeIds)
    const map = new Map<number, Recipe>()
    for (const r of loaded) {
      if (r?.id != null) map.set(r.id, r)
    }
    setRecipes(map)
  }, [])

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
    const alts = await getAlternativeRecipes(usedIds, 10)
    setAlternatives(alts)
    setSwapDayIndex(dayIndex)
    setSwapType(type)
  }, [menu])

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

  // Calendar registration
  const handleRegisterCalendar = useCallback(async () => {
    if (!menu || !providerToken) return
    setRegistering(true)
    try {
      const recipeList = menu.items.map(i => recipes.get(i.recipeId)).filter(Boolean) as Recipe[]
      const result = await registerWeeklyMenuToCalendar(providerToken, menu, recipeList, preferences)

      if (result.errors.length > 0) {
        alert(`${result.registered}件登録、${result.errors.length}件エラー:\n${result.errors.join('\n')}`)
      }

      if (stockItems) {
        const missing = getMissingWeeklyIngredients(recipeList, stockItems)
        if (missing.length > 0) {
          const text = formatWeeklyShoppingList(weekStartStr, missing)
          await registerShoppingListToCalendar(providerToken, text, weekStart, preferences)
        }
      }
    } finally {
      setRegistering(false)
    }
  }, [menu, providerToken, recipes, preferences, stockItems, weekStart, weekStartStr])

  // Shopping list copy
  const handleCopyShoppingList = useCallback(async () => {
    if (!menu || !stockItems) return
    const recipeList = menu.items.map(i => recipes.get(i.recipeId)).filter(Boolean) as Recipe[]
    const aggregated = aggregateIngredients(recipeList, stockItems)
    const text = formatWeeklyShoppingList(weekStartStr, aggregated)
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [menu, recipes, stockItems, weekStartStr])

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

  return (
    <div>
      <h2 className="pt-4 pb-3 text-lg font-bold">週間献立</h2>

      <div className="space-y-4 pb-24">
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
                    className={`rounded-2xl bg-bg-card p-3 ${isToday ? 'ring-1 ring-accent/40' : ''}`}
                  >
                    {/* Day header */}
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isToday ? 'text-accent' : 'text-text-primary'}`}>
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
                      className="mb-2 flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-1.5 text-left transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-center gap-3 text-[11px] text-text-secondary">
                        {cookStart && (
                          <span>🕐 調理開始 <span className="font-bold text-text-primary">{format(cookStart, 'HH:mm')}</span></span>
                        )}
                        <span>🍽 いただきます <span className="font-bold text-accent">{format(desiredMealTime, 'HH:mm')}</span></span>
                      </div>
                      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                    </button>

                    {/* 2-tile grid: main | side */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Main dish */}
                      <div>
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-text-secondary">主菜</div>
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
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-text-secondary">副菜・スープ</div>
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
                      <div className="mt-2 grid grid-cols-2 gap-2">
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
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-text-secondary">買い物リスト</h4>
                  <button
                    onClick={handleCopyShoppingList}
                    className="flex items-center gap-1 rounded-lg bg-bg-card-hover px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:text-accent"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'コピー済み' : 'LINEに送る'}
                  </button>
                </div>
                <ShoppingListContent
                  menu={menu}
                  recipes={recipes}
                  stockItems={stockItems}
                />
              </div>
            )}
          </>
        )}

        {/* Swap modal */}
        {swapDayIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setSwapDayIndex(null)}>
            <div
              className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg-primary p-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="mb-3 text-sm font-bold">
                {swapType === 'main' ? '主菜' : '副菜・スープ'}を変更
              </h3>
              <div className="space-y-2">
                {alternatives.map(recipe => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
                    onClick={() => handleSelectSwap(recipe)}
                  />
                ))}
              </div>
              <button
                onClick={() => setSwapDayIndex(null)}
                className="mt-4 w-full rounded-xl bg-bg-card py-3 text-sm text-text-secondary"
              >
                キャンセル
              </button>
            </div>
          </div>
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
      </div>

      {/* Bottom action bar — positioned above BottomNav */}
      {menu && (
        <div className="fixed bottom-[56px] left-0 right-0 border-t border-border bg-bg-primary/95 backdrop-blur-lg">
          <div className="flex gap-2 px-4 py-2">
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

// --- Sub-component: Shopping List Content ---

function ShoppingListContent({
  menu,
  recipes,
  stockItems,
}: {
  menu: WeeklyMenu
  recipes: Map<number, Recipe>
  stockItems: { name: string; inStock: boolean }[]
}) {
  const recipeList = menu.items
    .map(i => recipes.get(i.recipeId))
    .filter(Boolean) as Recipe[]

  const aggregated = aggregateIngredients(recipeList, stockItems as never[])
  const missing = aggregated.filter(i => !i.inStock)
  const inStock = aggregated.filter(i => i.inStock)

  return (
    <div className="space-y-3">
      {missing.length === 0 ? (
        <p className="text-xs text-green-400">全ての材料が揃っています！</p>
      ) : (
        <div>
          <div className="mb-1 text-xs font-medium text-accent">不足材料 ({missing.length}件)</div>
          <ul className="space-y-1">
            {missing.map(ing => (
              <li key={`${ing.name}_${ing.unit}`} className="flex justify-between text-xs text-text-secondary">
                <span>・{ing.name}</span>
                <span>{ing.unit === '適量' ? '適量' : `${Math.round(ing.totalQuantity * 10) / 10}${ing.unit}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {inStock.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-text-secondary">在庫あり ({inStock.length}件)</div>
          <ul className="space-y-1">
            {inStock.map(ing => (
              <li key={`${ing.name}_${ing.unit}`} className="flex justify-between text-xs text-text-secondary line-through opacity-50">
                <span>・{ing.name}</span>
                <span>{ing.unit === '適量' ? '適量' : `${Math.round(ing.totalQuantity * 10) / 10}${ing.unit}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
