import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Calendar, ShoppingCart, Loader2, Check } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { usePreferences } from '../hooks/usePreferences'
import { db } from '../db/db'
import type { Recipe, Ingredient } from '../db/db'
import {
  listCalendars,
  createCalendarEvent,
  buildMealEventInput,
  buildShoppingListEventInput,
  GoogleCalendarError,
  type CalendarListEntry,
} from '../lib/googleCalendar'
import { formatQuantityVibe } from '../utils/recipeUtils'
import { getMissingIngredients } from '../utils/shoppingUtils'

interface CalendarRegistrationModalProps {
  recipe: Recipe
  stockItems: import('../db/db').StockItem[]
  onClose: () => void
}

type RegistrationMode = 'meal' | 'shopping'
type Status = 'idle' | 'loading' | 'success' | 'error'

export function CalendarRegistrationModal({
  recipe,
  stockItems,
  onClose,
}: CalendarRegistrationModalProps) {
  const { providerToken, signInWithGoogle } = useAuth()
  const { preferences } = usePreferences()

  const [mode, setMode] = useState<RegistrationMode>('meal')
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [startHour, setStartHour] = useState(preferences.mealStartHour)
  const [startMinute, setStartMinute] = useState(preferences.mealStartMinute)
  const [endHour, setEndHour] = useState(preferences.mealEndHour)
  const [endMinute, setEndMinute] = useState(preferences.mealEndMinute)
  const [enableReminder, setEnableReminder] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const [year, month, day] = date.split('-').map(Number)
  const selectedDate = new Date(year, month - 1, day)
  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const updateDatePart = useCallback((nextYear: number, nextMonth: number, nextDay: number) => {
    const safeDay = Math.min(nextDay, new Date(nextYear, nextMonth, 0).getDate())
    setDate(`${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`)
  }, [])

  // Load calendars
  useEffect(() => {
    if (!providerToken) return
    listCalendars(providerToken)
      .then((cals) => {
        setCalendars(cals)
        const defaultCal = preferences.defaultCalendarId
          ?? cals.find((c) => c.primary)?.id
          ?? cals[0]?.id
          ?? ''
        setSelectedCalendarId(defaultCal)
      })
      .catch((err) => {
        if (err instanceof GoogleCalendarError && err.status === 401) {
          setErrorMessage('カレンダーへのアクセスが期限切れです。再ログインしてください。')
        }
      })
  }, [providerToken, preferences.defaultCalendarId])

  const formatIngredientsText = useCallback((ingredients: Ingredient[]) => {
    return ingredients
      .map((ing) => `・${ing.name} ${formatQuantityVibe(ing.quantity, ing.unit)}`)
      .join('\n')
  }, [])

  const handleRegister = useCallback(async () => {
    if (!providerToken || !selectedCalendarId) return

    setStatus('loading')
    setErrorMessage('')

    try {
      const startTime = new Date(`${date}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`)
      const endTime = new Date(`${date}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`)

      let event
      if (mode === 'meal') {
        const ingredientsSummary = formatIngredientsText(recipe.ingredients)
        const reminderMinutes = enableReminder && recipe.totalTimeMinutes > 0
          ? recipe.totalTimeMinutes
          : undefined
        event = buildMealEventInput(
          recipe.title,
          ingredientsSummary,
          startTime,
          endTime,
          recipe.sourceUrl,
          reminderMinutes,
        )
      } else {
        const missing = getMissingIngredients(recipe.ingredients, stockItems)
        const missingText = missing
          .map((ing) => `・${ing.name} ${formatQuantityVibe(ing.quantity, ing.unit)}`)
          .join('\n')
        event = buildShoppingListEventInput(recipe.title, missingText, startTime)
      }

      const created = await createCalendarEvent(providerToken, selectedCalendarId, event)

      // Save to local DB
      await db.calendarEvents.add({
        recipeId: recipe.id!,
        googleEventId: created.id,
        calendarId: selectedCalendarId,
        eventType: mode,
        startTime,
        endTime: mode === 'shopping' ? new Date(startTime.getTime() + 5 * 60 * 1000) : endTime,
        createdAt: new Date(),
      })

      setStatus('success')
      setTimeout(onClose, 1500)
    } catch (err) {
      setStatus('error')
      if (err instanceof GoogleCalendarError && err.status === 401) {
        setErrorMessage('認証が期限切れです。再ログインしてください。')
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'カレンダー登録に失敗しました')
      }
    }
  }, [providerToken, selectedCalendarId, date, startHour, startMinute, endHour, endMinute, mode, recipe, stockItems, enableReminder, formatIngredientsText, onClose])

  if (!providerToken) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="w-full max-w-sm rounded-2xl bg-bg-overlay p-6" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 text-center">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-accent" />
            <h3 className="text-lg font-bold">カレンダー連携</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Googleカレンダーに献立を登録するにはログインが必要です。
            </p>
          </div>
          <button
            onClick={signInWithGoogle}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
          >
            Googleでログイン
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-xl bg-white/5 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/10"
          >
            閉じる
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bg-overlay p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">カレンダーに登録</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-text-secondary hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode('meal')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              mode === 'meal' ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'
            }`}
          >
            <Calendar className="h-4 w-4" />
            献立予定
          </button>
          <button
            onClick={() => setMode('shopping')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              mode === 'shopping' ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            買い物リスト
          </button>
        </div>

        {/* Calendar selector */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">カレンダー</label>
          <select
            value={selectedCalendarId}
            onChange={(e) => setSelectedCalendarId(e.target.value)}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-base text-text-primary outline-none"
          >
            {calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.summary}{cal.primary ? ' (メイン)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">日付</label>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={year}
              onChange={(e) => updateDatePart(Number(e.target.value), month, day)}
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-base text-text-primary outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => updateDatePart(year, Number(e.target.value), day)}
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-base text-text-primary outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
            <select
              value={day}
              onChange={(e) => updateDatePart(year, month, Number(e.target.value))}
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-base text-text-primary outline-none"
            >
              {dayOptions.map((d) => (
                <option key={d} value={d}>{d}日</option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            選択日: {format(selectedDate, 'yyyy/MM/dd')}
          </p>
        </div>

        {/* Time range (meal mode) */}
        {mode === 'meal' && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-text-secondary">時間帯</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
                />
                <span className="text-text-secondary">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={String(startMinute).padStart(2, '0')}
                  onChange={(e) => setStartMinute(Number(e.target.value))}
                  className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
                />
              </div>
              <span className="text-text-secondary">〜</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
                />
                <span className="text-text-secondary">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={String(endMinute).padStart(2, '0')}
                  onChange={(e) => setEndMinute(Number(e.target.value))}
                  className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Shopping list time */}
        {mode === 'shopping' && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-text-secondary">時刻</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
              />
              <span className="text-text-secondary">:</span>
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={String(startMinute).padStart(2, '0')}
                onChange={(e) => setStartMinute(Number(e.target.value))}
                className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
              />
            </div>
          </div>
        )}

        {/* Reminder option (meal only) */}
        {mode === 'meal' && recipe.totalTimeMinutes > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
            <input
              type="checkbox"
              checked={enableReminder}
              onChange={(e) => setEnableReminder(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm text-text-secondary">
              調理開始{recipe.totalTimeMinutes}分前にリマインダー
            </span>
          </div>
        )}

        {/* Error */}
        {errorMessage && (
          <div className="mb-3 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Register button */}
        <button
          onClick={handleRegister}
          disabled={status === 'loading' || status === 'success' || !selectedCalendarId}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              登録中...
            </>
          ) : status === 'success' ? (
            <>
              <Check className="h-4 w-4" />
              登録しました
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4" />
              {mode === 'meal' ? '献立を登録' : '買い物リストを登録'}
            </>
          )}
        </button>
      </div>
    </div>,
    document.body
  )
}
