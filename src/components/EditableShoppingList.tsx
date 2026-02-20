/**
 * EditableShoppingList — Interactive shopping list with check-off and LINE share.
 *
 * Checked state is persisted in localStorage so it survives page reloads.
 * Checked items are moved to the bottom with a strikethrough style.
 */

import { useState, useCallback, useEffect } from 'react'
import { Check, Copy, CheckCheck } from 'lucide-react'
import { copyToClipboard } from '../utils/shoppingUtils'

export interface ShoppingIngredient {
  name: string
  totalQuantity: number
  unit: string
  inStock: boolean
}

interface Props {
  weekLabel: string
  ingredients: ShoppingIngredient[]
  storageKey?: string
}

function formatQty(ing: ShoppingIngredient): string {
  if (ing.unit === '適量') return '適量'
  const qty = Math.round(ing.totalQuantity * 10) / 10
  return `${qty}${ing.unit}`
}

export function EditableShoppingList({ weekLabel, ingredients, storageKey = 'shopping_checked' }: Props) {
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const [copied, setCopied] = useState(false)

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

  const missing = ingredients.filter(i => !i.inStock)
  const inStockItems = ingredients.filter(i => i.inStock)

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

  return (
    <div className="space-y-3">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-secondary">
          {checkedCount > 0 && `${checkedCount}/${missing.length}件 購入済み`}
        </div>
        <div className="flex gap-2">
          {checkedCount > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-text-secondary hover:text-accent"
            >
              チェックをリセット
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg bg-bg-card-hover px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-accent"
          >
            {copied ? <CheckCheck className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'コピー済み' : 'LINEに送る'}
          </button>
        </div>
      </div>

      {/* Missing ingredients — interactive */}
      {missing.length === 0 ? (
        <p className="text-xs text-green-400">全ての材料が揃っています！</p>
      ) : (
        <div>
          <div className="mb-1.5 text-xs font-medium text-accent">
            不足材料 ({missing.filter(i => !checked.has(i.name)).length}件)
          </div>
          <ul className="space-y-1">
            {sortedMissing.map(ing => {
              const isChecked = checked.has(ing.name)
              return (
                <li key={ing.name}>
                  <button
                    onClick={() => toggle(ing.name)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                      isChecked ? 'bg-white/3 opacity-40' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isChecked ? 'border-green-400 bg-green-400/20' : 'border-white/20'
                    }`}>
                      {isChecked && <Check className="h-2.5 w-2.5 text-green-400" />}
                    </div>
                    <span className={`flex-1 text-xs ${isChecked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                      {ing.name}
                    </span>
                    <span className={`text-xs ${isChecked ? 'text-text-secondary' : 'text-text-secondary'}`}>
                      {formatQty(ing)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* In-stock items — non-interactive summary */}
      {inStockItems.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-text-secondary">在庫あり ({inStockItems.length}件)</div>
          <ul className="space-y-0.5">
            {inStockItems.map(ing => (
              <li key={ing.name} className="flex justify-between px-2 text-xs text-text-secondary line-through opacity-40">
                <span>・{ing.name}</span>
                <span>{formatQty(ing)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
