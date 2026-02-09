import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { db } from '../db/db'
import type { DeviceType } from '../db/db'
import { adjustIngredients, formatQuantityVibe } from '../utils/recipeUtils'
import { ServingAdjuster } from './ServingAdjuster'
import { SaltCalculator } from './SaltCalculator'
import { ScheduleGantt } from './ScheduleGantt'

const deviceLabels: Record<DeviceType, string> = {
  hotcook: 'ホットクック',
  healsio: 'ヘルシオ',
  manual: '手動調理',
}

interface RecipeDetailProps {
  recipeId: number
  onBack: () => void
}

export function RecipeDetail({ recipeId, onBack }: RecipeDetailProps) {
  const recipe = useLiveQuery(() => db.recipes.get(recipeId), [recipeId])
  const [servings, setServings] = useState<number | null>(null)

  if (!recipe) return null

  const currentServings = servings ?? recipe.baseServings
  const adjusted = adjustIngredients(recipe.ingredients, recipe.baseServings, currentServings)
  const mainIngredients = adjusted.filter((i) => i.category === 'main')
  const subIngredients = adjusted.filter((i) => i.category === 'sub')

  return (
    <div className="min-h-dvh bg-bg-primary">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button
          onClick={onBack}
          className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{recipe.title}</h1>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="rounded-lg bg-accent/20 px-2 py-0.5 font-medium text-accent">
              {deviceLabels[recipe.device]}
            </span>
            <span>No.{recipe.recipeNumber}</span>
            <span>{recipe.totalTimeMinutes}分</span>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 pb-8">
        {/* Servings */}
        <div className="flex justify-center">
          <ServingAdjuster
            servings={currentServings}
            onChange={setServings}
          />
        </div>

        {/* Ingredients */}
        <div className="rounded-2xl bg-bg-card p-4">
          <h4 className="mb-3 text-sm font-bold text-text-secondary">材料</h4>

          {mainIngredients.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-accent">主材料</div>
              <ul className="space-y-1.5">
                {mainIngredients.map((ing) => (
                  <li key={ing.name} className="flex justify-between text-sm">
                    <span>{ing.name}{ing.optional ? ' (任意)' : ''}</span>
                    <span className="font-medium text-text-secondary">
                      {formatQuantityVibe(ing.quantity, ing.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {subIngredients.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-text-secondary">調味料・その他</div>
              <ul className="space-y-1.5">
                {subIngredients.map((ing) => (
                  <li key={ing.name} className="flex justify-between text-sm">
                    <span>{ing.name}{ing.optional ? ' (任意)' : ''}</span>
                    <span className="font-medium text-text-secondary">
                      {formatQuantityVibe(ing.quantity, ing.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Salt Calculator */}
        <SaltCalculator totalWeightG={recipe.totalWeightG} />

        {/* Schedule */}
        <ScheduleGantt steps={recipe.steps} />
      </main>
    </div>
  )
}
