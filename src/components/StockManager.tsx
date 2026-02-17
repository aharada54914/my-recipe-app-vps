import { useState, useRef, useCallback, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { StockItem } from '../db/db'
import { DEFAULT_STOCK_ITEMS } from '../data/defaultStock'

const UNIT_OPTIONS = ['g', 'ml', '個', '本', '株', 'パック', '袋', '枚', '片', '缶']
const SWIPE_THRESHOLD = 80

interface SwipeState {
  startX: number
  offsetX: number
  swiping: boolean
}

function StockRow({
  item,
  onToggle,
  onDelete,
  onUpdateQuantity,
  onUpdateUnit,
}: {
  item: StockItem
  onToggle: () => void
  onDelete: () => void
  onUpdateQuantity: (quantity: number) => void
  onUpdateUnit: (unit: string) => void
}) {
  const [swipe, setSwipe] = useState<SwipeState>({ startX: 0, offsetX: 0, swiping: false })
  const rowRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setSwipe({ startX: e.touches[0].clientX, offsetX: 0, swiping: true })
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipe.swiping) return
    const diff = swipe.startX - e.touches[0].clientX
    // Only allow swiping left (positive diff)
    setSwipe((prev) => ({ ...prev, offsetX: Math.max(0, diff) }))
  }, [swipe.swiping, swipe.startX])

  const handleTouchEnd = useCallback(() => {
    if (swipe.offsetX > SWIPE_THRESHOLD) {
      onDelete()
    }
    setSwipe({ startX: 0, offsetX: 0, swiping: false })
  }, [swipe.offsetX, onDelete])

  const translateX = Math.min(swipe.offsetX, 120)

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Delete background — only visible when swiping */}
      {swipe.offsetX > 0 && (
        <div className="absolute inset-0 flex items-center justify-end bg-red-500 px-4">
          <Trash2 className="h-5 w-5 text-white" />
        </div>
      )}

      {/* Swipeable content */}
      <div
        ref={rowRef}
        className="relative bg-[#1a1a1c] transition-transform"
        style={{ transform: `translateX(-${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          {/* Toggle */}
          <button
            onClick={onToggle}
            className="flex shrink-0 items-center"
          >
            <div
              className={`h-6 w-11 rounded-full p-0.5 transition-colors ${item.inStock ? 'bg-accent' : 'bg-white/10'}`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white transition-transform ${item.inStock ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </div>
          </button>

          {/* Name */}
          <span className={`min-w-0 flex-1 truncate text-sm ${item.inStock ? 'text-text-primary' : 'text-text-secondary'}`}>
            {item.name}
          </span>

          {/* Inline quantity + unit */}
          <input
            type="number"
            min={0}
            step={1}
            value={item.quantity ?? ''}
            onChange={(e) => onUpdateQuantity(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="w-16 rounded-lg bg-white/5 px-2 py-1.5 text-sm text-text-primary text-right outline-none"
          />
          <select
            value={item.unit || 'g'}
            onChange={(e) => onUpdateUnit(e.target.value)}
            className="rounded-lg bg-white/5 px-1.5 py-1.5 text-sm text-text-primary outline-none"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export function StockManager() {
  const items = useLiveQuery(() => db.stock.orderBy('name').toArray())
  const [newName, setNewName] = useState('')

  // Auto-seed default stock items when DB is empty
  useEffect(() => {
    (async () => {
      const count = await db.stock.count()
      if (count === 0) {
        await db.stock.bulkAdd(
          DEFAULT_STOCK_ITEMS.map(name => ({ name, inStock: false }))
        )
      }
    })()
  }, [])

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
          <StockRow
            key={item.id}
            item={item}
            onToggle={() => toggle(item.id!, item.inStock)}
            onDelete={() => deleteItem(item.id!)}
            onUpdateQuantity={(q) => updateQuantity(item.id!, q)}
            onUpdateUnit={(u) => updateUnit(item.id!, u)}
          />
        ))}
      </div>
    </div>
  )
}
