import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { db } from '../../db/db'
import type { Recipe } from '../../db/db'
import { parseRecipeFromUrl, parseRecipeText } from '../../utils/geminiParser'
import { GeminiIcon } from '../GeminiIcon'
import { RecipeEditorModal } from '../RecipeEditorModal'
import { SUPPORTED_RECIPE_SITES } from '../../constants/supportedRecipeSites'
import { resolveGeminiApiKey } from '../../lib/geminiClient'
import { formatMissingNutritionMessage, validateRequiredNutrition } from '../../utils/nutritionValidation'
import { StatusNotice } from '../StatusNotice'

function getApiKey(): string {
  return resolveGeminiApiKey() ?? ''
}

export function ImportTab() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'parsing' | 'error'>('idle')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [draftRecipe, setDraftRecipe] = useState<Omit<Recipe, 'id'> | null>(null)
  const [editorSessionVersion, setEditorSessionVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [lastAttempt, setLastAttempt] = useState<{ url: string; text: string } | null>(null)

  const canParse = url.trim() || text.trim()
  const hasKey = !!getApiKey()

  const handleParse = async (attempt: { url: string; text: string } = { url, text }) => {
    setLastAttempt(attempt)
    setStatus('parsing')
    setError(null)
    setResultMessage(null)
    try {
      const nextUrl = attempt.url.trim()
      const nextText = attempt.text.trim()
      const result = nextUrl
        ? await parseRecipeFromUrl(nextUrl)
        : await parseRecipeText(nextText)
      setDraftRecipe(result)
      setEditorSessionVersion((prev) => prev + 1)
      setEditorOpen(true)
      setStatus('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
      setStatus('error')
    }
  }

  const handleSaveEditedRecipe = async (recipe: Omit<Recipe, 'id'>) => {
    const nutritionCheck = validateRequiredNutrition(recipe)
    if (!nutritionCheck.ok) {
      setResultMessage(null)
      setError(formatMissingNutritionMessage(nutritionCheck.missingFields))
      return
    }

    const existing = await db.recipes.where('title').equals(recipe.title).first()
    if (existing) {
      if (!window.confirm(`「${recipe.title}」は既に登録されています。重複して保存しますか？`)) return
    }
    setEditorSaving(true)
    await db.recipes.add({ ...recipe, isUserAdded: true } as Recipe)
    setEditorSaving(false)
    setResultMessage(`「${recipe.title}」を保存しました。`)
    navigate('/search')
  }

  const statusNotice = !hasKey
    ? {
      tone: 'warning' as const,
      title: 'Gemini APIキーが必要です',
      message: 'URL解析とテキスト解析を使うには、設定の AI で Gemini API キーを登録してください。',
      actionLabel: 'Gemini設定を開く',
      onAction: () => navigate('/settings/ai'),
    }
    : error
      ? {
        tone: 'error' as const,
        title: 'レシピ解析に失敗しました',
        message: error,
        actionLabel: lastAttempt ? 'もう一度解析' : undefined,
        onAction: lastAttempt ? () => { void handleParse(lastAttempt) } : undefined,
      }
      : resultMessage
        ? {
          tone: 'success' as const,
          title: '解析結果を保存しました',
          message: resultMessage,
          actionLabel: '検索画面へ移動',
          onAction: () => navigate('/search'),
        }
        : null

  return (
    <div className="space-y-5">
      <RecipeEditorModal
        key={`import-editor-${editorSessionVersion}`}
        open={editorOpen}
        title="URL/テキスト取り込み結果を編集"
        initialRecipe={draftRecipe}
        saving={editorSaving}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveEditedRecipe}
      />

      {statusNotice && (
        <StatusNotice
          tone={statusNotice.tone}
          title={statusNotice.title}
          message={statusNotice.message}
          actionLabel={statusNotice.actionLabel}
          onAction={statusNotice.onAction}
          icon={statusNotice.tone === 'error'
            ? <RotateCcw className="h-4 w-4" />
            : <Sparkles className="h-4 w-4" />}
        />
      )}

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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          onClick={() => {
            void handleParse()
          }}
          disabled={!canParse || status === 'parsing' || !hasKey}
          className="ui-btn ui-btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {status === 'parsing' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GeminiIcon className="h-4 w-4" />
          )}
          {status === 'parsing' ? '解析中...' : 'Geminiで解析'}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!lastAttempt || status === 'parsing' || !hasKey) return
            void handleParse(lastAttempt)
          }}
          disabled={!lastAttempt || status === 'parsing' || !hasKey}
          className="ui-btn ui-btn-secondary flex min-h-[48px] w-full items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
          前回の入力で再試行
        </button>
      </div>
    </div>
  )
}
