import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { db } from '../db/db'

export function StockManager() {
  const items = useLiveQuery(() => db.stock.orderBy('name').toArray())
  const [newName, setNewName] = useState('')

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
          <button
            key={item.id}
            onClick={() => toggle(item.id!, item.inStock)}
            className="flex w-full items-center justify-between rounded-xl bg-bg-card px-4 py-3 text-left transition-colors hover:bg-bg-card-hover"
          >
            <span className={item.inStock ? 'text-text-primary' : 'text-text-secondary'}>
              {item.name}
            </span>
            <div
              className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                item.inStock ? 'bg-accent' : 'bg-white/10'
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white transition-transform ${
                  item.inStock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
