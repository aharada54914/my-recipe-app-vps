import { useState } from 'react'
import { ArrowLeft, Sparkles, Save, RotateCcw } from 'lucide-react'
import type { Recipe, ParseStatus } from '../db/db'
import { db } from '../db/db'
import { parseRecipeText, parseRecipeFromUrl } from '../utils/geminiParser'
import { formatQuantityVibe } from '../utils/recipeUtils'

interface AiRecipeParserProps {
  onBack: () => void
}

const deviceLabels: Record<string, string> = {
  hotcook: 'ホットクック',
  healsio: 'ヘルシオ',
  manual: '手動調理',
}

export function AiRecipeParser({ onBack }: AiRecipeParserProps) {
  const [inputText, setInputText] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [status, setStatus] = useState<ParseStatus>('idle')
  const [parsed, setParsed] = useState<Omit<Recipe, 'id'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canParse = inputText.trim() || inputUrl.trim()

  const handleParse = async () => {
    setStatus('parsing')
    setError(null)
    try {
      const result = inputUrl.trim()
        ? await parseRecipeFromUrl(inputUrl.trim())
        : await parseRecipeText(inputText)
      setParsed(result)
      setStatus('previewing')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
      setStatus('error')
    }
  }

  const handleSave = async () => {
    if (!parsed) return

    // Duplicate title check
    const existing = await db.recipes.where('title').equals(parsed.title).first()
    if (existing) {
      const confirmed = window.confirm(
        `「${parsed.title}」は既に登録されています。重複して保存しますか？`
      )
      if (!confirmed) return
    }

    setStatus('saving')
    await db.recipes.add(parsed as Recipe)
    onBack()
  }

  const handleReset = () => {
    setParsed(null)
    setError(null)
    setStatus('idle')
  }

  return (
    <div className="min-h-dvh bg-bg-primary">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button
          onClick={onBack}
          className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-bold">AIレシピ解析</h1>
        </div>
      </header>

      <main className="space-y-4 px-4 pb-8">
        {/* Input section */}
        {(status === 'idle' || status === 'error') && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-bg-card p-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="レシピのテキストを貼り付けてください..."
                rows={8}
                className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary outline-none"
              />
              <div className="mt-3">
                <label className="mb-1 block text-xs text-text-secondary">
                  またはURLから読み取り
                </label>
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleParse}
              disabled={!canParse}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-30"
            >
              <Sparkles className="h-4 w-4" />
              AIで解析
            </button>

            {/* Error */}
            {status === 'error' && error && (
              <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {status === 'parsing' && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-sm text-text-secondary">解析中...</span>
          </div>
        )}

        {/* Preview */}
        {(status === 'previewing' || status === 'saving') && parsed && (
          <div className="space-y-4">
            {/* Recipe info */}
            <div className="rounded-2xl bg-bg-card p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <span className="mb-1 inline-block rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
                    {deviceLabels[parsed.device] ?? parsed.device}
                  </span>
                  <h3 className="mt-1 text-base font-bold">{parsed.title}</h3>
                </div>
                <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-text-secondary">
                  {parsed.category}
                </span>
              </div>
              <div className="flex gap-4 text-sm text-text-secondary">
                <span>{parsed.baseServings}人分</span>
                <span>{parsed.totalTimeMinutes}分</span>
                <span>約{parsed.totalWeightG}g</span>
              </div>
            </div>

            {/* Ingredients */}
            <div className="rounded-2xl bg-bg-card p-4">
              <h4 className="mb-3 text-sm font-bold text-text-secondary">材料</h4>
              {parsed.ingredients.filter(i => i.category === 'main').length > 0 && (
                <div className="mb-3">
                  <div className="mb-1 text-xs font-medium text-accent">主材料</div>
                  <ul className="space-y-1.5">
                    {parsed.ingredients.filter(i => i.category === 'main').map((ing) => (
                      <li key={ing.name} className="flex justify-between text-sm">
                        <span>{ing.name}</span>
                        <span className="text-text-secondary">
                          {formatQuantityVibe(ing.quantity, ing.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {parsed.ingredients.filter(i => i.category === 'sub').length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-medium text-text-secondary">調味料・その他</div>
                  <ul className="space-y-1.5">
                    {parsed.ingredients.filter(i => i.category === 'sub').map((ing) => (
                      <li key={ing.name} className="flex justify-between text-sm">
                        <span>{ing.name}</span>
                        <span className="text-text-secondary">
                          {formatQuantityVibe(ing.quantity, ing.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="rounded-2xl bg-bg-card p-4">
              <h4 className="mb-3 text-sm font-bold text-text-secondary">工程</h4>
              <ol className="space-y-2">
                {parsed.steps.map((step, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="flex-1">{step.name}</span>
                    <span className="text-text-secondary">{step.durationMinutes}分</span>
                    {step.isDeviceStep && (
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
                        自動
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-bg-card py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-card-hover"
              >
                <RotateCcw className="h-4 w-4" />
                やり直す
              </button>
              <button
                onClick={handleSave}
                disabled={status === 'saving'}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {status === 'saving' ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
