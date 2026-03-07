import { useCallback, useEffect, useState } from 'react'
import { CalendarRange, UtensilsCrossed } from 'lucide-react'
import { MealPlanSettings } from '../MealPlanSettings'
import { usePreferences } from '../../hooks/usePreferences'

function normalizeTimeDraft(
  rawValue: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function formatTimeDraft(value: number, pad = false): string {
  return pad ? String(value).padStart(2, '0') : String(value)
}

interface TimeInputProps {
  value: number
  min: number
  max: number
  pad?: boolean
  testId?: string
  className: string
  onCommit: (value: number) => Promise<void>
}

function TimeInput({
  value,
  min,
  max,
  pad = false,
  testId,
  className,
  onCommit,
}: TimeInputProps) {
  const [draft, setDraft] = useState(() => formatTimeDraft(value, pad))

  useEffect(() => {
    setDraft(formatTimeDraft(value, pad))
  }, [pad, value])

  const commit = useCallback(async (rawValue: string) => {
    const nextValue = normalizeTimeDraft(rawValue, value, min, max)
    setDraft(formatTimeDraft(nextValue, pad))
    if (nextValue === value) return
    await onCommit(nextValue)
  }, [max, min, onCommit, pad, value])

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      data-testid={testId}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
      onBlur={(e) => {
        void commit(e.currentTarget.value)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        void commit((e.currentTarget as HTMLInputElement).value)
        ;(e.currentTarget as HTMLInputElement).blur()
      }}
      className={className}
    />
  )
}

export function PlanningTab() {
  const { preferences, updatePreference } = usePreferences()

  return (
    <div className="space-y-4">
      <MealPlanSettings />

      <div
        data-testid="planning-schedule-settings"
        data-preferences-updated-at={preferences.updatedAt instanceof Date ? preferences.updatedAt.toISOString() : String(preferences.updatedAt)}
        className="ui-panel"
      >
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-accent" />
          <h4 className="text-base font-bold text-text-secondary">時間とスケジュール</h4>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              食事開始希望時刻
            </label>
            <div className="flex items-center gap-1">
              <TimeInput
                value={preferences.desiredMealHour}
                min={0}
                max={23}
                testId="desired-meal-hour"
                onCommit={(value) => updatePreference('desiredMealHour', value)}
                className="ui-input w-12 px-2 py-2 text-center sm:w-14"
              />
              <span className="text-text-secondary">:</span>
              <TimeInput
                value={preferences.desiredMealMinute}
                min={0}
                max={59}
                pad
                testId="desired-meal-minute"
                onCommit={(value) => updatePreference('desiredMealMinute', value)}
                className="ui-input w-12 px-2 py-2 text-center sm:w-14"
              />
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              逆算して調理開始時刻を計算します。
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">カレンダー登録の時間帯</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={preferences.mealStartHour}
                  onChange={(e) => updatePreference('mealStartHour', Number(e.target.value))}
                  className="ui-input w-14 px-2 py-2 text-center sm:w-14"
                />
                <span className="text-text-secondary">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={String(preferences.mealStartMinute).padStart(2, '0')}
                  onChange={(e) => updatePreference('mealStartMinute', Number(e.target.value))}
                  className="ui-input w-14 px-2 py-2 text-center sm:w-14"
                />
              </div>
              <span className="text-text-secondary">〜</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={preferences.mealEndHour}
                  onChange={(e) => updatePreference('mealEndHour', Number(e.target.value))}
                  className="ui-input w-14 px-2 py-2 text-center sm:w-14"
                />
                <span className="text-text-secondary">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={String(preferences.mealEndMinute).padStart(2, '0')}
                  onChange={(e) => updatePreference('mealEndMinute', Number(e.target.value))}
                  className="ui-input w-14 px-2 py-2 text-center sm:w-14"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              週間献立や個別レシピを Google カレンダーに登録するときの予定時間帯です。
            </p>
          </div>

          <div className="ui-panel-muted flex items-start gap-2">
            <UtensilsCrossed className="mt-0.5 h-4 w-4 text-accent" />
            <p className="text-xs leading-relaxed text-text-secondary">
              食事開始希望時刻は、週間献立ページの「開始時刻」や複数レシピスケジュールの逆算にも使われます。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
