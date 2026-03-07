import { useState, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Search, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { useSearchInputController } from '../hooks/useSearchInputController'
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
  onDelete,
  allowZeroCommit = true,
}: {
  name: string
  unit: string
  quantity?: number
  onCommitQuantity: (quantity: number) => void
  onDelete?: () => void
  allowZeroCommit?: boolean
}) {
  const currentQuantityText = typeof quantity === 'number' && quantity > 0 ? String(quantity) : ''
  const [draft, setDraft] = useState(currentQuantityText)
  const [isEditing, setIsEditing] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const dragStartX = useRef(0)
  const isDragging = useRef(false)
  const deleteWidth = 84
  const inputValue = isEditing ? draft : currentQuantityText

  const commit = () => {
    const normalized = draft.trim()
    if (!normalized) {
      if (allowZeroCommit) {
        onCommitQuantity(0)
      } else {
        setDraft(currentQuantityText)
      }
      return
    }

    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) {
      setDraft(currentQuantityText)
      return
    }
    if (!allowZeroCommit && parsed <= 0) {
      setDraft(currentQuantityText)
      return
    }
    onCommitQuantity(parsed >= 0 ? parsed : 0)
  }

  const clampOffset = (value: number) => Math.max(-deleteWidth, Math.min(0, value))

  const handleDragStart = (clientX: number) => {
    if (!onDelete) return
    isDragging.current = true
    dragStartX.current = clientX - offsetX
  }

  const handleDragMove = (clientX: number) => {
    if (!onDelete || !isDragging.current) return
    setOffsetX(clampOffset(clientX - dragStartX.current))
  }

  const handleDragEnd = () => {
    if (!onDelete || !isDragging.current) return
    isDragging.current = false
    setOffsetX((prev) => (prev < -deleteWidth / 2 ? -deleteWidth : 0))
  }

  return (
    <div className="relative overflow-hidden rounded-xl" data-testid="stock-row" data-stock-name={name}>
      {onDelete && (
        <div className="absolute inset-y-0 right-0 flex w-[84px] items-center justify-center rounded-r-xl bg-red-500/80">
          <button
            type="button"
            onClick={onDelete}
            className="flex h-full w-full items-center justify-center gap-1 text-sm font-semibold text-white"
            aria-label={`${name}を削除`}
          >
            <Trash2 className="h-4 w-4" />
            削除
          </button>
        </div>
      )}
      <div
        className="relative z-10 flex min-h-[52px] touch-pan-y items-center gap-2 rounded-xl bg-bg-card px-4 py-3 ring-1 ring-white/10 transition-transform"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onMouseMove={(e) => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
          {name}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => {
            const next = e.target.value
            if (next === '' || /^\d*\.?\d*$/.test(next)) {
              setDraft(next)
            }
          }}
          onFocus={() => {
            setDraft(currentQuantityText)
            setIsEditing(true)
            setOffsetX(0)
          }}
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
    </div>
  )
}

function CollapsibleCard({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl bg-bg-card p-4 ring-1 ring-white/10">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          {description && <p className="mt-1 text-xs text-text-secondary">{description}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function StockManager() {
  const [searchQuery, setSearchQuery] = useState('')
  const {
    draftValue,
    setDraftValue,
    handleCompositionStart,
    handleCompositionEnd,
  } = useSearchInputController({
    value: searchQuery,
    onCommit: setSearchQuery,
    delay: 300,
  })

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

  const handleDeleteStock = async (name: string) => {
    const existing = await db.stock.where('name').equals(name).first()
    if (existing?.id != null) {
      await db.stock.delete(existing.id)
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

  const basicSeasoningPreset = useMemo(
    () => SEASONING_PRESETS.find((preset) => preset.id === 'basic-japanese'),
    []
  )

  const basicSeasoningNames = useMemo(
    () => new Set((basicSeasoningPreset?.items ?? []).map((item) => item.name)),
    [basicSeasoningPreset]
  )

  const inStockBasicSeasonings = useMemo(
    () => inStockItems.filter((item) => basicSeasoningNames.has(item.name)),
    [inStockItems, basicSeasoningNames]
  )

  const inStockOtherItems = useMemo(
    () => inStockItems.filter((item) => !basicSeasoningNames.has(item.name)),
    [inStockItems, basicSeasoningNames]
  )

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const synonyms = expandSynonyms(searchQuery.trim())
    return INGREDIENT_INDEX.filter((ing) => {
      if (inStockNames.has(ing.name)) return false
      const nameLower = ing.name.toLowerCase()
      return synonyms.some(
        (syn) =>
          nameLower.includes(syn.toLowerCase()) ||
          syn.toLowerCase().includes(nameLower)
      )
    })
  }, [searchQuery, inStockNames])

  if (!stockItems) return null

  return (
    <div>
      <h2 className="mb-4 text-xl font-extrabold">在庫管理</h2>

      <div className="mb-4">
        <CollapsibleCard
          title="調味料をまとめて登録"
          description="日本の家庭で使う定番調味料を、在庫あり・数量1（本/袋/個）で一括登録できます。"
        >
          <div className="grid gap-2">
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
        </CollapsibleCard>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
        <input
          type="text"
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={(e) => handleCompositionEnd(e.currentTarget.value)}
          placeholder="食材・調味料を検索..."
          className="w-full rounded-xl bg-bg-card py-3 pl-10 pr-4 text-base text-text-primary placeholder:text-text-secondary outline-none ring-1 ring-white/10"
        />
      </div>

      {/* In-stock section */}
      {inStockItems.length > 0 && (
        <div className="mb-6 space-y-3" data-testid="stock-inventory">
          <h3 className="text-sm font-bold text-text-secondary">在庫あり ({inStockItems.length})</h3>

          {inStockBasicSeasonings.length > 0 && (
            <CollapsibleCard
              title="基本的な調味料"
              description={`在庫登録済み ${inStockBasicSeasonings.length} 品（初期状態は折りたたみ）`}
              defaultOpen={false}
            >
              <div className="space-y-2">
                {inStockBasicSeasonings.map((item) => (
                  <StockRow
                    key={item.name}
                    name={item.name}
                    unit={item.defaultUnit}
                    quantity={item.quantity}
                    onDelete={() => handleDeleteStock(item.name)}
                    allowZeroCommit={false}
                    onCommitQuantity={(q) => handleUpdateQuantity(item.name, item.defaultUnit, q)}
                  />
                ))}
              </div>
            </CollapsibleCard>
          )}

          {inStockOtherItems.length > 0 && (
            <div className="space-y-2">
              {inStockOtherItems.map((item) => (
                <StockRow
                  key={item.name}
                  name={item.name}
                  unit={item.defaultUnit}
                  quantity={item.quantity}
                  onDelete={() => handleDeleteStock(item.name)}
                  allowZeroCommit={false}
                  onCommitQuantity={(q) => handleUpdateQuantity(item.name, item.defaultUnit, q)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search results section */}
      {searchResults.length > 0 && (
        <div data-testid="stock-search-results">
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
      {inStockItems.length === 0 && !searchQuery.trim() && (
        <p className="py-12 text-center text-sm text-text-secondary">
          食材や調味料を検索して在庫を登録しましょう
        </p>
      )}

      {/* No search results */}
      {searchQuery.trim() && searchResults.length === 0 && inStockItems.length === 0 && (
        <p className="py-8 text-center text-sm text-text-secondary">
          「{searchQuery}」に一致する食材・調味料が見つかりません
        </p>
      )}
    </div>
  )
}
