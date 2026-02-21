import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { db } from '../db/db'
import { useDebounce } from '../hooks/useDebounce'
import { expandSynonyms } from '../data/synonyms'
import { STOCK_MASTER } from '../data/stockMaster'

// Build the ingredient list from STOCK_MASTER, sorted 50音順
const INGREDIENT_INDEX = [...STOCK_MASTER]
  .map((item) => ({ name: item.name, defaultUnit: item.unit }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

function StockRow({
  name,
  unit,
  quantity,
  onUpdateQuantity,
}: {
  name: string
  unit: string
  quantity: number
  onUpdateQuantity: (quantity: number) => void
}) {
  return (
    <div className="flex min-h-[52px] items-center gap-2 rounded-xl bg-bg-card px-4 py-3 ring-1 ring-white/10">
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
        {name}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={1}
        value={quantity || ''}
        onChange={(e) => {
          const val = parseFloat(e.target.value)
          onUpdateQuantity(isNaN(val) ? 0 : val)
        }}
        placeholder="0"
        className="w-16 rounded-lg bg-white/5 px-2 py-2 text-sm text-text-primary text-right outline-none"
      />
      <span className="w-10 text-sm font-medium text-text-secondary">{unit}</span>
    </div>
  )
}

export function StockManager() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const stockItems = useLiveQuery(() => db.stock.toArray())

  const handleUpdateQuantity = async (name: string, unit: string, quantity: number) => {
    const existing = await db.stock.where('name').equals(name).first()
    if (existing) {
      await db.stock.update(existing.id!, { quantity, unit, inStock: quantity > 0 })
    } else {
      await db.stock.add({ name, quantity, unit, inStock: quantity > 0 })
    }
  }

  // Build a map of current stock quantities
  const stockMap = useMemo(
    () => new Map((stockItems ?? []).map((s) => [s.name, s])),
    [stockItems]
  )

  // Items with quantity > 0, sorted 50音順
  const inStockItems = useMemo(
    () =>
      INGREDIENT_INDEX.filter((ing) => {
        const s = stockMap.get(ing.name)
        return s && s.quantity && s.quantity > 0
      }).map((ing) => ({
        ...ing,
        quantity: stockMap.get(ing.name)!.quantity!,
      })),
    [stockMap]
  )

  // Search results: filter by debounced query, exclude already-stocked items
  const inStockNames = useMemo(() => new Set(inStockItems.map((i) => i.name)), [inStockItems])

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const synonyms = expandSynonyms(debouncedQuery.trim())
    return INGREDIENT_INDEX.filter((ing) => {
      if (inStockNames.has(ing.name)) return false
      const nameLower = ing.name.toLowerCase()
      return synonyms.some(
        (syn) =>
          nameLower.includes(syn.toLowerCase()) ||
          syn.toLowerCase().includes(nameLower)
      )
    })
  }, [debouncedQuery, inStockNames])

  if (!stockItems) return null

  return (
    <div>
      <h2 className="mb-4 text-xl font-extrabold">在庫管理</h2>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="食材を検索..."
          className="w-full rounded-xl bg-bg-card py-3 pl-10 pr-4 text-base text-text-primary placeholder:text-text-secondary outline-none ring-1 ring-white/10"
        />
      </div>

      {/* In-stock section */}
      {inStockItems.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-bold text-text-secondary">在庫あり ({inStockItems.length})</h3>
          <div className="space-y-2">
            {inStockItems.map((item) => (
              <StockRow
                key={item.name}
                name={item.name}
                unit={item.defaultUnit}
                quantity={item.quantity}
                onUpdateQuantity={(q) => handleUpdateQuantity(item.name, item.defaultUnit, q)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search results section */}
      {searchResults.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-text-secondary">検索結果 ({searchResults.length})</h3>
          <div className="space-y-2">
            {searchResults.map((ing) => (
              <StockRow
                key={ing.name}
                name={ing.name}
                unit={ing.defaultUnit}
                quantity={0}
                onUpdateQuantity={(q) => handleUpdateQuantity(ing.name, ing.defaultUnit, q)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {inStockItems.length === 0 && !debouncedQuery.trim() && (
        <p className="py-12 text-center text-sm text-text-secondary">
          食材を検索して在庫を登録しましょう
        </p>
      )}

      {/* No search results */}
      {debouncedQuery.trim() && searchResults.length === 0 && inStockItems.length === 0 && (
        <p className="py-8 text-center text-sm text-text-secondary">
          「{debouncedQuery}」に一致する食材が見つかりません
        </p>
      )}
    </div>
  )
}
