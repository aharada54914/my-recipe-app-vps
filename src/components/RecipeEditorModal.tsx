import { useMemo, useState } from 'react'
import { Plus, Trash2, X, Save } from 'lucide-react'
import type { Recipe } from '../db/db'
import type { RecipeDraft } from '../utils/recipeDraftNormalizer'
import { normalizeRecipeDraft, toRecipeDraft } from '../utils/recipeDraftNormalizer'

interface RecipeEditorModalProps {
  open: boolean
  title?: string
  initialRecipe: Omit<Recipe, 'id'> | null
  saving?: boolean
  onClose: () => void
  onSave: (recipe: Omit<Recipe, 'id'>) => Promise<void>
}

const DEVICE_OPTIONS: { value: RecipeDraft['device']; label: string }[] = [
  { value: 'manual', label: '手動調理' },
  { value: 'hotcook', label: 'ホットクック' },
  { value: 'healsio', label: 'ヘルシオ' },
]

const CATEGORY_OPTIONS: RecipeDraft['category'][] = ['主菜', '副菜', 'スープ', 'ご飯もの', 'デザート']

export function RecipeEditorModal({
  open,
  title = 'レシピ編集',
  initialRecipe,
  saving = false,
  onClose,
  onSave,
}: RecipeEditorModalProps) {
  const [draft, setDraft] = useState<RecipeDraft | null>(() => (initialRecipe ? toRecipeDraft(initialRecipe) : null))
  const [error, setError] = useState<string | null>(null)

  const totalMinutes = useMemo(() => {
    if (!draft) return 0
    return draft.steps.reduce((sum, step) => sum + (Number.isFinite(step.durationMinutes) ? step.durationMinutes : 0), 0)
  }, [draft])

  if (!open || !draft) return null

  const updateIngredient = (index: number, key: keyof RecipeDraft['ingredients'][number], value: string | number | boolean) => {
    setDraft((prev) => {
      if (!prev) return prev
      const nextIngredients = [...prev.ingredients]
      const target = { ...nextIngredients[index], [key]: value }
      nextIngredients[index] = target
      return { ...prev, ingredients: nextIngredients }
    })
  }

  const updateStep = (index: number, key: keyof RecipeDraft['steps'][number], value: string | number | boolean) => {
    setDraft((prev) => {
      if (!prev) return prev
      const nextSteps = [...prev.steps]
      const target = { ...nextSteps[index], [key]: value }
      nextSteps[index] = target
      return { ...prev, steps: nextSteps }
    })
  }

  const handleSave = async () => {
    try {
      const normalized = normalizeRecipeDraft({ ...draft, totalTimeMinutes: totalMinutes })
      setError(null)
      await onSave(normalized)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存前の検証に失敗しました。')
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-bg-primary shadow-2xl sm:h-[88dvh] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-text-primary">{title}</h3>
            <p className="text-xs text-text-secondary">材料・分量・手順を編集してから保存できます</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-text-secondary transition-colors hover:bg-white/20"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-text-secondary">レシピ名</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-white/15 focus:ring-accent"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-text-secondary">機器</span>
              <select
                value={draft.device}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, device: e.target.value as RecipeDraft['device'] } : prev)}
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-white/15 focus:ring-accent"
              >
                {DEVICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-text-secondary">カテゴリ</span>
              <select
                value={draft.category}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, category: e.target.value as RecipeDraft['category'] } : prev)}
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-white/15 focus:ring-accent"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-text-secondary">人数</span>
              <input
                type="number"
                min={1}
                max={10}
                value={draft.baseServings}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, baseServings: Number(e.target.value) } : prev)}
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-white/15 focus:ring-accent"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-text-secondary">総重量(g)</span>
              <input
                type="number"
                min={1}
                value={draft.totalWeightG}
                onChange={(e) => setDraft((prev) => prev ? { ...prev, totalWeightG: Number(e.target.value) } : prev)}
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-white/15 focus:ring-accent"
              />
            </label>
          </div>

          <div className="rounded-2xl bg-bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-text-primary">材料</h4>
              <button
                onClick={() => setDraft((prev) => prev ? { ...prev, ingredients: [...prev.ingredients, { name: '', quantity: 0, unit: 'g', category: 'main' }] } : prev)}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-text-secondary hover:bg-white/20"
              >
                <Plus className="h-3 w-3" /> 追加
              </button>
            </div>
            <div className="space-y-2">
              {draft.ingredients.map((ing, index) => (
                <div key={`ing-${index}`} className="grid grid-cols-[1fr_72px_72px_80px_32px] items-center gap-2">
                  <input
                    value={ing.name}
                    placeholder="食材名"
                    onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                    className="rounded-lg bg-white/5 px-2 py-2 text-xs text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent"
                  />
                  <input
                    type="number"
                    value={ing.quantity}
                    onChange={(e) => updateIngredient(index, 'quantity', Number(e.target.value))}
                    className="rounded-lg bg-white/5 px-2 py-2 text-xs text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent"
                  />
                  <input
                    value={ing.unit}
                    onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                    className="rounded-lg bg-white/5 px-2 py-2 text-xs text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent"
                  />
                  <select
                    value={ing.category}
                    onChange={(e) => updateIngredient(index, 'category', e.target.value as RecipeDraft['ingredients'][number]['category'])}
                    className="rounded-lg bg-white/5 px-2 py-2 text-xs text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent"
                  >
                    <option value="main">主材料</option>
                    <option value="sub">調味料</option>
                  </select>
                  <button
                    onClick={() => setDraft((prev) => prev ? { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) } : prev)}
                    className="rounded-lg bg-white/10 p-2 text-text-secondary hover:bg-red-500/20 hover:text-red-300"
                    aria-label="材料を削除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-text-primary">手順</h4>
              <button
                onClick={() => setDraft((prev) => prev ? { ...prev, steps: [...prev.steps, { name: '', durationMinutes: 5, isDeviceStep: false }] } : prev)}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-text-secondary hover:bg-white/20"
              >
                <Plus className="h-3 w-3" /> 追加
              </button>
            </div>
            <div className="space-y-2">
              {draft.steps.map((step, index) => (
                <div key={`step-${index}`} className="space-y-2 rounded-xl bg-white/5 p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs font-bold text-text-secondary">{index + 1}</span>
                    <input
                      value={step.name}
                      placeholder="手順"
                      onChange={(e) => updateStep(index, 'name', e.target.value)}
                      className="flex-1 rounded-lg bg-white/5 px-2 py-2 text-xs text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent"
                    />
                    <input
                      type="number"
                      min={1}
                      value={step.durationMinutes}
                      onChange={(e) => updateStep(index, 'durationMinutes', Number(e.target.value))}
                      className="w-16 rounded-lg bg-white/5 px-2 py-2 text-xs text-text-primary outline-none ring-1 ring-white/10 focus:ring-accent"
                    />
                    <span className="text-xs text-text-secondary">分</span>
                    <button
                      onClick={() => setDraft((prev) => prev ? { ...prev, steps: prev.steps.filter((_, i) => i !== index) } : prev)}
                      className="rounded-lg bg-white/10 p-2 text-text-secondary hover:bg-red-500/20 hover:text-red-300"
                      aria-label="手順を削除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 pl-8 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={!!step.isDeviceStep}
                      onChange={(e) => updateStep(index, 'isDeviceStep', e.target.checked)}
                    />
                    機器ステップ
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white/5 px-3 py-2 text-xs text-text-secondary">
            合計時間（自動再計算）: {totalMinutes}分
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-white/10 px-4 py-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-white/20"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '保存して追加'}
          </button>
        </div>
      </div>
    </div>
  )
}
