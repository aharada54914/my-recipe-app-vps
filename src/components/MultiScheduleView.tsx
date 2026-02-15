import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, addMinutes } from 'date-fns'
import { ArrowLeft, CalendarClock } from 'lucide-react'
import { db } from '../db/db'
import type { Recipe } from '../db/db'
import { calculateMultiRecipeSchedule } from '../utils/recipeUtils'

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
    () => db.recipes.toArray().then(rs => rs.map(r => ({ id: r.id!, title: r.title, totalTimeMinutes: r.totalTimeMinutes, device: r.device }))),
    []
  )
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [targetTime, setTargetTime] = useState(() => roundToNext15(addMinutes(new Date(), 90)))

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

  const adjustTime = (delta: number) => {
    setTargetTime((prev) => addMinutes(prev, delta))
  }

  const multiSchedule = useMemo(() => {
    if (selectedRecipes.length === 0) return null
    return calculateMultiRecipeSchedule(
      targetTime,
      selectedRecipes.map((r) => ({ recipeId: r.id!, title: r.title, steps: r.steps, device: r.device }))
    )
  }, [selectedRecipes, targetTime])

  if (!recipeSummaries) return null

  const totalSpanMs = multiSchedule
    ? targetTime.getTime() - multiSchedule.overallStart.getTime()
    : 0

  return (
    <div className="min-h-dvh bg-bg-primary">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
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
        {/* Recipe selector */}
        <div>
          <h4 className="mb-2 text-xs font-bold text-text-secondary">
            レシピを選択（最大5つ）
          </h4>
          <div className="flex flex-wrap gap-2">
            {recipeSummaries.map((r) => {
              const isSelected = selectedIds.has(r.id!)
              return (
                <button
                  key={r.id}
                  onClick={() => toggleRecipe(r.id!)}
                  className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${isSelected
                    ? 'border border-accent bg-accent/20 text-accent'
                    : 'bg-bg-card text-text-secondary hover:bg-bg-card-hover'
                    }`}
                >
                  {r.title}
                  <span className="ml-1 opacity-50">
                    {recipeSummaries.find(s => s.id === r.id)?.device === 'hotcook' ? '🍲' : recipeSummaries.find(s => s.id === r.id)?.device === 'healsio' ? '♨️' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

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
        {multiSchedule && totalSpanMs > 0 && (
          <div className="rounded-2xl bg-bg-card p-4">
            {/* Time axis labels */}
            <div className="mb-3 flex justify-between text-[10px] text-text-secondary">
              <span>{format(multiSchedule.overallStart, 'HH:mm')}</span>
              <span className="font-bold text-accent">
                {format(targetTime, 'HH:mm')} いただきます
              </span>
            </div>

            {/* Device conflict warnings */}
            {multiSchedule.conflicts.length > 0 && (
              <div className="mb-3 rounded-xl bg-yellow-500/10 px-3 py-2">
                <div className="text-xs font-bold text-yellow-400 mb-1">⚠️ デバイス競合あり</div>
                {multiSchedule.conflicts.map((c, i) => (
                  <div key={i} className="text-[10px] text-yellow-300">
                    {c.device === 'hotcook' ? '🍲' : '♨️'} {c.recipeTitle}: {c.shiftMinutes}分前倒し
                  </div>
                ))}
              </div>
            )}

            {/* Lanes */}
            <div className="space-y-3">
              {multiSchedule.recipes.map((rs) => {
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
                    <div className="relative h-9 rounded-lg bg-white/5">
                      {rs.entries.map((entry, i) => {
                        const leftPct =
                          ((entry.start.getTime() - multiSchedule.overallStart.getTime()) / totalSpanMs) * 100
                        const widthPct =
                          ((entry.end.getTime() - entry.start.getTime()) / totalSpanMs) * 100
                        return (
                          <div
                            key={i}
                            className="absolute top-0 flex h-full items-center overflow-hidden rounded px-1.5 text-[10px] font-medium whitespace-nowrap"
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
                            {entry.name}
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
            レシピを選択してスケジュールを作成
          </p>
        )}
      </main>
    </div>
  )
}
