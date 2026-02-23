import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGeminiStore } from '../stores/geminiStore'

export function GeminiProcessingBanner() {
  const navigate = useNavigate()
  const chatLoading = useGeminiStore((s) => s.chatLoading)

  if (!chatLoading) return null

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">Geminiが回答を作成中です</p>
          <p className="text-xs text-text-secondary">他のタブを見ていても、完了したらGeminiタブに戻って確認できます。</p>
        </div>
        <button
          onClick={() => navigate('/gemini')}
          className="ml-auto shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-white/15"
        >
          Geminiへ戻る
        </button>
      </div>
    </div>
  )
}
