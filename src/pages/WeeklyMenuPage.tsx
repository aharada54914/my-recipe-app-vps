/**
 * Weekly Menu Preview/Edit Page
 *
 * Shows 7 days of selected recipes with lock, swap, regenerate,
 * calendar registration, and shopping list features.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Lock, Unlock, RefreshCw, Calendar, ShoppingCart, Copy, Check } from 'lucide-react'
import { format, addDays, parse } from 'date-fns'
import { ja } from 'date-fns/locale'
import { db, type Recipe, type WeeklyMenu } from '../db/db'
import { usePreferences } from '../hooks/usePreferences'
import { useAuth } from '../hooks/useAuth'
import { RecipeCard } from '../components/RecipeCard'
import { selectWeeklyMenu, getWeekStartDate, getAlternativeRecipes } from '../utils/weeklyMenuSelector'
import { aggregateIngredients, formatWeeklyShoppingList, getMissingWeeklyIngredients } from '../utils/weeklyShoppingUtils'
import { registerWeeklyMenuToCalendar, registerShoppingListToCalendar } from '../utils/weeklyMenuCalendar'
import { calculateMatchRate } from '../utils/recipeUtils'
import { copyToClipboard } from '../utils/shoppingUtils'

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
  const [alternatives, setAlternatives] = useState<Recipe[]>([])

  const stockItems = useLiveQuery(() => db.stock.filter(s => s.inStock).toArray(), [])
  const stockNames = useMemo(() => new Set((stockItems ?? []).map(s => s.name)), [stockItems])

  // Load existing menu from DB
  useEffect(() => {
    if (existingMenu) {
      setMenu(existingMenu)
      loadRecipes(existingMenu.items.map(i => i.recipeId))
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
        supabaseId: menu?.supabaseId,
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
      await loadRecipes(items.map(i => i.recipeId))
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
  const handleOpenSwap = useCallback(async (dayIndex: number) => {
    if (!menu) return
    const usedIds = new Set(menu.items.map(i => i.recipeId))
    const alts = await getAlternativeRecipes(usedIds, 10)
    setAlternatives(alts)
    setSwapDayIndex(dayIndex)
  }, [menu])

  const handleSelectSwap = useCallback(async (recipe: Recipe) => {
    if (!menu || swapDayIndex === null) return
    const newItems = [...menu.items]
    newItems[swapDayIndex] = { ...newItems[swapDayIndex], recipeId: recipe.id! }
    const updated = { ...menu, items: newItems, updatedAt: new Date() }
    setMenu(updated)
    setRecipes(prev => new Map(prev).set(recipe.id!, recipe))
    setSwapDayIndex(null)
    if (menu.id != null) {
      db.weeklyMenus.update(menu.id, { items: newItems, updatedAt: new Date() })
    }
  }, [menu, swapDayIndex])

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

      // Register shopping list too
      if (stockItems) {
        const missing = getMissingWeeklyIngredients(recipeList, stockItems)
        if (missing.length > 0) {
          const text = formatWeeklyShoppingList(weekStartStr, missing)
          await registerShoppingListToCalendar(
            providerToken,
            text,
            weekStart,
            preferences
          )
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

  const weekEndStr = format(addDays(weekStart, 6), 'M/d')
  const weekStartDisplay = format(weekStart, 'M/d')

  return (
    <div>
      <h2 className="pt-4 pb-3 text-lg font-bold">週間献立</h2>

      <div className="space-y-4 pb-16">
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
                const recipe = recipes.get(item.recipeId)
                const date = parse(item.date, 'yyyy-MM-dd', new Date())
                const isToday = format(new Date(), 'yyyy-MM-dd') === item.date
                const matchRate = recipe ? calculateMatchRate(recipe.ingredients, stockNames) : undefined

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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleLock(i)}
                          className="rounded-lg p-1.5 text-text-secondary transition-colors hover:text-accent"
                        >
                          {item.locked
                            ? <Lock className="h-4 w-4 text-accent" />
                            : <Unlock className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Recipe card */}
                    {recipe ? (
                      <RecipeCard
                        recipe={recipe}
                        matchRate={matchRate}
                        onClick={() => navigate(`/recipe/${recipe.id}`)}
                      />
                    ) : (
                      <div className="rounded-xl bg-white/5 p-3 text-center text-xs text-text-secondary">
                        レシピが見つかりません
                      </div>
                    )}

                    {/* Swap button */}
                    {!item.locked && (
                      <button
                        onClick={() => handleOpenSwap(i)}
                        className="mt-2 w-full rounded-lg bg-white/5 py-1.5 text-xs text-text-secondary transition-colors hover:text-accent"
                      >
                        変更
                      </button>
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
              <h3 className="mb-3 text-sm font-bold">代替レシピを選択</h3>
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
