import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Star, ShoppingCart, Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { db } from '../db/db'
import type { DeviceType } from '../db/db'
import { adjustIngredients, formatQuantityVibe } from '../utils/recipeUtils'
import { toggleFavorite } from '../utils/favoritesUtils'
import { getMissingIngredients, formatShoppingListForLine, copyToClipboard } from '../utils/shoppingUtils'
import { useWakeLock } from '../hooks/useWakeLock'
import { ServingAdjuster } from './ServingAdjuster'
import { SaltCalculator } from './SaltCalculator'
import { ScheduleGantt } from './ScheduleGantt'

const deviceLabels: Record<DeviceType, string> = {
  hotcook: 'ホットクック',
  healsio: 'ヘルシオ',
  manual: '手動調理',
}

interface RecipeDetailProps {
  recipeId: number
  onBack: () => void
}

export function RecipeDetail({ recipeId, onBack }: RecipeDetailProps) {
  const recipe = useLiveQuery(() => db.recipes.get(recipeId), [recipeId])
  const isFav = useLiveQuery(() => db.favorites.where('recipeId').equals(recipeId).count(), [recipeId])
  const stockItems = useLiveQuery(() => db.stock.toArray(), [])
  const existingNote = useLiveQuery(() => db.userNotes.where('recipeId').equals(recipeId).first(), [recipeId])

  const [servings, setServings] = useState<number | null>(null)
  // T-13: User notes state
  const [noteText, setNoteText] = useState<string | null>(null)
  const [noteSaved, setNoteSaved] = useState(false)
  // T-18: Shopping list state
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [copied, setCopied] = useState(false)
  // T-26: raw steps expand
  const [showRawSteps, setShowRawSteps] = useState(false)

  // T-11: Keep screen on during recipe viewing
  useWakeLock()

  // T-13: Save note handler (must be before early return — Rules of Hooks)
  const handleSaveNote = useCallback(async () => {
    const content = (noteText ?? '').trim()
    if (!content && !existingNote) return

    if (existingNote) {
      if (content) {
        await db.userNotes.update(existingNote.id!, { content, updatedAt: new Date() })
      } else {
        await db.userNotes.delete(existingNote.id!)
      }
    } else if (content) {
      await db.userNotes.add({ recipeId, content, updatedAt: new Date() })
    }
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }, [noteText, existingNote, recipeId])

  // T-18: Copy shopping list (must be before early return — Rules of Hooks)
  const handleCopyShoppingList = useCallback(async () => {
    if (!recipe) return
    const ingredients = recipe.ingredients
    const stock = stockItems ?? []
    const missingItems = getMissingIngredients(ingredients, stock)
    const text = formatShoppingListForLine(recipe.title, missingItems)
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [recipe, stockItems])

  if (!recipe) return null

  // Initialize note text from DB on first render
  const displayNote = noteText ?? existingNote?.content ?? ''

  const currentServings = servings ?? recipe.baseServings
  const adjusted = adjustIngredients(recipe.ingredients, recipe.baseServings, currentServings)
  const mainIngredients = adjusted.filter((i) => i.category === 'main')
  const subIngredients = adjusted.filter((i) => i.category === 'sub')
  const favorited = (isFav ?? 0) > 0

  // T-18: Shopping list calculations
  const missing = stockItems ? getMissingIngredients(recipe.ingredients, stockItems) : []

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
        <div className="flex-1">
          <h1 className="text-lg font-bold">{recipe.title}</h1>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="rounded-lg bg-accent/20 px-2 py-0.5 font-medium text-accent">
              {deviceLabels[recipe.device]}
            </span>
            <span>No.{recipe.recipeNumber}</span>
            <span>{recipe.totalTimeMinutes}分</span>
            {recipe.calories && <span>{recipe.calories}</span>}
            {recipe.saltContent && <span>塩分{recipe.saltContent}</span>}
          </div>
        </div>
        {/* T-26: External link for CSV recipes */}
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
          >
            <ExternalLink className="h-5 w-5 text-accent" />
          </a>
        )}
        <button
          onClick={() => toggleFavorite(recipeId)}
          className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
        >
          <Star className={`h-5 w-5 ${favorited ? 'fill-accent text-accent' : 'text-text-secondary'}`} />
        </button>
      </header>

      <main className="space-y-6 px-4 pb-8">
        {/* Servings */}
        <div className="flex justify-center">
          <ServingAdjuster
            servings={currentServings}
            onChange={setServings}
          />
        </div>

        {/* Ingredients */}
        <div className="rounded-2xl bg-bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-text-secondary">材料</h4>
            {/* T-18: Shopping list button */}
            <button
              onClick={() => setShowShoppingList(prev => !prev)}
              className="flex items-center gap-1 rounded-lg bg-accent/20 px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/30"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              買い物リスト
              {missing.length > 0 && (
                <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                  {missing.length}
                </span>
              )}
            </button>
          </div>

          {/* T-18: Shopping list panel */}
          {showShoppingList && (
            <div className="mb-4 rounded-xl bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">
                  不足材料 ({missing.length}件)
                </span>
                <button
                  onClick={handleCopyShoppingList}
                  className="flex items-center gap-1 rounded-lg bg-bg-card px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:text-accent"
                >
                  {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'コピー済み' : 'LINEに送る'}
                </button>
              </div>
              {missing.length === 0 ? (
                <p className="text-xs text-green-400">✨ 全ての材料が揃っています！</p>
              ) : (
                <ul className="space-y-1">
                  {missing.map(ing => (
                    <li key={ing.name} className="flex justify-between text-xs text-text-secondary">
                      <span>・{ing.name}</span>
                      <span>{ing.quantity > 0 ? `${ing.quantity}${ing.unit}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mainIngredients.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-accent">主材料</div>
              <ul className="space-y-1.5">
                {mainIngredients.map((ing) => (
                  <li key={ing.name} className="flex justify-between text-sm">
                    <span>{ing.name}{ing.optional ? ' (任意)' : ''}</span>
                    <span className="font-medium text-text-secondary">
                      {formatQuantityVibe(ing.quantity, ing.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {subIngredients.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-text-secondary">調味料・その他</div>
              <ul className="space-y-1.5">
                {subIngredients.map((ing) => (
                  <li key={ing.name} className="flex justify-between text-sm">
                    <span>{ing.name}{ing.optional ? ' (任意)' : ''}</span>
                    <span className="font-medium text-text-secondary">
                      {formatQuantityVibe(ing.quantity, ing.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Salt Calculator */}
        <SaltCalculator totalWeightG={recipe.totalWeightG} />

        {/* Schedule */}
        <ScheduleGantt steps={recipe.steps} />

        {/* T-26: Raw steps from CSV */}
        {recipe.rawSteps && recipe.rawSteps.length > 0 && (
          <div className="rounded-2xl bg-bg-card p-4">
            <button
              onClick={() => setShowRawSteps(!showRawSteps)}
              className="flex w-full items-center justify-between text-sm font-bold text-text-secondary"
            >
              <span>📋 元の手順テキスト</span>
              {showRawSteps ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showRawSteps && (
              <ol className="mt-3 space-y-2">
                {recipe.rawSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-text-secondary">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* T-13: Personal Notes */}
        <div className="rounded-2xl bg-bg-card p-4">
          <h4 className="mb-3 text-sm font-bold text-text-secondary">📝 メモ</h4>
          <textarea
            value={displayNote}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="調理メモを記入...（例：塩をやや少なめにした）"
            rows={3}
            className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            {noteSaved && (
              <span className="text-xs text-green-400">保存しました ✓</span>
            )}
            <button
              onClick={handleSaveNote}
              className="rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/30"
            >
              保存
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

