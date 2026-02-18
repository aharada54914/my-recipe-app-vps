import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Star, ShoppingCart, Copy, Check, ExternalLink, Clock, Hash, Calendar } from 'lucide-react'
import { db } from '../db/db'
import type { DeviceType } from '../db/db'
import { adjustIngredients, formatQuantityVibe } from '../utils/recipeUtils'
import { toggleFavorite } from '../utils/favoritesUtils'
import { getMissingIngredients, formatShoppingListForLine, copyToClipboard } from '../utils/shoppingUtils'
import { useWakeLock } from '../hooks/useWakeLock'
import { RecipeImage } from './RecipeImage'
import { ServingAdjuster } from './ServingAdjuster'
import { SaltCalculator } from './SaltCalculator'
import { ScheduleGantt } from './ScheduleGantt'
import { CalendarRegistrationModal } from './CalendarRegistrationModal'

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
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>('ingredients')

  // T-11: Keep screen on during recipe viewing
  useWakeLock()

  // Record view history
  useEffect(() => {
    db.viewHistory.add({ recipeId, viewedAt: new Date() })
  }, [recipeId])

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
          className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{recipe.title}</h1>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="rounded-lg bg-accent/20 px-2 py-0.5 font-medium text-accent">
              {deviceLabels[recipe.device]}
            </span>
          </div>
        </div>
        {/* External link for CSV recipes */}
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
          >
            <ExternalLink className="h-5 w-5 text-accent" />
          </a>
        )}
        <button
          onClick={() => setShowCalendarModal(true)}
          className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
        >
          <Calendar className="h-5 w-5 text-text-secondary" />
        </button>
        <button
          onClick={() => toggleFavorite(recipeId)}
          className="rounded-xl bg-bg-card p-3 transition-colors hover:bg-bg-card-hover"
        >
          <Star className={`h-5 w-5 ${favorited ? 'fill-accent text-accent' : 'text-text-secondary'}`} />
        </button>
      </header>

      <main className="space-y-6 px-4 pb-8">
        {/* Recipe Image */}
        <RecipeImage
          recipe={recipe}
          placeholderHeight="h-48"
          className="w-full"
        />

        {/* Info Badges */}
        <div className="flex flex-wrap gap-2">
          {recipe.totalTimeMinutes > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl bg-bg-card px-3 py-2">
              <Clock className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">{recipe.totalTimeMinutes}分</span>
            </div>
          )}
          {recipe.recipeNumber && (
            <div className="flex items-center gap-1.5 rounded-xl bg-bg-card px-3 py-2">
              <Hash className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">{recipe.recipeNumber}</span>
            </div>
          )}
          {recipe.calories && (
            <div className="rounded-xl bg-bg-card px-3 py-2">
              <span className="text-sm font-medium">{recipe.calories}</span>
            </div>
          )}
          {recipe.saltContent && (
            <div className="rounded-xl bg-bg-card px-3 py-2">
              <span className="text-sm font-medium">塩分 {recipe.saltContent}</span>
            </div>
          )}
        </div>

        {/* Servings */}
        <div className="flex justify-center">
          <ServingAdjuster
            servings={currentServings}
            onChange={setServings}
          />
        </div>

        {/* Tab switching: Ingredients / Steps */}
        {recipe.rawSteps && recipe.rawSteps.length > 0 ? (
          <>
            {/* Tab buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('ingredients')}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                  activeTab === 'ingredients'
                    ? 'bg-accent text-white'
                    : 'bg-bg-card text-text-secondary hover:text-text-primary'
                }`}
              >
                材料
              </button>
              <button
                onClick={() => setActiveTab('steps')}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                  activeTab === 'steps'
                    ? 'bg-accent text-white'
                    : 'bg-bg-card text-text-secondary hover:text-text-primary'
                }`}
              >
                手順
              </button>
            </div>

            {/* Tab content */}
            {activeTab === 'ingredients' ? (
              <div className="rounded-2xl bg-bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-text-secondary">材料</h4>
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
                      <p className="text-xs text-green-400">全ての材料が揃っています！</p>
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
                    <table className="w-full">
                      <tbody>
                        {mainIngredients.map((ing) => (
                          <tr key={ing.name} className="border-b border-white/5 last:border-0">
                            <td className="py-1.5 text-sm">
                              {ing.name}{ing.optional ? ' (任意)' : ''}
                            </td>
                            <td className="py-1.5 text-right text-sm font-medium text-text-secondary whitespace-nowrap">
                              {formatQuantityVibe(ing.quantity, ing.unit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {subIngredients.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-text-secondary">調味料・その他</div>
                    <table className="w-full">
                      <tbody>
                        {subIngredients.map((ing) => (
                          <tr key={ing.name} className="border-b border-white/5 last:border-0">
                            <td className="py-1.5 text-sm">
                              {ing.name}{ing.optional ? ' (任意)' : ''}
                            </td>
                            <td className="py-1.5 text-right text-sm font-medium text-text-secondary whitespace-nowrap">
                              {formatQuantityVibe(ing.quantity, ing.unit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-bg-card p-4">
                <h4 className="mb-3 text-sm font-bold text-text-secondary">調理手順</h4>
                <div className="space-y-3">
                  {recipe.rawSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm leading-relaxed text-text-secondary">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* No rawSteps — show ingredients only (legacy layout) */
          <div className="rounded-2xl bg-bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-text-secondary">材料</h4>
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
                  <p className="text-xs text-green-400">全ての材料が揃っています！</p>
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
                <table className="w-full">
                  <tbody>
                    {mainIngredients.map((ing) => (
                      <tr key={ing.name} className="border-b border-white/5 last:border-0">
                        <td className="py-1.5 text-sm">
                          {ing.name}{ing.optional ? ' (任意)' : ''}
                        </td>
                        <td className="py-1.5 text-right text-sm font-medium text-text-secondary whitespace-nowrap">
                          {formatQuantityVibe(ing.quantity, ing.unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {subIngredients.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium text-text-secondary">調味料・その他</div>
                <table className="w-full">
                  <tbody>
                    {subIngredients.map((ing) => (
                      <tr key={ing.name} className="border-b border-white/5 last:border-0">
                        <td className="py-1.5 text-sm">
                          {ing.name}{ing.optional ? ' (任意)' : ''}
                        </td>
                        <td className="py-1.5 text-right text-sm font-medium text-text-secondary whitespace-nowrap">
                          {formatQuantityVibe(ing.quantity, ing.unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Salt Calculator */}
        <SaltCalculator totalWeightG={recipe.totalWeightG} />

        {/* Schedule */}
        <ScheduleGantt steps={recipe.steps} recipe={recipe} />

        {/* Personal Notes */}
        <div className="rounded-2xl bg-bg-card p-4">
          <h4 className="mb-3 text-sm font-bold text-text-secondary">📝 メモ</h4>
          <textarea
            value={displayNote}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="調理メモを記入...（例：塩をやや少なめにした）"
            rows={3}
            className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-base text-text-primary placeholder:text-text-secondary outline-none"
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

      {/* Calendar Registration Modal */}
      {showCalendarModal && (
        <CalendarRegistrationModal
          recipe={recipe}
          stockItems={stockItems ?? []}
          onClose={() => setShowCalendarModal(false)}
        />
      )}
    </div>
  )
}
