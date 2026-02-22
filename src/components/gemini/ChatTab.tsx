import { useState, useEffect } from 'react'
import { Send } from 'lucide-react'
import { GeminiIcon } from '../GeminiIcon'
import { resolveGeminiApiKey, generateGeminiText } from '../../lib/geminiClient'
import { useGeminiStore } from '../../stores/geminiStore'

function getApiKey(): string {
  return resolveGeminiApiKey() ?? ''
}

function GeminiApiKeyHint() {
  return (
    <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-text-secondary">
      Gemini APIキーが未設定です。設定 → 献立タブから登録してください。
    </p>
  )
}

export function ChatTab() {
  const messages = useGeminiStore((s) => s.chatMessages)
  const appendChatMessage = useGeminiStore((s) => s.appendChatMessage)
  const pendingChatInput = useGeminiStore((s) => s.pendingChatInput)
  const setPendingChatInput = useGeminiStore((s) => s.setPendingChatInput)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // When navigated from RecipeDetail with a pre-built prompt, set it in the input field
  useEffect(() => {
    if (pendingChatInput) {
      setInput(pendingChatInput)
      setPendingChatInput(null)
    }
  }, [pendingChatInput, setPendingChatInput])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    const key = getApiKey()
    if (!key) return

    appendChatMessage({ role: 'user', text: q })
    setInput('')
    setLoading(true)

    try {
      const systemContext = 'あなたは日本の家庭料理のアシスタントです。ホットクックとヘルシオに詳しく、料理のコツや献立のアドバイスが得意です。'
      const history = [...messages, { role: 'user' as const, text: q }]
      const fullPrompt = messages.length === 0
        ? `${systemContext}\n\nユーザー: ${q}`
        : `${systemContext}\n\n${history.map(m => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.text}`).join('\n')}`

      const reply = await generateGeminiText(fullPrompt, key)
      appendChatMessage({ role: 'model', text: reply })
    } catch (e) {
      appendChatMessage({ role: 'model', text: `エラーが発生しました: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasKey = !!getApiKey()

  return (
    <div className="flex flex-col gap-4">
      {!hasKey && <GeminiApiKeyHint />}

      {messages.length === 0 && hasKey && (
        <div className="rounded-2xl bg-bg-card p-4 text-center">
          <GeminiIcon className="mx-auto mb-2 h-8 w-8 text-accent/60" />
          <p className="text-sm text-text-secondary">料理や献立について何でも聞いてください</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {['ホットクックで作れる簡単な副菜は？', '塩分控えめの献立を提案して', 'ヘルシオでお弁当おかずを作るには？'].map(q => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="rounded-xl bg-white/5 px-3 py-2 text-sm text-text-secondary hover:bg-white/10 hover:text-text-primary"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'model' && (
            <GeminiIcon className="mr-2 mt-1 h-4 w-4 shrink-0 text-accent" />
          )}
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-accent text-white'
                : 'bg-bg-card text-text-primary'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.text}</p>
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex items-center gap-2">
          <GeminiIcon className="h-4 w-4 text-accent" />
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div className="flex items-stretch gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力... (Enterで送信)"
          rows={2}
          disabled={!hasKey || loading}
          className="min-h-[56px] flex-1 resize-none rounded-xl bg-bg-card px-4 py-3 text-base text-text-primary placeholder:text-text-secondary outline-none ring-1 ring-white/10 focus:ring-accent disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !hasKey || loading}
          className="flex min-w-[56px] shrink-0 items-center justify-center self-stretch rounded-xl bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
