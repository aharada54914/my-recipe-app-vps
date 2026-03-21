/**
 * EditableShoppingList — Interactive shopping list with check-off and LINE share.
 *
 * Checked state is persisted in localStorage so it survives page reloads.
 * Checked items are moved to the bottom with a strikethrough style.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Check, Copy, CheckCheck, Plus, Trash2 } from 'lucide-react'
import { copyToClipboard } from '../utils/shoppingUtils'
import { convertToShoppingUnit } from '../utils/shoppingUnitConverter'

export interface ShoppingIngredient {
  name: string
  totalQuantity: number | string
  unit: string
  inStock: boolean
  ingredientCategory?: 'main' | 'sub'
}

interface Props {
  weekLabel: string
  ingredients: ShoppingIngredient[]
  storageKey?: string
  includeSeasonings: boolean
  onToggleIncludeSeasonings: () => void
}

interface EditableItem {
  id: string
  name: string
  quantity: number | string
  unit: string
  inStock: boolean
  ingredientCategory: 'main' | 'sub'
  shoppingNote?: string  // original recipe amount, e.g. "約150g分"
}

function formatQty(ing: EditableItem): string {
  if (ing.unit === '適量') return '適量'
  const qty = typeof ing.quantity === 'number'
    ? String(Math.round(ing.quantity * 10) / 10)
    : String(ing.quantity)
  return `${qty}${ing.unit}${ing.shoppingNote ? `（${ing.shoppingNote}）` : ''}`
}

export function EditableShoppingList({
  weekLabel,
  ingredients,
  storageKey = 'shopping_checked',
  includeSeasonings,
  onToggleIncludeSeasonings,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const [copied, setCopied] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customQty, setCustomQty] = useState('')
  const [customUnit, setCustomUnit] = useState('個')

  const sourceItems = useMemo<EditableItem[]>(() => {
    const filtered = includeSeasonings
      ? ingredients
      : ingredients.filter((i) => (i.ingredientCategory ?? 'main') === 'main')

    return filtered.map((i) => {
      const rawQty = typeof i.totalQuantity === 'number' ? i.totalQuantity : 0
      const converted = convertToShoppingUnit(i.name, rawQty, i.unit)
      return {
        id: `${i.name}__${i.unit}`,
        name: i.name,
        quantity: converted.quantity,
        unit: converted.unit,
        inStock: i.inStock,
        ingredientCategory: i.ingredientCategory ?? 'main',
        shoppingNote: converted.note,
      }
    })
  }, [ingredients, includeSeasonings])

  const [items, setItems] = useState<EditableItem[]>([])

  useEffect(() => {
    setItems(sourceItems)
  }, [sourceItems])

  // Persist checked state
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...checked]))
    } catch { /* ignore */ }
  }, [checked, storageKey])

  const toggle = useCallback((name: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const clearAll = useCallback(() => setChecked(new Set()), [])

  const missing = items.filter(i => !i.inStock)
  const inStockItems = items.filter(i => i.inStock)

  // Sort: unchecked first, checked last
  const sortedMissing = [
    ...missing.filter(i => !checked.has(i.name)),
    ...missing.filter(i => checked.has(i.name)),
  ]

  const handleCopy = async () => {
    const unchecked = missing.filter(i => !checked.has(i.name))
    const lines = [`【買い物リスト】${weekLabel}`, ...unchecked.map(i => `・${i.name} ${formatQty(i)}`)]
    const ok = await copyToClipboard(lines.join('\n'))
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const checkedCount = missing.filter(i => checked.has(i.name)).length

  const updateItem = useCallback((id: string, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const addCustomItem = useCallback(() => {
    const name = customName.trim()
    if (!name) return
    const quantity = Number(customQty || '0')
    const next: EditableItem = {
      id: `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unit: customUnit.trim() || '個',
      inStock: false,
      ingredientCategory: 'main',
    }
    setItems((prev) => [...prev, next])
    setCustomName('')
    setCustomQty('')
  }, [customName, customQty, customUnit])

  return (
    <div className="space-y-3">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-text-secondary">
          {checkedCount > 0 && `${checkedCount}/${missing.length}件 購入済み`}
        </div>
        <div className="flex flex-wrap gap-2">
          {checkedCount > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-text-secondary hover:text-accent"
            >
              チェックをリセット
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex min-h-[44px] items-center gap-1 rounded-lg bg-bg-card-hover px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:text-accent"
          >
            {copied ? <CheckCheck className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'コピー済み' : 'LINEに送る'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
        <span className="text-sm text-text-secondary">調味料も表示する</span>
        <button
          onClick={onToggleIncludeSeasonings}
          className={`min-h-[40px] rounded-lg px-3 py-1 text-sm font-semibold transition-colors ${
            includeSeasonings ? 'bg-accent text-white' : 'bg-white/10 text-text-secondary'
          }`}
        >
          {includeSeasonings ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Missing ingredients — interactive */}
      {missing.length === 0 ? (
        <p className="text-sm text-green-400">全ての材料が揃っています！</p>
      ) : (
        <div>
          <div className="mb-1.5 text-sm font-semibold text-accent">
            不足材料 ({missing.filter(i => !checked.has(i.name)).length}件)
          </div>
          <ul className="space-y-1">
            {sortedMissing.map(ing => {
              const isChecked = checked.has(ing.name)
              return (
                <li key={ing.id} className={`rounded-lg px-2 py-2 transition-colors ${
                      isChecked ? 'bg-white/3 opacity-40' : 'bg-white/5 hover:bg-white/10'
                    }`}>
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      onClick={() => toggle(ing.name)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isChecked ? 'border-green-400 bg-green-400/20' : 'border-white/20'
                      }`}
                    >
                      {isChecked && <Check className="h-2.5 w-2.5 text-green-400" />}
                    </button>
                    <input
                      value={ing.name}
                      onChange={(e) => updateItem(ing.id, { name: e.target.value })}
                      className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${
                        isChecked ? 'line-through text-text-secondary' : 'text-text-primary'
                      }`}
                    />
                    <button onClick={() => removeItem(ing.id)} className="min-h-[36px] min-w-[36px] text-text-secondary hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="pl-6 space-y-1">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_72px]">
                      <input
                        type="number"
                        step="0.5"
                        value={Number.isFinite(Number(ing.quantity)) ? ing.quantity : 0}
                        onChange={(e) => updateItem(ing.id, { quantity: Number(e.target.value) })}
                        className="min-w-0 rounded-md bg-white/5 px-2 py-1 text-xs text-text-secondary outline-none"
                      />
                      <input
                        value={ing.unit}
                        onChange={(e) => updateItem(ing.id, { unit: e.target.value })}
                        className="w-full rounded-md bg-white/5 px-2 py-1 text-xs text-text-secondary outline-none sm:w-auto"
                      />
                    </div>
                    {ing.shoppingNote && (
                      <p className="text-[10px] text-text-secondary/60">{ing.shoppingNote}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-white/5 p-3">
        <div className="mb-2 text-sm font-medium text-text-secondary">不足材料を追加</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_auto]">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="食材名"
            className="col-span-2 min-w-0 rounded-md bg-white/10 px-2 py-1.5 text-xs text-text-primary outline-none sm:col-span-1"
          />
          <input
            type="number"
            step="0.5"
            value={customQty}
            onChange={(e) => setCustomQty(e.target.value)}
            placeholder="数量"
            className="min-w-0 rounded-md bg-white/10 px-2 py-1.5 text-xs text-text-primary outline-none"
          />
          <input
            value={customUnit}
            onChange={(e) => setCustomUnit(e.target.value)}
            placeholder="単位"
            className="min-w-0 rounded-md bg-white/10 px-2 py-1.5 text-xs text-text-primary outline-none"
          />
          <button
            onClick={addCustomItem}
            className="col-span-2 flex min-h-[40px] items-center justify-center rounded-md bg-accent px-2 py-1.5 text-white sm:col-span-1"
            aria-label="追加"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* In-stock items — non-interactive summary */}
      {inStockItems.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-medium text-text-secondary">在庫あり ({inStockItems.length}件)</div>
          <ul className="space-y-0.5">
            {inStockItems.map(ing => (
              <li key={ing.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-2 text-xs text-text-secondary line-through opacity-40">
                <span className="min-w-0 break-words">・{ing.name}</span>
                <span className="shrink-0 whitespace-nowrap">{formatQty(ing)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
