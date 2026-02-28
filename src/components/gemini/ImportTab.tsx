import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link, Loader2 } from 'lucide-react'
import { db } from '../../db/db'
import type { Recipe } from '../../db/db'
import { parseRecipeFromUrl, parseRecipeText } from '../../utils/geminiParser'
import { GeminiIcon } from '../GeminiIcon'
import { RecipeEditorModal } from '../RecipeEditorModal'
import { SUPPORTED_RECIPE_SITES } from '../../constants/supportedRecipeSites'
import { resolveGeminiApiKey } from '../../lib/geminiClient'
import { formatMissingNutritionMessage, validateRequiredNutrition } from '../../utils/nutritionValidation'

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

export function ImportTab() {
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
