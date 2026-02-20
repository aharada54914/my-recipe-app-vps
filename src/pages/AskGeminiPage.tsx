import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, Package, Link, Loader2, Save, RotateCcw } from 'lucide-react'
import { db } from '../db/db'
import type { Recipe } from '../db/db'
import { parseRecipeFromUrl, parseRecipeText } from '../utils/geminiParser'
import { getLocalRecommendations } from '../utils/geminiRecommender'
import { RecipeCard } from '../components/RecipeCard'
import { GeminiIcon } from '../components/GeminiIcon'

type TabId = 'import' | 'suggest' | 'chat'

const TABS: { id: TabId; label: string }[] = [
  { id: 'import', label: 'インポート' },
  { id: 'suggest', label: '在庫から提案' },
  { id: 'chat', label: '質問する' },
]

function getApiKey(): string {
  return (
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    localStorage.getItem('gemini_api_key') ||
    ''
  )
}

// ─────────────────────────────────────────────
// Tab 1: Recipe import from URL or text
// ─────────────────────────────────────────────
function ImportTab() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'parsing' | 'previewing' | 'error'>('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [parsed, setParsed] = useState<Omit<Recipe, 'id'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canParse = url.trim() || text.trim()

  const handleParse = async () => {
    setStatus('parsing')
    setError(null)
    try {
      const result = url.trim()
        ? await parseRecipeFromUrl(url.trim())
        : await parseRecipeText(text)
      setParsed(result)
      setStatus('previewing')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
      setStatus('error')
    }
  }

  const handleSave = async () => {
    if (!parsed) return
    const existing = await db.recipes.where('title').equals(parsed.title).first()
    if (existing) {
      if (!window.confirm(`「${parsed.title}」は既に登録されています。重複して保存しますか？`)) return
    }
    setIsSaving(true)
    await db.recipes.add(parsed as Recipe)
    navigate('/search')
  }

  const handleReset = () => {
    setParsed(null)
    setError(null)
    setUrl('')
    setText('')
    setStatus('idle')
  }

  if (status === 'previewing' && parsed) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-bg-card p-4">
          <h3 className="mb-1 text-base font-bold">{parsed.title}</h3>
          <p className="mb-3 text-xs text-text-secondary">
            {parsed.device === 'hotcook' ? 'ホットクック' : parsed.device === 'healsio' ? 'ヘルシオ' : '手動調理'} ·
            {parsed.baseServings}人前 · {parsed.totalTimeMinutes}分
          </p>
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-text-secondary">材料</p>
            <div className="flex flex-wrap gap-1">
              {parsed.ingredients.slice(0, 8).map((ing, i) => (
                <span key={i} className="rounded-lg bg-white/5 px-2 py-0.5 text-xs text-text-secondary">
                  {ing.name}
                </span>
              ))}
              {parsed.ingredients.length > 8 && (
                <span className="text-xs text-text-secondary">+{parsed.ingredients.length - 8}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 py-3 text-sm font-medium text-text-secondary hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
            やり直す
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-3 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? '保存中...' : 'レシピを保存'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Link className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-bold text-text-secondary">URLからインポート</h4>
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setText('') }}
          placeholder="https://example.com/recipe/..."
          className="w-full rounded-xl bg-white/5 px-4 py-3 text-base text-text-primary placeholder:text-text-secondary outline-none ring-1 ring-accent/30 focus:ring-accent"
        />
      </div>

      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-bold text-text-secondary">テキストから解析</h4>
        </div>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setUrl('') }}
          placeholder="レシピのテキストを貼り付け..."
          rows={5}
          className="w-full rounded-xl bg-white/5 px-4 py-3 text-base text-text-primary placeholder:text-text-secondary outline-none ring-1 ring-accent/30 focus:ring-accent resize-none"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {!getApiKey() && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-xs text-text-secondary">
          Gemini APIキーが未設定です。設定 → 献立タブから登録してください。
        </p>
      )}

      <button
        onClick={handleParse}
        disabled={!canParse || status === 'parsing' || !getApiKey()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
      >
        {status === 'parsing' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GeminiIcon className="h-4 w-4" />
        )}
        {status === 'parsing' ? '解析中...' : 'Geminiで解析'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab 2: AI suggestions based on stock
// ─────────────────────────────────────────────
function SuggestTab() {
  const navigate = useNavigate()
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const data = useLiveQuery(async () => {
    const [stockItems, recs] = await Promise.all([
      db.stock.filter(s => (s.quantity ?? 0) > 0 || s.inStock).toArray(),
      getLocalRecommendations(6),
    ])
    return { stockItems, recs }
  })

  const handleAskGemini = async () => {
    const key = getApiKey()
    if (!key || !data?.stockItems.length) return
    setLoading(true)
    setAiSuggestion(null)
    try {
      const stockList = data.stockItems.map(s => s.name).join('、')
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const prompt = `冷蔵庫にある食材: ${stockList}\n\nこれらの食材を使った夕食の献立を3〜5品提案してください。ホットクックやヘルシオで作れるものがあれば優先してください。各料理は料理名と簡単な説明（1〜2文）を含めてください。`
      const result = await model.generateContent(prompt)
      setAiSuggestion(result.response.text())
    } catch (e) {
      setAiSuggestion(`エラーが発生しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  if (!data) return null

  const { stockItems, recs } = data

  return (
    <div className="space-y-4">
      {/* Current stock summary */}
      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-bold text-text-secondary">現在の在庫</h4>
          </div>
          <button
            onClick={() => navigate('/stock')}
            className="text-xs text-text-secondary hover:text-accent"
          >
            在庫を管理 →
          </button>
        </div>
        {stockItems.length === 0 ? (
          <p className="text-sm text-text-secondary">在庫が登録されていません</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {stockItems.slice(0, 20).map(s => (
              <span key={s.id} className="rounded-lg bg-white/5 px-2 py-0.5 text-xs text-text-secondary">
                {s.name}
              </span>
            ))}
            {stockItems.length > 20 && (
              <span className="text-xs text-text-secondary">+{stockItems.length - 20}品</span>
            )}
          </div>
        )}
      </div>

      {/* Local recommendations */}
      {recs.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-bold text-text-secondary">在庫でつくれるレシピ</h4>
          <div className="grid grid-cols-2 gap-3">
            {recs.map(({ recipe, matchRate }) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                variant="grid"
                matchRate={matchRate}
                onClick={() => navigate(`/recipe/${recipe.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Gemini AI suggestion */}
      <button
        onClick={handleAskGemini}
        disabled={loading || !getApiKey() || stockItems.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GeminiIcon className="h-4 w-4" />
        )}
        {loading ? 'Geminiに相談中...' : 'Geminiに献立を提案してもらう'}
      </button>

      {!getApiKey() && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-xs text-text-secondary">
          Gemini APIキーが未設定です。設定 → 献立タブから登録してください。
        </p>
      )}

      {aiSuggestion && (
        <div className="rounded-2xl bg-bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <GeminiIcon className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-bold text-text-secondary">Geminiの提案</h4>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{aiSuggestion}</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab 3: Free-form chat with Gemini
// ─────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    const key = getApiKey()
    if (!key) return

    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setLoading(true)

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const systemContext = 'あなたは日本の家庭料理のアシスタントです。ホットクックとヘルシオに詳しく、料理のコツや献立のアドバイスが得意です。'
      const fullPrompt = messages.length === 0
        ? `${systemContext}\n\nユーザー: ${q}`
        : `${systemContext}\n\n${messages.map(m => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.text}`).join('\n')}\nユーザー: ${q}`

      const result = await model.generateContent(fullPrompt)
      const reply = result.response.text()
      setMessages(prev => [...prev, { role: 'model', text: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: `エラーが発生しました: ${e instanceof Error ? e.message : String(e)}` }])
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
      {!hasKey && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-xs text-text-secondary">
          Gemini APIキーが未設定です。設定 → 献立タブから登録してください。
        </p>
      )}

      {messages.length === 0 && hasKey && (
        <div className="rounded-2xl bg-bg-card p-4 text-center">
          <GeminiIcon className="mx-auto mb-2 h-8 w-8 text-accent/60" />
          <p className="text-sm text-text-secondary">料理や献立について何でも聞いてください</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {['ホットクックで作れる簡単な副菜は？', '塩分控えめの献立を提案して', 'ヘルシオでお弁当おかずを作るには？'].map(q => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-text-secondary hover:bg-white/10 hover:text-text-primary"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message thread */}
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

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力... (Enterで送信)"
          rows={2}
          disabled={!hasKey || loading}
          className="flex-1 resize-none rounded-xl bg-bg-card px-4 py-3 text-base text-text-primary placeholder:text-text-secondary outline-none ring-1 ring-white/10 focus:ring-accent disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !hasKey || loading}
          className="flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-xl bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export function AskGeminiPage() {
  const [activeTab, setActiveTab] = useState<TabId>('suggest')

  return (
    <div className="pt-2 pb-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <GeminiIcon className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold">Gemini</h2>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-bg-card p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
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
