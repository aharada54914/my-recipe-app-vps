import { Bell } from 'lucide-react'
import { useState } from 'react'
import { usePreferences } from '../hooks/usePreferences'
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from '../utils/notifications'

function ToggleButton({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative h-7 w-12 rounded-full transition-colors ${
        enabled ? 'bg-accent' : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
          enabled ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export function NotificationSettings() {
  const { preferences, updatePreference } = usePreferences()
  const [permission, setPermission] = useState<NotificationPermission>(() => getNotificationPermission())

  const cookingDisabled = !preferences.cookingNotifyEnabled

  const handleRequestPermission = async () => {
    const next = await requestNotificationPermission()
    setPermission(next)
  }

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-accent" />
        <h4 className="text-base font-bold text-text-secondary">通知設定</h4>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <div className="mb-1 text-sm font-medium text-text-secondary">ブラウザ通知権限</div>
          {!isNotificationSupported() ? (
            <p className="text-sm text-red-400">この環境は通知APIに未対応です。</p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-primary">
                状態: {permission === 'granted' ? '許可済み' : permission === 'denied' ? '拒否' : '未許可'}
              </p>
              {permission !== 'granted' && (
                <button
                  onClick={handleRequestPermission}
                  className="ui-btn ui-btn-primary px-3 py-1.5 text-sm"
                >
                  通知を許可
                </button>
              )}
            </div>
          )}
        </div>

        {/* Cooking start notification */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-primary">調理開始通知</span>
            <ToggleButton
              enabled={preferences.cookingNotifyEnabled}
              onChange={(v) => updatePreference('cookingNotifyEnabled', v)}
            />
          </div>
        </div>

        {/* Notification time */}
        <div className={cookingDisabled ? 'opacity-40 pointer-events-none' : ''}>
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            通知時刻
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={23}
              value={preferences.cookingNotifyHour}
              onChange={(e) => updatePreference('cookingNotifyHour', Number(e.target.value))}
              className="w-12 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none sm:w-14"
            />
            <span className="text-text-secondary">:</span>
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              value={String(preferences.cookingNotifyMinute).padStart(2, '0')}
              onChange={(e) => updatePreference('cookingNotifyMinute', Number(e.target.value))}
              className="w-12 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none sm:w-14"
            />
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            この時刻に今日の調理開始時刻を通知します
          </p>
        </div>

        {/* Desired meal time */}
        <div className={cookingDisabled ? 'opacity-40 pointer-events-none' : ''}>
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            食事開始希望時刻
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={23}
              value={preferences.desiredMealHour}
              onChange={(e) => updatePreference('desiredMealHour', Number(e.target.value))}
              className="w-12 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none sm:w-14"
            />
            <span className="text-text-secondary">:</span>
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              value={String(preferences.desiredMealMinute).padStart(2, '0')}
              onChange={(e) => updatePreference('desiredMealMinute', Number(e.target.value))}
              className="w-12 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none sm:w-14"
            />
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            逆算して調理開始時刻を計算します
          </p>
        </div>

        {/* Weekly menu notification */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-primary">週間献立完了通知</span>
          <ToggleButton
            enabled={preferences.notifyWeeklyMenuDone}
            onChange={(v) => updatePreference('notifyWeeklyMenuDone', v)}
          />
        </div>

        {/* Shopping list notification */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-primary">買い物リスト通知</span>
          <ToggleButton
            enabled={preferences.notifyShoppingListDone}
            onChange={(v) => updatePreference('notifyShoppingListDone', v)}
          />
        </div>
      </div>
    </div>
  )
}
