import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Send, Package, Link, Loader2, RotateCcw, ImagePlus, WandSparkles, FilePenLine, Upload, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { Recipe } from '../db/db'
import { parseRecipeFromUrl, parseRecipeText } from '../utils/geminiParser'
import { getLocalRecommendations } from '../utils/geminiRecommender'
import { RecipeCard } from '../components/RecipeCard'
import { GeminiIcon } from '../components/GeminiIcon'
import { resolveGeminiApiKey, generateGeminiText } from '../lib/geminiClient'
import { preprocessImagesToCollage } from '../utils/imagePreprocess'
import { extractIngredientsFromPhotoCollage } from '../utils/geminiIngredientExtractor'
import { generateRecipesFromIngredients } from '../utils/geminiMenuGenerator'
import { SUPPORTED_RECIPE_SITES } from '../constants/supportedRecipeSites'
import { RecipeEditorModal } from '../components/RecipeEditorModal'
import { useGeminiStore, type GeminiTabId } from '../stores/geminiStore'

const TABS: { id: GeminiTabId; label: string }[] = [
  { id: 'import', label: 'インポート' },
  { id: 'suggest', label: '在庫から提案' },
  { id: 'chat', label: '質問する' },
]

const INGREDIENT_CACHE_KEY = 'photo_ingredients_cache_v1'

function getApiKey(): string {
  return resolveGeminiApiKey() ?? ''
}

function parseIngredientList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[、,\n]/)
        .map((name) => name.trim())
        .filter(Boolean)
    )
  )
}

function formatRecipeMeta(recipe: Omit<Recipe, 'id'>): string {
  const device = recipe.device === 'hotcook' ? 'ホットクック' : recipe.device === 'healsio' ? 'ヘルシオ' : '手動調理'
  return `${device} · ${recipe.category} · ${recipe.baseServings}人前 · ${recipe.totalTimeMinutes}分`
}

function GeminiApiKeyHint() {
  return (
    <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-text-secondary">
      Gemini APIキーが未設定です。設定 → 献立タブから登録してください。
    </p>
  )
}

// ─────────────────────────────────────────────
// Tab 1: Recipe import from URL or text
// ─────────────────────────────────────────────
function ImportTab() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'parsing' | 'error'>('idle')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [draftRecipe, setDraftRecipe] = useState<Omit<Recipe, 'id'> | null>(null)
  const [editorSessionKey, setEditorSessionKey] = useState('import-editor-initial')
  const [error, setError] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const canParse = url.trim() || text.trim()
  const hasKey = !!getApiKey()

  const handleParse = async () => {
    setStatus('parsing')
    setError(null)
    setResultMessage(null)
    try {
      const result = url.trim()
        ? await parseRecipeFromUrl(url.trim())
        : await parseRecipeText(text)
      setDraftRecipe(result)
      setEditorSessionKey(`import-${result.title}-${Date.now()}`)
      setEditorOpen(true)
      setStatus('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
      setStatus('error')
    }
  }

  const handleSaveEditedRecipe = async (recipe: Omit<Recipe, 'id'>) => {
    const existing = await db.recipes.where('title').equals(recipe.title).first()
    if (existing) {
      if (!window.confirm(`「${recipe.title}」は既に登録されています。重複して保存しますか？`)) return
    }
    setEditorSaving(true)
    await db.recipes.add(recipe as Recipe)
    setEditorSaving(false)
    setResultMessage(`「${recipe.title}」を保存しました。`)
    navigate('/search')
  }

  return (
    <div className="space-y-5">
      <RecipeEditorModal
        key={editorSessionKey}
        open={editorOpen}
        title="URL/テキスト取り込み結果を編集"
        initialRecipe={draftRecipe}
        saving={editorSaving}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveEditedRecipe}
      />

      <div className="ui-panel">
        <p className="ui-section-kicker">Step 1</p>
        <div className="mb-3 flex items-center gap-2">
          <Link className="h-4 w-4 text-accent" />
          <h4 className="ui-section-title">URLかテキストを入力</h4>
        </div>
        <p className="ui-section-desc mb-3">
          レシピURLか本文のどちらかを入力すると、保存前に編集できる形式へ変換します。
        </p>

        <label className="ui-field-label">URLからインポート</label>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setText('') }}
          placeholder="https://example.com/recipe/..."
          className="ui-input mb-4"
        />

        <label className="ui-field-label">テキストから解析</label>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setUrl('') }}
          placeholder="レシピのテキストを貼り付け..."
          rows={5}
          className="ui-input resize-none"
        />
      </div>

      <div className="ui-panel">
        <h4 className="ui-section-title mb-2">対応URL（インポート対応）</h4>
        <div className="max-h-48 space-y-1 overflow-y-auto pr-1 text-sm text-text-secondary">
          {SUPPORTED_RECIPE_SITES.map((site) => (
            <p key={site.url}>
              <span className="font-semibold text-text-primary">{site.name}</span>
              {' · '}
              <a href={site.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
                {site.url}
              </a>
            </p>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}
      {resultMessage && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-text-secondary">{resultMessage}</p>
      )}

      {!hasKey && <GeminiApiKeyHint />}

      <button
        onClick={handleParse}
        disabled={!canParse || status === 'parsing' || !hasKey}
        className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2 transition-colors hover:bg-accent-hover disabled:opacity-40"
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
// Tab 2: AI suggestions based on stock + photos
// ─────────────────────────────────────────────
function SuggestTab() {
  const navigate = useNavigate()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoFiles = useGeminiStore((s) => s.photoFiles)
  const setPhotoFiles = useGeminiStore((s) => s.setPhotoFiles)
  const ingredientsDraft = useGeminiStore((s) => s.ingredientsDraft)
  const setIngredientsDraft = useGeminiStore((s) => s.setIngredientsDraft)
  const generatedRecipes = useGeminiStore((s) => s.generatedRecipes)
  const setGeneratedRecipes = useGeminiStore((s) => s.setGeneratedRecipes)
  const statusMessage = useGeminiStore((s) => s.statusMessage)
  const setStatusMessage = useGeminiStore((s) => s.setStatusMessage)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [extracting, setExtracting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Omit<Recipe, 'id'> | null>(null)
  const [editorSessionKey, setEditorSessionKey] = useState('suggest-editor-initial')

  const data = useLiveQuery(async () => {
    const [stockItems, recs] = await Promise.all([
      db.stock.filter(s => (s.quantity ?? 0) > 0 || s.inStock).toArray(),
      getLocalRecommendations(6),
    ])
    return { stockItems, recs }
  })

  useEffect(() => {
    if (ingredientsDraft.trim()) return
    const cached = sessionStorage.getItem(INGREDIENT_CACHE_KEY)
    if (cached) setIngredientsDraft(cached)
  }, [ingredientsDraft, setIngredientsDraft])

  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file))
    setPreviewUrls(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [photoFiles])

  const hasKey = !!getApiKey()

  const normalizedIngredients = useMemo(() => parseIngredientList(ingredientsDraft), [ingredientsDraft])

  const handleSelectPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setPhotoFiles(files)
    setGeneratedRecipes([])
    setStatusMessage(null)
  }

  const handleExtractFromPhotos = async () => {
    if (!hasKey || photoFiles.length === 0) return

    setExtracting(true)
    setStatusMessage(null)

    try {
      const collage = await preprocessImagesToCollage(photoFiles)
      const ingredients = await extractIngredientsFromPhotoCollage(collage, getApiKey())
      const text = ingredients.join('、')
      setIngredientsDraft(text)
      sessionStorage.setItem(INGREDIENT_CACHE_KEY, text)
      setStatusMessage(`食材を${ingredients.length}件抽出しました。必要なら編集してください。`)
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : '食材抽出に失敗しました。')
    } finally {
      setExtracting(false)
    }
  }

  const runGeneration = async () => {
    if (!hasKey) return

    const imageIngredients = parseIngredientList(ingredientsDraft)
    const stockIngredients = data?.stockItems.map((item) => item.name) ?? []
    const mergedIngredients = Array.from(new Set([...imageIngredients, ...stockIngredients]))

    if (mergedIngredients.length === 0) {
      setStatusMessage('先に写真から食材を抽出するか、食材リストを入力してください。')
      return
    }

    setGenerating(true)
    setStatusMessage(null)

    try {
      const recipes = await generateRecipesFromIngredients(mergedIngredients, getApiKey())
      setGeneratedRecipes(recipes)
      setStatusMessage('献立候補を生成しました。保存してレシピ一覧に追加できます。')
      sessionStorage.setItem(INGREDIENT_CACHE_KEY, imageIngredients.join('、'))
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : '献立生成に失敗しました。')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveGeneratedRecipe = async (recipe: Omit<Recipe, 'id'>) => {
    const existing = await db.recipes.where('title').equals(recipe.title).first()
    if (existing) {
      const allowDuplicate = window.confirm(`「${recipe.title}」は既に登録されています。重複して保存しますか？`)
      if (!allowDuplicate) return
    }
    setEditorSaving(true)
    await db.recipes.add(recipe as Recipe)
    setEditorSaving(false)
    setStatusMessage(`「${recipe.title}」を保存しました。`)
  }

  if (!data) return null

  const { stockItems, recs } = data
  const selectionLabel = photoFiles.length === 0 ? '未選択' : `${photoFiles.length}枚選択中`

  return (
    <div className="space-y-5">
      <RecipeEditorModal
        key={editorSessionKey}
        open={editorOpen}
        title="生成された献立を編集"
        initialRecipe={editingRecipe}
        saving={editorSaving}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveGeneratedRecipe}
      />

      <div className="ui-panel">
        <p className="ui-section-kicker">Context</p>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            <h4 className="ui-section-title">現在の在庫</h4>
          </div>
          <button
            onClick={() => navigate('/stock')}
            className="ui-btn ui-btn-secondary min-h-[40px] px-3 py-1.5 text-xs"
          >
            在庫を管理
          </button>
        </div>
        {stockItems.length === 0 ? (
          <p className="ui-section-desc">在庫が登録されていません</p>
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

      {recs.length > 0 && (
        <div className="ui-panel">
          <h4 className="ui-section-title mb-3">在庫でつくれるレシピ</h4>
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

      <div className="ui-panel">
        <p className="ui-section-kicker">Step 1</p>
        <div className="mb-2 flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-accent" />
          <h4 className="ui-section-title">写真から食材を抽出（複数対応）</h4>
        </div>
        <p className="ui-section-desc mb-3">まず写真を選んで、食材名を文字リスト化します。</p>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelectPhotos}
          className="hidden"
        />
        <input
          value={selectionLabel}
          disabled
          className={`mb-2 ui-input text-sm ${photoFiles.length > 0 ? 'text-text-primary' : 'text-text-secondary'}`}
        />
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => photoInputRef.current?.click()}
            className="ui-btn ui-btn-secondary flex flex-1 items-center justify-center gap-2"
          >
            <Upload className="h-4 w-4" />
            写真を選択
          </button>
          {photoFiles.length > 0 && (
            <button
              onClick={() => {
                setPhotoFiles([])
                setPreviewUrls([])
                setStatusMessage(null)
              }}
              className="ui-btn ui-btn-secondary flex min-w-[44px] items-center justify-center"
              aria-label="選択画像をクリア"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {previewUrls.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {previewUrls.map((url) => (
              <img key={url} src={url} alt="選択画像" className="h-20 w-full rounded-lg object-cover" />
            ))}
          </div>
        )}

        <button
          onClick={handleExtractFromPhotos}
          disabled={!hasKey || extracting || photoFiles.length === 0}
          className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2 transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GeminiIcon className="h-4 w-4" />}
          {extracting ? '食材を抽出中...' : '① 写真から食材文字リストを作る'}
        </button>
      </div>

      <div className="ui-panel">
        <p className="ui-section-kicker">Step 2</p>
        <div className="mb-2 flex items-center gap-2">
          <WandSparkles className="h-4 w-4 text-accent" />
          <h4 className="ui-section-title">文字リストを確認・編集</h4>
        </div>
        <p className="ui-section-desc mb-3">
          ここで食材を修正してから献立を生成します。再生成時はこの文字リストだけを送信します。
        </p>
        <textarea
          value={ingredientsDraft}
          onChange={(e) => {
            setIngredientsDraft(e.target.value)
            sessionStorage.setItem(INGREDIENT_CACHE_KEY, e.target.value)
          }}
          rows={4}
          placeholder="例: 鶏もも肉、玉ねぎ、にんじん"
          className="ui-input resize-none"
        />
        <p className="mt-2 text-sm text-text-secondary">{normalizedIngredients.length}件の食材を認識しています。</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          onClick={runGeneration}
          disabled={!hasKey || generating || normalizedIngredients.length === 0}
          className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2 transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <GeminiIcon className="h-4 w-4" />}
          {generating ? '生成中...' : '② 文字リストから献立を作る'}
        </button>

        <button
          onClick={runGeneration}
          disabled={!hasKey || generating || normalizedIngredients.length === 0}
          className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2 transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
          献立を作り直して
        </button>
      </div>

      {!hasKey && <GeminiApiKeyHint />}

      {statusMessage && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-text-secondary">{statusMessage}</p>
      )}

      {generatedRecipes.length > 0 && (
        <div className="space-y-3">
          <h4 className="ui-section-title">生成された献立（DB互換）</h4>
          {generatedRecipes.map((recipe, index) => (
            <div key={`${recipe.title}-${index}`} className="ui-panel">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h5 className="text-base font-bold text-text-primary">{recipe.title}</h5>
                  <p className="text-sm text-text-secondary">{formatRecipeMeta(recipe)}</p>
                </div>
                <button
                  onClick={() => {
                    setEditingRecipe(recipe)
                    setEditorSessionKey(`suggest-${recipe.title}-${Date.now()}`)
                    setEditorOpen(true)
                  }}
                  className="ui-btn ui-btn-primary flex items-center gap-1 px-3 py-2 text-xs transition-colors hover:bg-accent-hover"
                >
                  <FilePenLine className="h-3.5 w-3.5" />
                  編集して保存
                </button>
              </div>

              <div className="mb-2 text-sm text-text-secondary">材料 {recipe.ingredients.length}件 / 手順 {recipe.steps.length}件</div>
              <div className="flex flex-wrap gap-1">
                {recipe.ingredients.slice(0, 10).map((ing, i) => (
                  <span key={`${recipe.title}-${ing.name}-${i}`} className="ui-chip-muted">
                    {ing.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab 3: Free-form chat with Gemini
// ─────────────────────────────────────────────
function ChatTab() {
  const messages = useGeminiStore((s) => s.chatMessages)
  const appendChatMessage = useGeminiStore((s) => s.appendChatMessage)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

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

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
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
