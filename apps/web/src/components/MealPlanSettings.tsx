import { UtensilsCrossed } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { usePreferences } from '../hooks/usePreferences'
import type { SeasonalPriority, WeeklyMenuCostMode } from '../db/db'
import { TOKYO_PRICE_SOURCES } from '../data/ingredientAveragePrices'
import { db } from '../db/db'

const DAY_LABELS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']

const PRIORITY_OPTIONS: { value: SeasonalPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]

const COST_MODE_OPTIONS: { value: WeeklyMenuCostMode; label: string; description: string }[] = [
  { value: 'saving', label: '節約', description: '価格を重視して選びます' },
  { value: 'ignore', label: '気にしない', description: '価格ロジックを使わず選びます' },
  { value: 'luxury', label: '贅沢', description: 'ご褒美枠を含めて選びます' },
]

export function MealPlanSettings() {
  const { preferences, updatePreference } = usePreferences()
  const latestSyncLog = useLiveQuery(
    () => db.ingredientPriceSyncLogs.orderBy('startedAt').reverse().first(),
    [],
  )

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <UtensilsCrossed className="h-4 w-4 text-accent" />
        <h4 className="text-base font-bold text-text-secondary">献立設定</h4>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">週予算（円）</label>
          <input
            type="number"
            min={0}
            value={preferences.weeklyBudgetYen ?? ''}
            onChange={(e) => updatePreference('weeklyBudgetYen', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-base text-text-primary outline-none"
            placeholder="例: 8000"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">週間献立の自動生成</label>
          <div className="flex flex-wrap items-center gap-2">
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
                className="w-12 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none sm:w-14"
              />
              <span className="text-text-secondary">:</span>
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={String(preferences.weeklyMenuGenerationMinute).padStart(2, '0')}
                onChange={(e) => updatePreference('weeklyMenuGenerationMinute', Number(e.target.value))}
                className="w-12 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none sm:w-14"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">旬の食材優先度</label>
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
        </div>

        <div className="rounded-xl bg-white/5 p-3 text-xs text-text-secondary">
          <p>価格基準: 東京都</p>
          <p>最終更新: {preferences.lastPriceSyncAt ? new Date(preferences.lastPriceSyncAt).toLocaleString('ja-JP') : '未更新'}</p>
          <p>同期状態: {latestSyncLog?.status === 'failed' ? `失敗 (${latestSyncLog.errorSummary || '不明'})` : '成功/未実行'}</p>
          <p className="mt-2 font-semibold">参照ソース</p>
          <ul className="list-disc pl-5">
            {TOKYO_PRICE_SOURCES.map((source) => (
              <li key={source.id}>
                <a className="underline" href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">価格モード</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {COST_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updatePreference('weeklyMenuCostMode', opt.value)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  preferences.weeklyMenuCostMode === opt.value
                    ? 'border-accent bg-accent/15 text-text-primary'
                    : 'border-white/10 bg-white/5 text-text-secondary hover:bg-white/10'
                }`}
              >
                <p className="font-semibold">{opt.label}</p>
                <p className="mt-0.5 text-xs">{opt.description}</p>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-secondary">季節・天気は全モード共通で考慮されます。</p>
        </div>

        {preferences.weeklyMenuCostMode === 'luxury' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">贅沢ご褒美枠（日/週）</label>
            <input
              type="number"
              min={1}
              max={7}
              value={preferences.weeklyMenuLuxuryRewardDays}
              onChange={(e) => updatePreference('weeklyMenuLuxuryRewardDays', Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg bg-white/5 px-2 py-2 text-center text-base text-text-primary outline-none"
            />
            <p className="mt-1 text-xs text-text-secondary">贅沢モードで優先するご褒美メニュー日数を設定します</p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">献立リクエスト</label>
          <textarea
            value={preferences.userPrompt}
            onChange={(e) => updatePreference('userPrompt', e.target.value)}
            placeholder="例: 魚料理を多めに、辛い料理は避けて"
            rows={2}
            className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-base text-text-primary placeholder:text-text-secondary outline-none"
          />
          <p className="mt-1 text-xs text-text-secondary">週間献立生成時にAIが考慮します</p>
        </div>
      </div>
    </div>
  )
}
