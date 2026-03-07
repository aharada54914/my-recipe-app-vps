import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Package, Loader2, RotateCcw, ImagePlus, WandSparkles, FilePenLine, Upload, Trash2, Sparkles } from 'lucide-react'
import { db } from '../../db/db'
import type { Recipe } from '../../db/db'
import { GeminiIcon } from '../GeminiIcon'
import { resolveGeminiApiKey } from '../../lib/geminiClient'
import { preprocessImagesToCollage } from '../../utils/imagePreprocess'
import { extractIngredientsFromPhotoCollage } from '../../utils/geminiIngredientExtractor'
import { generateRecipesFromIngredients } from '../../utils/geminiMenuGenerator'
import { RecipeEditorModal } from '../RecipeEditorModal'
import { useGeminiStore } from '../../stores/geminiStore'
import { formatMissingNutritionMessage, validateRequiredNutrition } from '../../utils/nutritionValidation'
import { StatusNotice } from '../StatusNotice'

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

export function SuggestTab() {
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
  const [editorSessionVersion, setEditorSessionVersion] = useState(0)
  const [statusTone, setStatusTone] = useState<'info' | 'success' | 'error'>('info')
  const [lastAction, setLastAction] = useState<'extract' | 'generate' | null>(null)

  const data = useLiveQuery(async () => {
    const stockItems = await db.stock.filter(s => (s.quantity ?? 0) > 0 || s.inStock).toArray()
    return { stockItems }
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
    setLastAction(null)
  }

  const handleExtractFromPhotos = async () => {
    if (!hasKey || photoFiles.length === 0) return

    setLastAction('extract')
    setExtracting(true)
    setStatusMessage(null)

    try {
      const collage = await preprocessImagesToCollage(photoFiles)
      const ingredients = await extractIngredientsFromPhotoCollage(collage, getApiKey())
      const text = ingredients.join('、')
      setIngredientsDraft(text)
      sessionStorage.setItem(INGREDIENT_CACHE_KEY, text)
      setStatusTone('success')
      setStatusMessage(`食材を${ingredients.length}件抽出しました。必要なら編集してください。`)
    } catch (e) {
      setStatusTone('error')
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
      setStatusTone('error')
      setStatusMessage('先に写真から食材を抽出するか、食材リストを入力してください。')
      return
    }

    setLastAction('generate')
    setGenerating(true)
    setStatusMessage(null)

    try {
      const recipes = await generateRecipesFromIngredients(mergedIngredients, getApiKey())
      setGeneratedRecipes(recipes)
      setStatusTone('success')
      setStatusMessage('献立候補を生成しました。保存してレシピ一覧に追加できます。')
      sessionStorage.setItem(INGREDIENT_CACHE_KEY, imageIngredients.join('、'))
    } catch (e) {
      setStatusTone('error')
      setStatusMessage(e instanceof Error ? e.message : '献立生成に失敗しました。')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveGeneratedRecipe = async (recipe: Omit<Recipe, 'id'>) => {
    const nutritionCheck = validateRequiredNutrition(recipe)
    if (!nutritionCheck.ok) {
      setStatusTone('error')
      setStatusMessage(formatMissingNutritionMessage(nutritionCheck.missingFields))
      return
    }

    const existing = await db.recipes.where('title').equals(recipe.title).first()
    if (existing) {
      const allowDuplicate = window.confirm(`「${recipe.title}」は既に登録されています。重複して保存しますか？`)
      if (!allowDuplicate) return
    }
    setEditorSaving(true)
    await db.recipes.add({ ...recipe, isUserAdded: true } as Recipe)
    setEditorSaving(false)
    setStatusTone('success')
    setStatusMessage(`「${recipe.title}」を保存しました。`)
  }

  if (!data) return null

  const { stockItems } = data
  const selectionLabel = photoFiles.length === 0 ? '未選択' : `${photoFiles.length}枚選択中`
  const statusNotice = !hasKey
    ? {
      tone: 'warning' as const,
      title: 'Gemini APIキーが必要です',
      message: '写真解析と献立生成を使うには、設定の AI で Gemini API キーを登録してください。',
      actionLabel: 'Gemini設定を開く',
      onAction: () => navigate('/settings/ai'),
    }
    : extracting
      ? {
        tone: 'info' as const,
        title: '写真から食材を抽出しています',
        message: '画像をまとめて解析しています。完了までそのままお待ちください。',
        actionLabel: undefined,
        onAction: undefined,
      }
      : generating
        ? {
          tone: 'info' as const,
          title: '在庫と食材リストから献立を生成しています',
          message: 'Gemini で候補を作成中です。完了後に保存前レビューへ進めます。',
          actionLabel: undefined,
          onAction: undefined,
        }
        : statusMessage
          ? {
            tone: statusTone === 'error' ? 'error' as const : statusTone === 'success' ? 'success' as const : 'info' as const,
            title: statusTone === 'error' ? 'AI処理に失敗しました' : statusTone === 'success' ? 'AI処理が完了しました' : 'AI処理の状況',
            message: statusMessage,
            actionLabel: statusTone === 'error'
              ? lastAction === 'extract'
                ? 'もう一度抽出'
                : lastAction === 'generate'
                  ? 'もう一度生成'
                  : undefined
              : undefined,
            onAction: statusTone === 'error'
              ? lastAction === 'extract'
                ? () => { void handleExtractFromPhotos() }
                : lastAction === 'generate'
                  ? () => { void runGeneration() }
                  : undefined
              : undefined,
          }
          : null

  return (
    <div className="space-y-5">
      <RecipeEditorModal
        key={`suggest-editor-${editorSessionVersion}`}
        open={editorOpen}
        title="生成された献立を編集"
        initialRecipe={editingRecipe}
        saving={editorSaving}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveGeneratedRecipe}
      />

      {statusNotice && (
        <StatusNotice
          tone={statusNotice.tone}
          title={statusNotice.title}
          message={statusNotice.message}
          actionLabel={statusNotice.actionLabel}
          onAction={statusNotice.onAction}
          icon={<Sparkles className="h-4 w-4" />}
        />
      )}

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
              <span key={s.id} className="ui-chip-muted">
                {s.name}
              </span>
            ))}
            {stockItems.length > 20 && (
              <span className="text-xs text-text-secondary">+{stockItems.length - 20}品</span>
            )}
          </div>
        )}
      </div>


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
                setLastAction(null)
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
          className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
          献立を作り直して
        </button>
      </div>

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
                    setEditorSessionVersion((prev) => prev + 1)
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
