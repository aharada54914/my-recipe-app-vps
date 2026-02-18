import { useState, useEffect } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePreferences } from '../hooks/usePreferences'
import { listCalendars, GoogleCalendarError, type CalendarListEntry } from '../lib/googleCalendar'

export function CalendarSettings() {
  const { user, providerToken } = useAuth()
  const { preferences, updatePreference } = usePreferences()

  const [calendars, setCalendars] = useState<CalendarListEntry[]>([])
  const [loading, setLoading] = useState(!!providerToken)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!providerToken) return

    let cancelled = false
    listCalendars(providerToken)
      .then((cals) => {
        if (!cancelled) {
          setCalendars(cals)
          setError('')
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof GoogleCalendarError && err.status === 401) {
          setError('カレンダーへのアクセスが期限切れです。再ログインしてください。')
        } else {
          setError('カレンダーの取得に失敗しました')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [providerToken])

  if (!user || !providerToken) {
    return (
      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-bold text-text-secondary">カレンダー設定</h4>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Googleカレンダーと連携するにはログインしてください。
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-accent" />
        <h4 className="text-sm font-bold text-text-secondary">カレンダー設定</h4>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : (
        <div className="space-y-3">
          {/* Default calendar */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              デフォルト登録先カレンダー
            </label>
            <select
              value={preferences.defaultCalendarId ?? ''}
              onChange={(e) => updatePreference('defaultCalendarId', e.target.value || undefined)}
              className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-base text-text-primary outline-none"
            >
              <option value="">選択してください</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.summary}{cal.primary ? ' (メイン)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Family calendar */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              家族カレンダー
            </label>
            <select
              value={preferences.familyCalendarId ?? ''}
              onChange={(e) => updatePreference('familyCalendarId', e.target.value || undefined)}
              className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-base text-text-primary outline-none"
            >
              <option value="">選択してください</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.summary}{cal.primary ? ' (メイン)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-text-secondary">
              家族の予定から献立を提案します
            </p>
          </div>

          {/* Meal time range */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              献立の時間帯
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={preferences.mealStartHour}
                  onChange={(e) => updatePreference('mealStartHour', Number(e.target.value))}
                  className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
                />
                <span className="text-text-secondary">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={String(preferences.mealStartMinute).padStart(2, '0')}
                  onChange={(e) => updatePreference('mealStartMinute', Number(e.target.value))}
                  className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
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
                  className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
                />
                <span className="text-text-secondary">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={String(preferences.mealEndMinute).padStart(2, '0')}
                  onChange={(e) => updatePreference('mealEndMinute', Number(e.target.value))}
                  className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
