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
  variant?: 'list' | 'grid' | 'menu'
}

// T-08: React.memo to prevent unnecessary re-renders
export const RecipeCard = memo(function RecipeCard({
  recipe,
  matchRate,
  onClick,
  variant = 'list',
}: RecipeCardProps) {
  // Compact tile for weekly menu 2-column layout
  if (variant === 'menu') {
    return (
      <button
        onClick={onClick}
        className="min-h-[176px] w-full overflow-hidden rounded-xl bg-bg-card text-left transition-colors active:scale-[0.97] hover:bg-bg-card-hover"
      >
        <RecipeImage
          recipe={recipe}
          placeholderHeight="h-20"
          className="w-full rounded-none rounded-t-xl"
        />
        <div className="p-2">
          <span className="mb-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium text-accent" style={{ backgroundColor: 'rgba(249,115,22,0.15)' }}>
            {deviceLabels[recipe.device]}
          </span>
          <h3 className="mb-1.5 line-clamp-2 text-[13px] font-bold leading-snug">
            {recipe.title}
          </h3>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-text-secondary">
              <Clock className="h-3 w-3" />
              {recipe.totalTimeMinutes}分
            </span>
            {matchRate !== undefined && (
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${matchRate >= 80
                    ? 'bg-green-500/20 text-green-400'
                    : matchRate >= 50
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-white/5 text-text-secondary'
                  }`}
              >
                {matchRate}%
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  if (variant === 'grid') {
    return (
      <button
        onClick={onClick}
        className="recipe-card-grid min-h-[220px] w-full overflow-hidden rounded-2xl bg-bg-card text-left transition-colors active:scale-[0.97] hover:bg-bg-card-hover"
      >
        {/* Image */}
        <RecipeImage
          recipe={recipe}
          placeholderHeight="h-28"
          className="w-full rounded-none rounded-t-2xl"
        />
        {/* Content */}
        <div className="p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="inline-block rounded-md bg-accent/20 px-2 py-0.5 text-[11px] font-medium text-accent">
              {deviceLabels[recipe.device]}
            </span>
          </div>
          <h3 className="mb-2 line-clamp-2 text-sm font-bold leading-snug">
            {recipe.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {recipe.totalTimeMinutes}分
            </span>
            {matchRate !== undefined && (
              <span
                className={`ml-auto rounded px-2 py-0.5 text-[11px] font-bold ${matchRate >= 80
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
      </button>
    )
  }

  // Default: list variant
  return (
    <button
      onClick={onClick}
      className="recipe-card flex min-h-[88px] w-full items-center gap-3 rounded-2xl bg-bg-card p-3 text-left transition-colors hover:bg-bg-card-hover"
    >
      {/* Text content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block rounded-md bg-accent/20 px-2 py-0.5 text-[11px] font-medium text-accent">
            {deviceLabels[recipe.device]}
          </span>
          <span className="text-[11px] text-text-secondary">
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
              className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold ${matchRate >= 80
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
