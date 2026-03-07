import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GeminiIcon } from '../components/GeminiIcon'
import { useGeminiStore, type GeminiTabId } from '../stores/geminiStore'
import { ImportTab } from '../components/gemini/ImportTab'
import { SuggestTab } from '../components/gemini/SuggestTab'
import { ChatTab } from '../components/gemini/ChatTab'
import { StatusNotice } from '../components/StatusNotice'
import { usePreferences } from '../hooks/usePreferences'
import { getGeminiIntegrationStatus } from '../lib/integrationStatus'

const TABS: { id: GeminiTabId; label: string }[] = [
  { id: 'import', label: 'インポート' },
  { id: 'suggest', label: '在庫から提案' },
  { id: 'chat', label: '質問する' },
]

export function AskGeminiPage() {
  const navigate = useNavigate()
  const { preferences } = usePreferences()
  const activeTab = useGeminiStore((s) => s.activeTab)
  const setActiveTab = useGeminiStore((s) => s.setActiveTab)
  const geminiStatus = getGeminiIntegrationStatus(preferences.geminiEstimatedDailyLimit)

  return (
    <div className="space-y-4 pt-4 pb-4">
      <div data-testid="gemini-hero" className="ui-action-card">
        <p className="ui-section-kicker">AI Assistant</p>
        <div className="mt-1 flex items-center gap-2">
          <GeminiIcon className="h-5 w-5 text-accent-ai" />
          <h2 className="text-xl font-extrabold">Gemini</h2>
        </div>
        <p className="ui-section-desc mt-1">取り込み、在庫提案、料理相談を 1 画面で切り替えて使えます。</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`gemini-hero-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                activeTab === tab.id
                  ? 'border-accent-ai/30 bg-bg-card text-text-primary'
                  : 'border-border-soft bg-bg-card-hover text-text-secondary hover:bg-bg-card'
              }`}
            >
              <p className="text-sm font-bold">{tab.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                {tab.id === 'import'
                  ? 'URL と本文を変換'
                  : tab.id === 'suggest'
                    ? '在庫や写真から献立'
                    : '料理の疑問を相談'}
              </p>
            </button>
          ))}
        </div>
      </div>

      <StatusNotice
        tone={geminiStatus.tone}
        title={geminiStatus.title}
        message={geminiStatus.message}
        actionLabel="Gemini設定を開く"
        onAction={() => navigate('/settings/menu')}
        icon={<Sparkles className="h-4 w-4" />}
        className="mb-0"
      />

      <div className="ui-segmented" data-testid="gemini-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            data-testid={`gemini-tab-${tab.id}`}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="ui-segmented-button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'import' && <ImportTab />}
      {activeTab === 'suggest' && <SuggestTab />}
      {activeTab === 'chat' && <ChatTab />}
    </div>
  )
}
