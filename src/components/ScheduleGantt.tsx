import { useState, useMemo } from 'react'
import { format, addMinutes } from 'date-fns'
import type { CookingStep } from '../db/db'
import { calculateSchedule } from '../utils/recipeUtils'

interface ScheduleGanttProps {
  steps: CookingStep[]
}

function roundToNext15(date: Date): Date {
  const ms = 1000 * 60 * 15
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

export function ScheduleGantt({ steps }: ScheduleGanttProps) {
  const [targetTime, setTargetTime] = useState(() => roundToNext15(addMinutes(new Date(), 60)))

  const schedule = useMemo(
    () => calculateSchedule(targetTime, steps),
    [targetTime, steps]
  )

  const adjustTime = (delta: number) => {
    setTargetTime((prev) => addMinutes(prev, delta))
  }

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h4 className="mb-3 text-sm font-bold text-text-secondary">逆算スケジュール</h4>

      {/* Target time picker */}
      <div className="mb-5 flex items-center justify-center gap-3">
        <button
          onClick={() => adjustTime(-15)}
          className="rounded-xl bg-bg-card-hover px-3 py-1 text-sm transition-colors hover:text-accent"
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
          className="rounded-xl bg-bg-card-hover px-3 py-1 text-sm transition-colors hover:text-accent"
        >
          +15分
        </button>
      </div>

      {/* Vertical timeline */}
      <div className="relative ml-14 border-l-2 border-white/10 pl-6">
        {schedule.map((entry, i) => (
          <div key={i} className="relative pb-5 last:pb-3">
            {/* Dot on the timeline line */}
            <div
              className={`absolute -left-[29px] top-1 h-2.5 w-2.5 rounded-full ${
                entry.isDeviceStep
                  ? 'bg-accent shadow-[0_0_8px_rgba(249,115,22,0.6)]'
                  : 'bg-white/30'
              }`}
            />

            {/* Time label */}
            <div className="absolute -left-[85px] top-0 w-12 text-right text-xs text-text-secondary">
              {format(entry.start, 'HH:mm')}
            </div>

            {/* Step bar */}
            <div
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                entry.isDeviceStep
                  ? 'border-l-2 border-accent bg-gradient-to-r from-accent/40 to-accent/15 text-accent shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                  : 'border-l-2 border-white/20 bg-white/8 text-text-primary'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{entry.name}</span>
                <span className="ml-2 opacity-60">{steps[i].durationMinutes}分</span>
              </div>
              <div className="mt-0.5 text-[10px] opacity-40">
                {format(entry.start, 'HH:mm')} → {format(entry.end, 'HH:mm')}
              </div>
            </div>
          </div>
        ))}

        {/* Terminal: いただきます */}
        <div className="relative pb-1">
          <div className="absolute -left-[29px] top-0.5 h-3 w-3 rounded-full bg-accent shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
          <div className="absolute -left-[85px] top-0 w-12 text-right text-xs text-text-secondary">
            {format(targetTime, 'HH:mm')}
          </div>
          <div className="text-sm font-bold text-accent">
            いただきます
          </div>
        </div>
      </div>
    </div>
  )
}
