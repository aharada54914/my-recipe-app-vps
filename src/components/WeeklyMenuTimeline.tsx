/**
 * Weekly Menu Timeline Component
 *
 * Displays weekly menu in a vertical timeline format.
 * Two modes:
 * - compact: Shows today + 2 days (for HomePage)
 * - full: Shows 7 days with week navigation (for WeeklyMenuPage)
 */

import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { db, type Recipe } from '../db/db'
import { getWeekStartDate } from '../utils/weeklyMenuSelector'
import { calculateMatchRate } from '../utils/recipeUtils'
import { RecipeCard } from './RecipeCard'

interface WeeklyMenuTimelineProps {
  compact?: boolean
}

export function WeeklyMenuTimeline({ compact = false }: WeeklyMenuTimelineProps) {
  const navigate = useNavigate()
  const [weekOffset, setWeekOffset] = useState(0)

  const baseWeekStart = getWeekStartDate(new Date())
  const weekStart = addDays(baseWeekStart, weekOffset * 7)
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  // Load menu for this week
  const menu = useLiveQuery(
    () => db.weeklyMenus.where('weekStartDate').equals(weekStartStr).first(),
    [weekStartStr]
  )

  // Load recipes for menu items (main + side)
  const recipeIds = useMemo(() => {
    const ids: number[] = []
    for (const item of menu?.items ?? []) {
      ids.push(item.recipeId)
      if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
    }
    return ids
  }, [menu])

  const recipesData = useLiveQuery(
    async () => {
      if (recipeIds.length === 0) return []
      return db.recipes.bulkGet(recipeIds)
    },
    [recipeIds],
    []
  )

  const recipeMap = useMemo(() => {
    const map = new Map<number, Recipe>()
    for (const r of recipesData) {
      if (r?.id != null) map.set(r.id, r)
    }
    return map
  }, [recipesData])

  // Stock for match rate
  const stockItems = useLiveQuery(
    () => db.stock.filter(s => s.inStock).toArray(),
    []
  )
  const stockNames = useMemo(
    () => new Set((stockItems ?? []).map(s => s.name)),
    [stockItems]
  )

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  if (!menu || menu.items.length === 0) {
    if (compact) {
      return (
        <div className="rounded-2xl bg-bg-card p-4">
          <h4 className="mb-2 text-sm font-bold text-text-secondary">今週の献立</h4>
          <p className="text-xs text-text-secondary">
            献立はまだ生成されていません
          </p>
          <button
            onClick={() => navigate('/weekly-menu')}
            className="mt-2 text-xs font-medium text-accent"
          >
            献立を作成する →
          </button>
        </div>
      )
    }
    return null
  }

  // For compact mode, show today + next 2 days
  const displayItems = compact
    ? menu.items.filter(item => {
        const itemDate = new Date(item.date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diff = (itemDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        return diff >= 0 && diff < 3
      })
    : menu.items

  if (compact) {
    return (
      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-text-secondary">今週の献立</h4>
          <button
            onClick={() => navigate('/weekly-menu')}
            className="text-xs font-medium text-accent"
          >
            すべて見る →
          </button>
        </div>
        <div className="space-y-2">
          {displayItems.map(item => {
            const recipe = recipeMap.get(item.recipeId)
            const isToday = item.date === todayStr
            const date = new Date(item.date + 'T00:00:00')

            return (
              <button
                key={item.date}
                onClick={() => recipe && navigate(`/recipe/${recipe.id}`)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5 ${
                  isToday ? 'bg-accent/10' : ''
                }`}
              >
                <div className="w-14 shrink-0 text-center">
                  <div className={`text-xs font-bold ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
                    {format(date, 'M/d')}
                  </div>
                  <div className={`text-[10px] ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
                    {format(date, 'E', { locale: ja })}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {recipe?.title ?? '未設定'}
                  </div>
                  {item.sideRecipeId != null && recipeMap.get(item.sideRecipeId) && (
                    <div className="truncate text-[10px] text-text-secondary">
                      + {recipeMap.get(item.sideRecipeId)!.title}
                    </div>
                  )}
                </div>
                {recipe && recipe.totalTimeMinutes > 0 && (
                  <div className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
                    <Clock className="h-3 w-3" />
                    {recipe.totalTimeMinutes}分
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Full timeline mode
  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h4 className="mb-3 text-sm font-bold text-text-secondary">週間献立</h4>

      {/* Week navigation */}
      <div className="mb-5 flex items-center justify-center gap-3">
        <button
          onClick={() => setWeekOffset(prev => prev - 1)}
          className="rounded-xl bg-bg-card-hover p-1.5 transition-colors hover:text-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-xl font-bold text-accent">
            {format(weekStart, 'M/d')} - {format(addDays(weekStart, 6), 'M/d')}
          </div>
        </div>
        <button
          onClick={() => setWeekOffset(prev => prev + 1)}
          className="rounded-xl bg-bg-card-hover p-1.5 transition-colors hover:text-accent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Vertical timeline */}
      <div className="relative ml-14 border-l-2 border-white/10 pl-6">
        {displayItems.map(item => {
          const recipe = recipeMap.get(item.recipeId)
          const isToday = item.date === todayStr
          const date = new Date(item.date + 'T00:00:00')
          const matchRate = recipe ? calculateMatchRate(recipe.ingredients, stockNames) : undefined

          return (
            <div key={item.date} className="relative pb-5 last:pb-3">
              {/* Dot */}
              <div
                className={`absolute -left-[29px] top-1 rounded-full ${
                  isToday
                    ? 'h-3 w-3 bg-accent shadow-[0_0_8px_rgba(249,115,22,0.6)]'
                    : 'h-2.5 w-2.5 bg-white/30'
                }`}
              />

              {/* Date label */}
              <div className="absolute -left-[85px] top-0 w-12 text-right">
                <div className={`text-xs ${isToday ? 'font-bold text-accent' : 'text-text-secondary'}`}>
                  {format(date, 'M/d')}
                </div>
                <div className={`text-[10px] ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
                  ({format(date, 'E', { locale: ja })})
                </div>
                {isToday && (
                  <div className="mt-0.5 text-[9px] font-bold text-accent">今日</div>
                )}
              </div>

              {/* Recipe card */}
              <div className={`${isToday ? 'rounded-xl bg-accent/5 p-1' : ''}`}>
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
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
