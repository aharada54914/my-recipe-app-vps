import { MonitorCog, MoonStar, Sun } from 'lucide-react'
import { usePreferences } from '../../hooks/usePreferences'
import type { AppearanceMode } from '../../db/db'

const OPTIONS: Array<{
  mode: AppearanceMode
  label: string
  description: string
  icon: typeof MonitorCog
}> = [
  {
    mode: 'system',
    label: 'システム',
    description: '端末設定に合わせて自動で切り替えます。',
    icon: MonitorCog,
  },
  {
    mode: 'light',
    label: 'ライト',
    description: '明るいキッチンノート風の見た目に固定します。',
    icon: Sun,
  },
  {
    mode: 'dark',
    label: 'ダーク',
    description: '夜のキッチン向けに落ち着いた配色へ固定します。',
    icon: MoonStar,
  },
]

export function AppearanceTab() {
  const { preferences, resolvedTheme, setAppearanceMode } = usePreferences()

  return (
    <div data-testid="appearance-settings" className="rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <MonitorCog className="h-4 w-4 text-accent" />
        <h4 className="text-base font-bold text-text-secondary">表示</h4>
      </div>

      <div className="rounded-2xl border border-border-soft bg-bg-card-hover/60 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-secondary">現在の表示状態</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-text-primary">
              {resolvedTheme === 'dark' ? 'ダークテーマを適用中' : 'ライトテーマを適用中'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              設定: {preferences.appearanceMode === 'system' ? 'システム連動' : preferences.appearanceMode}
            </p>
          </div>
          <span className="rounded-full bg-accent/12 px-3 py-1 text-xs font-bold text-accent">
            {resolvedTheme === 'dark' ? 'Night' : 'Day'}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {OPTIONS.map(({ mode, label, description, icon: Icon }) => {
          const selected = preferences.appearanceMode === mode
          return (
            <button
              key={mode}
              type="button"
              data-testid={`appearance-mode-${mode}`}
              aria-pressed={selected}
              onClick={() => setAppearanceMode(mode)}
              className={`flex min-h-[56px] w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                selected
                  ? 'border-accent bg-accent/12 text-text-primary'
                  : 'border-border-soft bg-bg-card-hover/50 text-text-primary hover:bg-bg-card-hover'
              }`}
            >
              <span className={`mt-0.5 rounded-xl p-2 ${selected ? 'bg-accent text-white' : 'bg-bg-card text-text-secondary'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-text-secondary">{description}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-bg-card-hover/60 px-4 py-3">
        <p className="text-xs leading-relaxed text-text-secondary">
          テーマはこの端末に保存され、再読み込み後も維持されます。`システム` を選ぶと、端末のライト/ダーク切替に追従します。
        </p>
      </div>
    </div>
  )
}
