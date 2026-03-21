import { FlaskConical, Wrench } from 'lucide-react'
import { GoogleClientIdCard } from './GoogleClientIdCard'
import { QaGoogleModeCard } from './QaGoogleModeCard'

export function AdvancedTab() {
  return (
    <div data-testid="advanced-settings" className="space-y-4">
      <div className="ui-panel">
        <div className="mb-2 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-bold text-text-secondary">開発・検証</h4>
        </div>
        <p className="text-sm leading-relaxed text-text-primary">
          この画面は通常利用向けではありません。配布環境の OAuth 設定や QA Google モードなど、検証用の項目だけをまとめています。
        </p>
        <div className="ui-inline-note mt-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            本番利用では、通常は `接続 / 献立 / AI / 通知 / データ` の設定だけで十分です。
          </p>
        </div>
      </div>

      <GoogleClientIdCard />

      <div className="ui-panel">
        <div className="mb-3 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-bold text-text-secondary">接続フロー検証</h4>
        </div>
        <QaGoogleModeCard />
      </div>
    </div>
  )
}
