import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { parse, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarClock, X } from 'lucide-react'
import type { Recipe, RecipeSchedule } from '../../db/db'
import type { DeviceConflict } from '../../utils/recipeUtils'
import { calculateMultiRecipeSchedule } from '../../utils/recipeUtils'

const LANE_COLORS = [
    { bg: 'rgba(249,115,22,0.25)', border: '#F97316', text: '#F97316' },
    { bg: 'rgba(59,130,246,0.25)', border: '#3B82F6', text: '#60A5FA' },
]

export interface GanttDayModalProps {
    item: { recipeId: number; sideRecipeId?: number; date: string }
    mainRecipe: Recipe | undefined
    sideRecipe: Recipe | undefined
    desiredMealTime: Date
    onClose: () => void
}

export function GanttDayModal({ item, mainRecipe, sideRecipe, desiredMealTime, onClose }: GanttDayModalProps) {
    const recipeInputs = useMemo(() => {
        const list: { recipeId: number; title: string; steps: Recipe['steps']; device: Recipe['device'] }[] = []
        if (mainRecipe) list.push({ recipeId: mainRecipe.id!, title: mainRecipe.title, steps: mainRecipe.steps, device: mainRecipe.device })
        if (sideRecipe) list.push({ recipeId: sideRecipe.id!, title: sideRecipe.title, steps: sideRecipe.steps, device: sideRecipe.device })
        return list
    }, [mainRecipe, sideRecipe])

    const schedule = useMemo(() => {
        if (recipeInputs.length === 0) return null
        try {
            return calculateMultiRecipeSchedule(desiredMealTime, recipeInputs)
        } catch (error) {
            console.error('Failed to calculate gantt schedule', error)
            return null
        }
    }, [recipeInputs, desiredMealTime])

    const totalSpanMs = schedule
        ? desiredMealTime.getTime() - schedule.overallStart.getTime()
        : 0

    const date = parse(item.date, 'yyyy-MM-dd', new Date())

    return createPortal(
        <div
            className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60"
            onClick={onClose}
        >
            <div
                className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-bg-primary p-4 pb-8"
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
                    <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-accent cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="overflow-y-auto pr-1">
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
                                    {schedule.conflicts.map((c: DeviceConflict, ci: number) => (
                                        <div key={ci} className="text-[10px] text-yellow-300">
                                            {c.device === 'hotcook' ? '🍲' : '♨️'} {c.recipeTitle}: {c.shiftMinutes}分前倒し
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Gantt lanes */}
                            <div className="overflow-x-auto pb-1">
                                <div className="min-w-[320px] space-y-3">
                                    {schedule.recipes.map((rs: RecipeSchedule) => {
                                        const color = LANE_COLORS[rs.colorIndex % LANE_COLORS.length]
                                        return (
                                            <div key={rs.recipeId}>
                                                <div className="mb-1 text-xs font-medium" style={{ color: color.text }}>
                                                    {rs.recipeTitle}
                                                </div>
                                                <div className="relative h-14 rounded-lg bg-white/5">
                                                    {rs.entries.map((entry, ei: number) => {
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
                            </div>
                        </>
                    ) : (
                        <p className="py-6 text-center text-sm text-text-secondary">
                            調理ステップの情報がありません
                        </p>
                    )}
                </div>
            </div>
        </div >,
        document.body
    )
}
