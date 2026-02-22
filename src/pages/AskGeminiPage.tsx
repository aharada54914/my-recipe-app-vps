import { GeminiIcon } from '../components/GeminiIcon'
import { useGeminiStore, type GeminiTabId } from '../stores/geminiStore'
import { ImportTab } from '../components/gemini/ImportTab'
import { SuggestTab } from '../components/gemini/SuggestTab'
import { ChatTab } from '../components/gemini/ChatTab'

const TABS: { id: GeminiTabId; label: string }[] = [
  { id: 'import', label: 'インポート' },
  { id: 'suggest', label: '在庫から提案' },
  { id: 'chat', label: '質問する' },
]

export function AskGeminiPage() {
  const activeTab = useGeminiStore((s) => s.activeTab)
  const setActiveTab = useGeminiStore((s) => s.setActiveTab)

  return (
    <div className="pt-2 pb-4">
      <div className="mb-3">
        <p className="ui-section-kicker">AI Assistant</p>
        <div className="mt-1 flex items-center gap-2">
          <GeminiIcon className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-extrabold">Gemini</h2>
        </div>
        <p className="ui-section-desc mt-1">取り込み、在庫提案、料理相談をタブで切り替えて使えます。</p>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl bg-bg-card p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`ui-btn flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
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
