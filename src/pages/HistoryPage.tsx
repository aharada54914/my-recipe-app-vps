import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { db } from '../db/db'
import { RecipeCard } from '../components/RecipeCard'
import { calculateMatchRate } from '../utils/recipeUtils'

export function HistoryPage() {
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const history = await db.viewHistory.orderBy('viewedAt').reverse().toArray()

    // Deduplicate by recipeId, keeping only the most recent entry
    const seen = new Set<number>()
    const uniqueHistory: typeof history = []
    for (const entry of history) {
      if (!seen.has(entry.recipeId)) {
        seen.add(entry.recipeId)
        uniqueHistory.push(entry)
      }
      if (uniqueHistory.length >= 50) break
    }

    const recipeIds = uniqueHistory.map((h) => h.recipeId)
    if (recipeIds.length === 0) return { recipes: [], stockNames: new Set<string>() }

    const [recipes, stockItems] = await Promise.all([
      db.recipes.where('id').anyOf(recipeIds).toArray(),
      db.stock.filter(item => item.inStock).toArray(),
    ])

    // Re-order recipes to match history order
    const recipeMap = new Map(recipes.map((r) => [r.id!, r]))
    const orderedRecipes = recipeIds
      .map((id) => recipeMap.get(id))
      .filter((r) => r != null)

    const stockNames = new Set(stockItems.map((s) => s.name))
    return { recipes: orderedRecipes, stockNames }
  })

  if (!data) return null

  const { recipes, stockNames } = data

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold">閲覧履歴</h2>
        <span className="text-sm text-text-secondary">({recipes.length}件)</span>
      </div>

      {recipes.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-secondary">
          まだレシピを閲覧していません
        </p>
      ) : (
        <div className="grid gap-4">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
              onClick={() => navigate(`/recipe/${recipe.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
