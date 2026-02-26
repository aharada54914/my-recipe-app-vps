import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { db } from '../db/db'
import { useDebounce } from '../hooks/useDebounce'
import { expandSynonyms } from '../data/synonyms'
import { STOCK_MASTER } from '../data/stockMaster'
import { SEASONING_MASTER, SEASONING_PRESETS } from '../data/seasoningPresets'

// Build the ingredient list from STOCK_MASTER, sorted 50音順
const INGREDIENT_INDEX = Array.from(
  new Map(
    [...STOCK_MASTER, ...SEASONING_MASTER].map((item) => [item.name, { name: item.name, defaultUnit: item.unit }])
  ).values()
)
  .map((item) => ({ name: item.name, defaultUnit: item.defaultUnit }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

function StockRow({
  name,
  unit,
  quantity,
  onCommitQuantity,
}: {
  name: string
  unit: string
  quantity?: number
  onCommitQuantity: (quantity: number) => void
}) {
  const [draft, setDraft] = useState(() => (typeof quantity === 'number' && quantity > 0 ? String(quantity) : ''))
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (isEditing) return
    setDraft(typeof quantity === 'number' && quantity > 0 ? String(quantity) : '')
  }, [quantity, isEditing])

  const commit = () => {
    const normalized = draft.trim()
    if (!normalized) {
      onCommitQuantity(0)
      return
    }

    const parsed = Number(normalized)
    onCommitQuantity(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0)
  }

  return (
    <div className="flex min-h-[52px] items-center gap-2 rounded-xl bg-bg-card px-4 py-3 ring-1 ring-white/10">
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
        {name}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          if (next === '' || /^\d*\.?\d*$/.test(next)) {
            setDraft(next)
          }
        }}
        onFocus={() => setIsEditing(true)}
        onBlur={() => {
          setIsEditing(false)
          commit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
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

  const handleRegisterSeasoningPreset = async (items: Array<{ name: string; unit: string }>) => {
    const uniqueItems = Array.from(new Map(items.map((item) => [item.name, item])).values())

    await db.transaction('rw', db.stock, async () => {
      for (const item of uniqueItems) {
        const existing = await db.stock.where('name').equals(item.name).first()
        if (existing) {
          const currentQty = typeof existing.quantity === 'number' ? existing.quantity : 0
          await db.stock.update(existing.id!, {
            unit: existing.unit || item.unit,
            quantity: currentQty > 0 ? currentQty : 1,
            inStock: true,
          })
        } else {
          await db.stock.add({
            name: item.name,
            unit: item.unit,
            quantity: 1,
            inStock: true,
          })
        }
      }
    })
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

  const presetAvailability = useMemo(
    () =>
      SEASONING_PRESETS.map((preset) => ({
        ...preset,
        addableCount: preset.items.filter((item) => {
          const existing = stockMap.get(item.name)
          return !existing || !existing.quantity || existing.quantity <= 0
        }).length,
      })),
    [stockMap]
  )

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

      <div className="mb-6 rounded-2xl bg-bg-card p-4 ring-1 ring-white/10">
        <h3 className="text-sm font-bold text-text-primary">調味料をまとめて登録</h3>
        <p className="mt-1 text-xs text-text-secondary">
          日本の家庭で使う定番調味料を、在庫あり・数量1（本/袋/個）で一括登録できます。
        </p>
        <div className="mt-3 grid gap-2">
          {presetAvailability.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleRegisterSeasoningPreset(preset.items)}
              className="rounded-xl bg-white/5 px-3 py-3 text-left ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-text-primary">{preset.label}</span>
                <span className="shrink-0 text-[11px] text-text-secondary">
                  追加候補 {preset.addableCount}/{preset.items.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="食材・調味料を検索..."
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
                onCommitQuantity={(q) => handleUpdateQuantity(item.name, item.defaultUnit, q)}
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
                onCommitQuantity={(q) => handleUpdateQuantity(ing.name, ing.defaultUnit, q)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {inStockItems.length === 0 && !debouncedQuery.trim() && (
        <p className="py-12 text-center text-sm text-text-secondary">
          食材や調味料を検索して在庫を登録しましょう
        </p>
      )}

      {/* No search results */}
      {debouncedQuery.trim() && searchResults.length === 0 && inStockItems.length === 0 && (
        <p className="py-8 text-center text-sm text-text-secondary">
          「{debouncedQuery}」に一致する食材・調味料が見つかりません
        </p>
      )}
    </div>
  )
}
