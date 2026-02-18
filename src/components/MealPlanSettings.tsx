import { UtensilsCrossed } from 'lucide-react'
import { usePreferences } from '../hooks/usePreferences'
import type { SeasonalPriority } from '../db/db'

const DAY_LABELS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']

const PRIORITY_OPTIONS: { value: SeasonalPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]

export function MealPlanSettings() {
  const { preferences, updatePreference } = usePreferences()

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <UtensilsCrossed className="h-4 w-4 text-accent" />
        <h4 className="text-sm font-bold text-text-secondary">献立設定</h4>
      </div>

      <div className="space-y-3">
        {/* Weekly menu generation timing */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            週間献立の自動生成
          </label>
          <div className="flex items-center gap-2">
            <select
              value={preferences.weeklyMenuGenerationDay}
              onChange={(e) => updatePreference('weeklyMenuGenerationDay', Number(e.target.value))}
              className="rounded-xl bg-white/5 px-3 py-2.5 text-base text-text-primary outline-none"
            >
              {DAY_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={23}
                value={preferences.weeklyMenuGenerationHour}
                onChange={(e) => updatePreference('weeklyMenuGenerationHour', Number(e.target.value))}
                className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
              />
              <span className="text-text-secondary">:</span>
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={String(preferences.weeklyMenuGenerationMinute).padStart(2, '0')}
                onChange={(e) => updatePreference('weeklyMenuGenerationMinute', Number(e.target.value))}
                className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Shopping list time */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            買い物リスト登録時間
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={23}
              value={preferences.shoppingListHour}
              onChange={(e) => updatePreference('shoppingListHour', Number(e.target.value))}
              className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
            />
            <span className="text-text-secondary">:</span>
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              value={String(preferences.shoppingListMinute).padStart(2, '0')}
              onChange={(e) => updatePreference('shoppingListMinute', Number(e.target.value))}
              className="w-14 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
            />
          </div>
        </div>

        {/* Seasonal priority */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            旬の食材優先度
          </label>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updatePreference('seasonalPriority', opt.value)}
                className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                  preferences.seasonalPriority === opt.value
                    ? 'bg-accent text-white'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-text-secondary">
            {preferences.seasonalPriority === 'low' && '旬の食材をたまに入れます'}
            {preferences.seasonalPriority === 'medium' && '旬の食材を適度に入れます'}
            {preferences.seasonalPriority === 'high' && '旬の食材を積極的に入れます'}
          </p>
        </div>

        {/* User prompt */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            献立リクエスト
          </label>
          <textarea
            value={preferences.userPrompt}
            onChange={(e) => updatePreference('userPrompt', e.target.value)}
            placeholder="例: 魚料理を多めに、辛い料理は避けて"
            rows={2}
            className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-base text-text-primary placeholder:text-text-secondary outline-none"
          />
          <p className="mt-1 text-[10px] text-text-secondary">
            週間献立生成時にAIが考慮します
          </p>
        </div>
      </div>
    </div>
  )
}
