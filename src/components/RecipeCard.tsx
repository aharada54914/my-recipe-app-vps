import { memo } from 'react'
import { Clock } from 'lucide-react'
import type { Recipe, DeviceType } from '../db/db'
import { RecipeImage } from './RecipeImage'

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
      className="recipe-card flex w-full items-center gap-3 rounded-2xl bg-bg-card p-3 text-left transition-colors hover:bg-bg-card-hover"
    >
      {/* Text content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {deviceLabels[recipe.device]}
          </span>
          <span className="text-[10px] text-text-secondary">
            No.{recipe.recipeNumber}
          </span>
        </div>
        <h3 className="mb-1.5 truncate text-sm font-bold">{recipe.title}</h3>
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {recipe.totalTimeMinutes}分
          </span>
          <span>{recipe.baseServings}人分</span>
          {matchRate !== undefined && (
            <span
              className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold ${matchRate >= 80
                  ? 'bg-green-500/20 text-green-400'
                  : matchRate >= 50
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-white/5 text-text-secondary'
                }`}
            >
              在庫 {matchRate}%
            </span>
          )}
        </div>
      </div>

      {/* Thumbnail */}
      {recipe.imageUrl && (
        <div className="h-12 w-12 shrink-0">
          <RecipeImage recipe={recipe} thumbnail placeholderHeight="h-12" className="rounded-lg" />
        </div>
      )}
    </button>
  )
})
