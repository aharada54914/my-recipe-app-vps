import { memo } from 'react'
import { Clock } from 'lucide-react'
import type { Recipe, DeviceType } from '../db/db'

const deviceLabels: Record<DeviceType, string> = {
  hotcook: 'ホットクック',
  healsio: 'ヘルシオ',
  manual: '手動調理',
}

interface RecipeCardProps {
  recipe: Recipe
  matchRate?: number
  onClick: () => void
}

// T-08: React.memo to prevent unnecessary re-renders
export const RecipeCard = memo(function RecipeCard({
  recipe,
  matchRate,
  onClick,
}: RecipeCardProps) {
  return (
    <button
      onClick={onClick}
      className="recipe-card w-full rounded-2xl bg-bg-card p-4 text-left transition-colors hover:bg-bg-card-hover"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="mb-1 inline-block rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
            {deviceLabels[recipe.device]}
          </span>
          <h3 className="mt-1 text-base font-bold">{recipe.title}</h3>
        </div>
        <span className="rounded-xl bg-accent px-2 py-1 text-xs font-bold text-white">
          No.{recipe.recipeNumber}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-text-secondary">
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {recipe.totalTimeMinutes}分
        </span>
        <span>{recipe.baseServings}人分</span>
        {matchRate !== undefined && (
          <span
            className={`ml-auto rounded-lg px-2 py-0.5 text-xs font-bold ${matchRate >= 80
                ? 'bg-green-500/20 text-green-400'
                : matchRate >= 50
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-bg-card text-text-secondary'
              }`}
          >
            在庫 {matchRate}%
          </span>
        )}
      </div>
    </button>
  )
})
