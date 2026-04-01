import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { useSearchInputController } from '../hooks/useSearchInputController'
import { expandSynonyms } from '../data/synonyms'
import { STOCK_MASTER } from '../data/stockMaster'
import { SEASONING_MASTER, SEASONING_PRESETS } from '../data/seasoningPresets'
import {
  deleteStockItem,
  getAllStockItems,
  updateStockItemMetadata,
  upsertStockBatch,
  upsertStockItem,
} from '../repositories/stockRepository'

const RECENT_STOCK_KEY = 'recent_stock_items_v1'

const INGREDIENT_INDEX = Array.from(
  new Map(
    [...STOCK_MASTER, ...SEASONING_MASTER].map((item) => [item.name, { name: item.name, defaultUnit: item.unit }])
  ).values()
)
  .map((item) => ({ name: item.name, defaultUnit: item.defaultUnit }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

function loadRecentStockNames(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STOCK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 8)
      : []
  } catch {
    return []
  }
}

function persistRecentStockNames(names: string[]): void {
  localStorage.setItem(RECENT_STOCK_KEY, JSON.stringify(names.slice(0, 8)))
}

function formatQuantity(quantity?: number): string {
  return typeof quantity === 'number' && quantity > 0 ? String(quantity) : ''
}

function formatDateInput(value?: Date): string {
  return value ? value.toISOString().slice(0, 10) : ''
}

function StockRow({
  name,
  unit,
  quantity,
  purchasedAt,
  expiresAt,
  onCommitQuantity,
  onUpdateDates,
  onStep,
  onDelete,
}: {
  name: string
  unit: string
  quantity: number
  purchasedAt?: Date
  expiresAt?: Date
  onCommitQuantity: (quantity: number) => void
  onUpdateDates: (patch: { purchasedAt?: Date; expiresAt?: Date }) => void
  onStep: (delta: number) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(formatQuantity(quantity))
  const [isEditing, setIsEditing] = useState(false)
  const [purchasedAtDraft, setPurchasedAtDraft] = useState(formatDateInput(purchasedAt))
  const [expiresAtDraft, setExpiresAtDraft] = useState(formatDateInput(expiresAt))
  const inputValue = isEditing ? draft : formatQuantity(quantity)

  const commit = () => {
    const normalized = draft.trim()
    if (!normalized) {
      setDraft(formatQuantity(quantity))
      return
    }

    const parsed = Number(normalized)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraft(formatQuantity(quantity))
      return
    }

    onCommitQuantity(Math.round(parsed))
  }

  return (
    <div
      className="ui-panel-muted px-3 py-3"
      data-testid="stock-row"
      data-stock-name={name}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
          <p className="mt-1 text-xs text-text-secondary">{unit}単位で管理</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={quantity <= 1}
            className="ui-btn ui-btn-secondary flex min-w-[44px] items-center justify-center px-0 disabled:opacity-35"
            aria-label={`${name}を1減らす`}
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-border-soft bg-bg-primary/40 px-2 py-1">
            <input
              type="text"
              inputMode="numeric"
              value={inputValue}
              onChange={(e) => {
                const next = e.target.value
                if (next === '' || /^\d+$/.test(next)) {
                  setDraft(next)
                }
              }}
              onFocus={() => {
                setDraft(formatQuantity(quantity))
                setIsEditing(true)
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
              placeholder="1"
              className="w-14 bg-transparent text-center text-base font-bold text-text-primary outline-none"
            />
            <span className="w-8 text-xs text-text-secondary">{unit}</span>
          </div>

          <button
            type="button"
            onClick={() => onStep(1)}
            className="ui-btn ui-btn-primary flex min-w-[44px] items-center justify-center px-0"
            aria-label={`${name}を1増やす`}
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="ui-btn flex min-w-[44px] items-center justify-center bg-[color:color-mix(in_srgb,var(--accent-error)_14%,transparent)] px-0 text-error"
            aria-label={`${name}を削除`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-text-secondary">
          購入日
          <input
            type="date"
            value={purchasedAtDraft}
            onChange={(e) => setPurchasedAtDraft(e.target.value)}
            onBlur={() => onUpdateDates({
              purchasedAt: purchasedAtDraft ? new Date(`${purchasedAtDraft}T00:00:00`) : undefined,
              expiresAt: expiresAtDraft ? new Date(`${expiresAtDraft}T00:00:00`) : undefined,
            })}
            className="ui-input mt-1 rounded-xl py-2 text-sm"
          />
        </label>
        <label className="text-xs text-text-secondary">
          賞味期限
          <input
            type="date"
            value={expiresAtDraft}
            onChange={(e) => setExpiresAtDraft(e.target.value)}
            onBlur={() => onUpdateDates({
              purchasedAt: purchasedAtDraft ? new Date(`${purchasedAtDraft}T00:00:00`) : undefined,
              expiresAt: expiresAtDraft ? new Date(`${expiresAtDraft}T00:00:00`) : undefined,
            })}
            className="ui-input mt-1 rounded-xl py-2 text-sm"
          />
        </label>
      </div>
    </div>
  )
}

function CandidateRow({
  name,
  unit,
  onCommitQuantity,
}: {
  name: string
  unit: string
  onCommitQuantity: (quantity: number) => void
}) {
  const [draft, setDraft] = useState('1')

  const commit = () => {
    const parsed = Number(draft.trim())
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraft('1')
      return
    }
    onCommitQuantity(Math.round(parsed))
  }

  return (
    <div
      className="ui-panel-muted flex items-center gap-3 px-3 py-3"
      data-testid="stock-row"
      data-stock-name={name}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
        <p className="mt-1 text-xs text-text-secondary">{unit}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border-soft bg-bg-primary/40 px-2 py-1">
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d+$/.test(next)) {
                setDraft(next)
              }
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
            className="w-12 bg-transparent text-center text-base font-bold text-text-primary outline-none"
          />
          <span className="w-8 text-xs text-text-secondary">{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => onCommitQuantity(1)}
          className="ui-btn ui-btn-secondary flex min-w-[44px] items-center justify-center px-3"
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => onCommitQuantity(3)}
          className="ui-btn ui-btn-primary flex min-w-[44px] items-center justify-center px-3"
        >
          +3
        </button>
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
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="ui-panel">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          {description && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>}
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
  const [recentStockNames, setRecentStockNames] = useState<string[]>(() => loadRecentStockNames())
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

  const stockItems = useLiveQuery(() => getAllStockItems(), [])

  const rememberRecent = (name: string) => {
    setRecentStockNames((prev) => {
      const next = [name, ...prev.filter((entry) => entry !== name)].slice(0, 8)
      persistRecentStockNames(next)
      return next
    })
  }

  const ingredientLookup = useMemo(
    () => new Map(INGREDIENT_INDEX.map((item) => [item.name, item])),
    []
  )

  const stockMap = useMemo(
    () => new Map((stockItems ?? []).map((item) => [item.name, item])),
    [stockItems]
  )

  const handleUpdateQuantity = async (name: string, unit: string, quantity: number) => {
    await upsertStockItem(name, unit, quantity)
    rememberRecent(name)
  }

  const handleQuickAdd = async (name: string, unit: string, quantity: number) => {
    const current = stockMap.get(name)?.quantity ?? 0
    const nextQuantity = current > 0 ? current + quantity : quantity
    await upsertStockItem(name, unit, nextQuantity)
    rememberRecent(name)
  }

  const handleRegisterSeasoningPreset = async (items: Array<{ name: string; unit: string }>) => {
    await upsertStockBatch(items.map((item) => ({ ...item, quantity: 1 })))
    setRecentStockNames((prev) => {
      const next = Array.from(new Set([...items.map((item) => item.name), ...prev])).slice(0, 8)
      persistRecentStockNames(next)
      return next
    })
  }

  const handleDelete = async (name: string) => {
    await deleteStockItem(name)
    rememberRecent(name)
  }

  const handleUpdateDates = async (name: string, patch: { purchasedAt?: Date; expiresAt?: Date }) => {
    await updateStockItemMetadata(name, patch)
    rememberRecent(name)
  }

  const inStockItems = useMemo(
    () =>
      INGREDIENT_INDEX.filter((ingredient) => {
        const item = stockMap.get(ingredient.name)
        return !!item && typeof item.quantity === 'number' && item.quantity > 0
      }).map((ingredient) => ({
        ...ingredient,
        quantity: stockMap.get(ingredient.name)?.quantity ?? 0,
        unit: stockMap.get(ingredient.name)?.unit || ingredient.defaultUnit,
        purchasedAt: stockMap.get(ingredient.name)?.purchasedAt,
        expiresAt: stockMap.get(ingredient.name)?.expiresAt,
      })),
    [stockMap]
  )

  const inStockNames = useMemo(() => new Set(inStockItems.map((item) => item.name)), [inStockItems])

  const presetAvailability = useMemo(
    () =>
      SEASONING_PRESETS.map((preset) => ({
        ...preset,
        addableCount: preset.items.filter((item) => !inStockNames.has(item.name)).length,
      })),
    [inStockNames]
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
    [basicSeasoningNames, inStockItems]
  )

  const inStockOtherItems = useMemo(
    () => inStockItems.filter((item) => !basicSeasoningNames.has(item.name)),
    [basicSeasoningNames, inStockItems]
  )

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const synonyms = expandSynonyms(searchQuery.trim())
    return INGREDIENT_INDEX.filter((item) => {
      if (inStockNames.has(item.name)) return false
      const normalizedName = item.name.toLowerCase()
      return synonyms.some((synonym) => {
        const normalizedSynonym = synonym.toLowerCase()
        return normalizedName.includes(normalizedSynonym) || normalizedSynonym.includes(normalizedName)
      })
    }).slice(0, 20)
  }, [inStockNames, searchQuery])

  const recentCandidates = useMemo(
    () =>
      recentStockNames
        .map((name) => {
          const item = ingredientLookup.get(name)
          if (item) return item
          const stockItem = stockMap.get(name)
          return stockItem
            ? { name, defaultUnit: stockItem.unit || '個' }
            : null
        })
        .filter((item): item is { name: string; defaultUnit: string } => !!item)
        .filter((item) => !inStockNames.has(item.name))
        .slice(0, 6),
    [ingredientLookup, inStockNames, recentStockNames, stockMap]
  )

  if (!stockItems) return null

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-extrabold text-text-primary">在庫管理</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
          候補から追加して、+1 / -1 と直接入力で素早く更新できます。
        </p>
      </div>

      <div className="mb-4">
        <CollapsibleCard
          title="調味料をまとめて登録"
          description="初回セットアップ用。定番調味料を在庫あり・数量1で一括登録します。"
        >
          <div className="grid gap-2">
            {presetAvailability.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => void handleRegisterSeasoningPreset(preset.items)}
                className="ui-panel-muted px-3 py-3 text-left transition-colors hover:bg-bg-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-text-primary">{preset.label}</span>
                  <span className="shrink-0 text-[11px] text-text-secondary">
                    追加候補 {preset.addableCount}/{preset.items.length}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{preset.description}</p>
              </button>
            ))}
          </div>
        </CollapsibleCard>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={(e) => handleCompositionEnd(e.currentTarget.value)}
          placeholder="食材・調味料を検索..."
          className="ui-input rounded-2xl py-3 pl-10 pr-4"
        />
      </div>

      {recentCandidates.length > 0 && !searchQuery.trim() && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-secondary">最近使った食材から追加</h3>
            <span className="text-xs text-text-secondary">最大6件</span>
          </div>
          <div className="space-y-2">
            {recentCandidates.map((item) => (
              <CandidateRow
                key={item.name}
                name={item.name}
                unit={item.defaultUnit}
                onCommitQuantity={(quantity) => {
                  void handleQuickAdd(item.name, item.defaultUnit, quantity)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {inStockItems.length > 0 && (
        <div className="mb-6 space-y-3" data-testid="stock-inventory">
          <h3 className="text-sm font-bold text-text-secondary">在庫あり ({inStockItems.length})</h3>

          {inStockBasicSeasonings.length > 0 && (
            <CollapsibleCard
              title="基本的な調味料"
              description={`登録済み ${inStockBasicSeasonings.length} 品。必要なときだけ開いて調整できます。`}
              defaultOpen={false}
            >
              <div className="space-y-2">
                {inStockBasicSeasonings.map((item) => (
                  <StockRow
                    key={item.name}
                    name={item.name}
                    unit={item.unit}
                    quantity={item.quantity}
                    purchasedAt={item.purchasedAt}
                    expiresAt={item.expiresAt}
                    onCommitQuantity={(quantity) => {
                      void handleUpdateQuantity(item.name, item.unit, quantity)
                    }}
                    onUpdateDates={(patch) => {
                      void handleUpdateDates(item.name, patch)
                    }}
                    onStep={(delta) => {
                      void handleUpdateQuantity(item.name, item.unit, Math.max(1, item.quantity + delta))
                    }}
                    onDelete={() => {
                      void handleDelete(item.name)
                    }}
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
                  unit={item.unit}
                  quantity={item.quantity}
                  purchasedAt={item.purchasedAt}
                  expiresAt={item.expiresAt}
                  onCommitQuantity={(quantity) => {
                    void handleUpdateQuantity(item.name, item.unit, quantity)
                  }}
                  onUpdateDates={(patch) => {
                    void handleUpdateDates(item.name, patch)
                  }}
                  onStep={(delta) => {
                    void handleUpdateQuantity(item.name, item.unit, Math.max(1, item.quantity + delta))
                  }}
                  onDelete={() => {
                    void handleDelete(item.name)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {searchResults.length > 0 && (
        <div data-testid="stock-search-results">
          <h3 className="mb-2 text-sm font-bold text-text-secondary">候補から追加 ({searchResults.length})</h3>
          <div className="space-y-2">
            {searchResults.map((item) => (
              <CandidateRow
                key={item.name}
                name={item.name}
                unit={item.defaultUnit}
                onCommitQuantity={(quantity) => {
                  void handleQuickAdd(item.name, item.defaultUnit, quantity)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {inStockItems.length === 0 && recentCandidates.length === 0 && !searchQuery.trim() && (
        <p className="py-12 text-center text-sm leading-relaxed text-text-secondary">
          まずは検索から食材を追加するか、調味料セットを登録してください。
        </p>
      )}

      {searchQuery.trim() && searchResults.length === 0 && (
        <p className="py-8 text-center text-sm leading-relaxed text-text-secondary">
          「{searchQuery}」に一致する候補が見つかりません。別の表記でも試してください。
        </p>
      )}
    </div>
  )
}
