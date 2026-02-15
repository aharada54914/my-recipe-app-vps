import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { db } from '../db/db'

const UNIT_OPTIONS = ['g', 'ml', '個', '本', '株', 'パック', '袋', '枚', '片', '缶']

export function StockManager() {
  const items = useLiveQuery(() => db.stock.orderBy('name').toArray())
  const [newName, setNewName] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const toggle = async (id: number, current: boolean) => {
    await db.stock.update(id, { inStock: !current })
  }

  const addItem = async () => {
    const name = newName.trim()
    if (!name) return
    const existing = await db.stock.where('name').equals(name).first()
    if (existing) return
    await db.stock.add({ name, inStock: false })
    setNewName('')
  }

  const deleteItem = async (id: number) => {
    await db.stock.delete(id)
    if (expandedId === id) setExpandedId(null)
  }

  const updateQuantity = async (id: number, quantity: number) => {
    await db.stock.update(id, { quantity })
  }

  const updateUnit = async (id: number, unit: string) => {
    await db.stock.update(id, { unit })
  }

  if (!items) return null

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">在庫管理</h2>

      {/* Add item */}
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="食材を追加..."
          className="flex-1 rounded-xl bg-bg-card px-4 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none"
        />
        <button
          onClick={addItem}
          className="rounded-xl bg-accent p-2 text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Item list */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl bg-bg-card overflow-hidden">
            {/* Main row */}
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Toggle */}
              <button
                onClick={() => toggle(item.id!, item.inStock)}
                className="flex flex-1 items-center justify-between text-left"
              >
                <span className={item.inStock ? 'text-text-primary' : 'text-text-secondary'}>
                  {item.name}
                  {item.quantity != null && item.quantity > 0 && (
                    <span className="ml-2 text-xs text-text-secondary">
                      ({item.quantity}{item.unit || ''})
                    </span>
                  )}
                </span>
                <div
                  className={`h-6 w-11 rounded-full p-0.5 transition-colors ${item.inStock ? 'bg-accent' : 'bg-white/10'
                    }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-white transition-transform ${item.inStock ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </div>
              </button>

              {/* Expand button */}
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id!)}
                className="ml-1 rounded-lg p-1 text-text-secondary transition-colors hover:text-accent"
              >
                {expandedId === item.id
                  ? <ChevronUp className="h-4 w-4" />
                  : <ChevronDown className="h-4 w-4" />
                }
              </button>
            </div>

            {/* Expanded: quantity editor */}
            {expandedId === item.id && (
              <div className="border-t border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-text-secondary whitespace-nowrap">数量</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={item.quantity ?? ''}
                    onChange={(e) => updateQuantity(item.id!, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-text-primary text-right outline-none"
                  />
                  <select
                    value={item.unit || 'g'}
                    onChange={(e) => updateUnit(item.id!, e.target.value)}
                    className="rounded-lg bg-white/5 px-2 py-1.5 text-sm text-text-primary outline-none"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <div className="flex-1" />
                  <button
                    onClick={() => deleteItem(item.id!)}
                    className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
