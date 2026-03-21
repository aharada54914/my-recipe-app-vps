import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, addMinutes } from 'date-fns'
import { ArrowLeft, CalendarClock, Search, X } from 'lucide-react'
import Fuse from 'fuse.js'
import { db } from '../db/db'
import type { Recipe, RecipeSchedule, ScheduleEntry } from '../db/db'
import { calculateMultiRecipeSchedule } from '../utils/recipeUtils'
import type { DeviceConflict, MultiRecipeSchedule } from '../utils/recipeUtils'
import { useDebounce } from '../hooks/useDebounce'

const LANE_COLORS = [
  { bg: 'rgba(249, 115, 22, 0.3)', border: '#F97316', text: '#F97316' },
  { bg: 'rgba(59, 130, 246, 0.3)', border: '#3B82F6', text: '#60A5FA' },
  { bg: 'rgba(168, 85, 247, 0.3)', border: '#A855F7', text: '#C084FC' },
  { bg: 'rgba(34, 197, 94, 0.3)', border: '#22C55E', text: '#4ADE80' },
  { bg: 'rgba(236, 72, 153, 0.3)', border: '#EC4899', text: '#F472B6' },
]

function roundToNext15(date: Date): Date {
  const ms = 1000 * 60 * 15
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

interface MultiScheduleViewProps {
  onBack: () => void
}

export function MultiScheduleView({ onBack }: MultiScheduleViewProps) {
  // T-20: Lightweight listing — only id, title, totalTimeMinutes for selector
  const recipeSummaries = useLiveQuery(
    () => db.recipes.orderBy('title').toArray().then(rs => rs.map(r => ({ id: r.id!, title: r.title, totalTimeMinutes: r.totalTimeMinutes, device: r.device }))),
    []
  )
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [targetTime, setTargetTime] = useState(() => roundToNext15(addMinutes(new Date(), 90)))
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 300)

  // T-20: Fetch full recipe data only for selected items (steps needed for schedule)
  const selectedRecipes = useLiveQuery(
    async () => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return []
      return db.recipes.where('id').anyOf(ids).toArray()
    },
    [selectedIds],
    [] as Recipe[]
  )

  // Fuse.js index for fuzzy search (rebuilt only when recipe list changes)
  const fuse = useMemo(
    () => recipeSummaries
      ? new Fuse(recipeSummaries, { keys: ['title'], threshold: 0.4, ignoreLocation: true })
      : null,
    [recipeSummaries]
  )

  // Filter recipes by search query using Fuse.js fuzzy search
  const filteredResults = useMemo(() => {
    if (!fuse || !debouncedQuery.trim()) return []
    return fuse.search(debouncedQuery)
      .map(r => r.item)
      .filter(r => !selectedIds.has(r.id))
      .slice(0, 20)
  }, [fuse, debouncedQuery, selectedIds])

  const selectedSummaries = useMemo(() => {
    if (!recipeSummaries) return []
    return recipeSummaries.filter(r => selectedIds.has(r.id))
  }, [recipeSummaries, selectedIds])

  const toggleRecipe = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 5) {
        next.add(id)
      }
      return next
    })
  }

  const removeRecipe = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const adjustTime = (delta: number) => {
    setTargetTime((prev) => addMinutes(prev, delta))
  }

  const multiRecipeSchedule: MultiRecipeSchedule | null = useMemo(() => {
    if (selectedRecipes.length === 0) return null
    return calculateMultiRecipeSchedule(
      targetTime,
      selectedRecipes.map((r) => ({ recipeId: r.id!, title: r.title, steps: r.steps, device: r.device }))
    )
  }, [selectedRecipes, targetTime])

  if (!recipeSummaries) return null

  const totalSpanMs = multiRecipeSchedule
    ? targetTime.getTime() - multiRecipeSchedule.overallStart.getTime()
    : 0

  return (
    <div className="min-h-dvh bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-md flex items-center gap-3 px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
        <button
          onClick={onBack}
          className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-bold">マルチスケジュール</h1>
        </div>
      </header>

      <main className="space-y-5 px-4 pb-8">
        {/* Search bar */}
        <div>
          <h4 className="mb-2 text-xs font-bold text-text-secondary">
            レシピを検索して選択（最大5つ）
          </h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="レシピ名で検索..."
              className="w-full rounded-xl bg-bg-card py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-secondary outline-none"
            />
          </div>
        </div>

        {/* Selected chips */}
        {selectedSummaries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedSummaries.map((r) => (
              <span
                key={r.id}
                className="flex items-center gap-1.5 rounded-xl border border-accent bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent"
              >
                {r.title}
                <button
                  onClick={() => removeRecipe(r.id)}
                  className="rounded-full p-0.5 transition-colors hover:bg-accent/30"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search results */}
        {debouncedQuery.trim() && filteredResults.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-xl bg-bg-card">
            {filteredResults.map((r) => (
              <button
                key={r.id}
                onClick={() => toggleRecipe(r.id)}
                disabled={selectedIds.size >= 5}
                className="flex w-full items-center gap-2 border-b border-white/5 px-4 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-bg-card-hover disabled:opacity-30"
              >
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-[10px] text-text-secondary">
                  {r.device === 'hotcook' ? '🍲' : r.device === 'healsio' ? '♨️' : ''}
                  {r.totalTimeMinutes}分
                </span>
              </button>
            ))}
          </div>
        )}

        {debouncedQuery.trim() && filteredResults.length === 0 && (
          <p className="py-2 text-center text-xs text-text-secondary">
            該当するレシピがありません
          </p>
        )}

        {/* Target time picker */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => adjustTime(-15)}
            className="rounded-xl bg-bg-card px-3 py-1 text-sm transition-colors hover:text-accent"
          >
            -15分
          </button>
          <div className="text-center">
            <div className="text-xs text-text-secondary">いただきます</div>
            <div className="text-xl font-bold text-accent">
              {format(targetTime, 'HH:mm')}
            </div>
          </div>
          <button
            onClick={() => adjustTime(15)}
            className="rounded-xl bg-bg-card px-3 py-1 text-sm transition-colors hover:text-accent"
          >
            +15分
          </button>
        </div>

        {/* Gantt chart */}
        {multiRecipeSchedule && totalSpanMs > 0 && (
          <div className="rounded-2xl bg-bg-card p-4">
            {/* Time axis labels */}
            <div className="mb-3 flex justify-between text-[10px] text-text-secondary">
              <span>{format(multiRecipeSchedule.overallStart, 'HH:mm')}</span>
              <span className="font-bold text-accent">
                {format(targetTime, 'HH:mm')} いただきます
              </span>
            </div>

            {/* Device conflict warnings */}
            {multiRecipeSchedule.conflicts.length > 0 && (
              <div className="mb-3 rounded-xl bg-yellow-500/10 px-3 py-2">
                <div className="text-xs font-bold text-yellow-400 mb-1">⚠️ デバイス競合あり</div>
                {multiRecipeSchedule.conflicts.map((c: DeviceConflict, i: number) => (
                  <div key={i} className="text-[10px] text-yellow-300">
                    {c.device === 'hotcook' ? '🍲' : '♨️'} {c.recipeTitle}: {c.shiftMinutes}分前倒し
                  </div>
                ))}
              </div>
            )}

            {/* Lanes */}
            <div className="space-y-3">
              {multiRecipeSchedule.recipes.map((rs: RecipeSchedule) => {
                const color = LANE_COLORS[rs.colorIndex % LANE_COLORS.length]
                return (
                  <div key={rs.recipeId}>
                    <div
                      className="mb-1 text-xs font-medium"
                      style={{ color: color.text }}
                    >
                      {rs.recipeTitle}
                      {selectedRecipes.find(r => r.id === rs.recipeId)?.device === 'hotcook' && ' 🍲'}
                      {selectedRecipes.find(r => r.id === rs.recipeId)?.device === 'healsio' && ' ♨️'}
                    </div>
                    <div className="relative h-14 rounded-lg bg-white/5">
                      {rs.entries.map((entry: ScheduleEntry, i: number) => {
                        const leftPct =
                          ((entry.start.getTime() - multiRecipeSchedule.overallStart.getTime()) / totalSpanMs) * 100
                        const widthPct =
                          ((entry.end.getTime() - entry.start.getTime()) / totalSpanMs) * 100
                        const showText = widthPct > 5
                        const showTime = widthPct > 15
                        return (
                          <div
                            key={i}
                            className="absolute top-0 flex h-full flex-col justify-center overflow-hidden rounded px-1.5"
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 3)}%`,
                              backgroundColor: color.bg,
                              borderLeft: entry.isDeviceStep
                                ? `2px solid ${color.border}`
                                : undefined,
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
          </div>
        )}

        {/* Empty state */}
        {selectedIds.size === 0 && (
          <p className="py-8 text-center text-sm text-text-secondary">
            レシピを検索して選択するとスケジュールを作成できます
          </p>
        )}
      </main>
    </div>
  )
}
