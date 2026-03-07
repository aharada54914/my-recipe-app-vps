import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePreferences } from '../hooks/usePreferences'
import { listCalendars, GoogleCalendarError, type CalendarListEntry } from '../lib/googleCalendar'
import { StatusNotice } from './StatusNotice'
import { getCalendarIntegrationStatus } from '../lib/integrationStatus'

export function CalendarSettings() {
  const { user, providerToken, isQaGoogleMode, signInWithGoogle, isOAuthAvailable } = useAuth()
  const { preferences, updatePreference } = usePreferences()
  const selectorRef = useRef<HTMLDivElement>(null)

  const [calendars, setCalendars] = useState<CalendarListEntry[]>([])
  const [loading, setLoading] = useState(!!providerToken)
  const [error, setError] = useState('')

  const loadCalendars = useCallback(async () => {
    if (!providerToken) {
      setCalendars([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const cals = await listCalendars(providerToken)
      setCalendars(cals)
      setError('')
    } catch (err) {
      if (err instanceof GoogleCalendarError && err.status === 401) {
        setError('カレンダーへのアクセスが期限切れです。再ログインしてください。')
      } else {
        setError('カレンダーの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [providerToken])

  useEffect(() => {
    void loadCalendars()
  }, [loadCalendars])

  const calendarStatus = useMemo(() => getCalendarIntegrationStatus({
    isOAuthAvailable,
    userPresent: !!user,
    providerTokenPresent: !!providerToken,
    isQaMode: isQaGoogleMode,
    loading,
    error,
    calendarCount: calendars.length,
    selectedCalendarIdPresent: !!preferences.defaultCalendarId,
  }), [calendars.length, error, isOAuthAvailable, isQaGoogleMode, loading, preferences.defaultCalendarId, providerToken, user])

  const handleStatusAction = () => {
    switch (calendarStatus.actionId) {
      case 'configure-google-client':
        window.location.assign('/settings/account')
        return
      case 'sign-in-google':
        signInWithGoogle()
        return
      case 'retry-calendar':
        void loadCalendars()
        return
      case 'qa-calendar':
        selectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      default:
        return
    }
  }

  if (!user || !providerToken) {
    return (
      <div className="ui-panel">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          <h4 className="text-base font-bold text-text-secondary">カレンダー設定</h4>
        </div>
        <StatusNotice
          tone={calendarStatus.tone}
          title={calendarStatus.title}
          message={calendarStatus.message}
          actionLabel={calendarStatus.actionLabel}
          onAction={calendarStatus.actionLabel ? handleStatusAction : undefined}
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>
    )
  }

  return (
    <div className="ui-panel">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-accent" />
        <h4 className="text-base font-bold text-text-secondary">カレンダー設定</h4>
      </div>

      <StatusNotice
        tone={calendarStatus.tone}
        title={calendarStatus.title}
        message={calendarStatus.message}
        actionLabel={calendarStatus.actionLabel}
        onAction={calendarStatus.actionLabel ? handleStatusAction : undefined}
        icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
        className="mb-4"
      />

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : error ? null : (
        <div ref={selectorRef} className="space-y-4">
          <div>
            <label className="ui-field-label">デフォルト登録先カレンダー</label>
            <select
              value={preferences.defaultCalendarId ?? ''}
              onChange={(e) => updatePreference('defaultCalendarId', e.target.value || undefined)}
              className="ui-input"
            >
              <option value="">選択してください</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.summary}{cal.primary ? ' (メイン)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ui-field-label">家族カレンダー</label>
            <select
              value={preferences.familyCalendarId ?? ''}
              onChange={(e) => updatePreference('familyCalendarId', e.target.value || undefined)}
              className="ui-input"
            >
              <option value="">選択してください</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.summary}{cal.primary ? ' (メイン)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary">
              家族の予定から献立を提案します
            </p>
          </div>

          <div>
            <label className="ui-field-label">献立の時間帯</label>
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
          </div>
        </div>
      )}
    </div>
  )
}
