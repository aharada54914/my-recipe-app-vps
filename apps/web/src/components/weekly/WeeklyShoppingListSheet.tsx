import { X } from 'lucide-react'
import { EditableShoppingList, type ShoppingIngredient } from '../EditableShoppingList'
import { BottomSheetPortal } from '../ui/BottomSheetPortal'

interface WeeklyShoppingListSheetProps {
  weekLabel: string
  missingCount: number
  ingredients: ShoppingIngredient[]
  storageKey: string
  includeSeasonings: boolean
  onToggleIncludeSeasonings: () => void
  onClose: () => void
}

export function WeeklyShoppingListSheet({
  weekLabel,
  missingCount,
  ingredients,
  storageKey,
  includeSeasonings,
  onToggleIncludeSeasonings,
  onClose,
}: WeeklyShoppingListSheetProps) {
  return (
    <BottomSheetPortal
      onClose={onClose}
      testId="weekly-shopping-list-panel"
      panelStyle={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="ui-section-kicker">Shopping</p>
          <h4 className="mt-1 text-lg font-extrabold text-text-primary">買い物リスト</h4>
          <p className="mt-1 text-sm text-text-secondary">不足材料 {missingCount}件</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-border-soft bg-bg-card-hover p-2 text-text-secondary transition-colors hover:text-text-primary"
          aria-label="買い物リストを閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <EditableShoppingList
        weekLabel={weekLabel}
        ingredients={ingredients}
        storageKey={storageKey}
        includeSeasonings={includeSeasonings}
        onToggleIncludeSeasonings={onToggleIncludeSeasonings}
      />
    </BottomSheetPortal>
  )
}
