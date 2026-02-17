import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import { db } from '../db/db'
import type { Recipe } from '../db/db'
import { RecipeCard } from '../components/RecipeCard'
import { calculateMatchRate, isHelsioDeli } from '../utils/recipeUtils'
import { getCurrentSeasonalIngredients } from '../data/seasonalIngredients'

const seasonalIngredients = getCurrentSeasonalIngredients()

function findSeasonalRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.filter((r) =>
    !isHelsioDeli(r) &&
    r.ingredients.some((ing) =>
      seasonalIngredients.some((s) => ing.name.includes(s))
    )
  ).slice(0, 10)
}

export function HomePage() {
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const [recipes, stockItems] = await Promise.all([
      db.recipes.limit(200).toArray(),
      db.stock.filter(item => item.inStock).toArray(),
    ])
    const stockNames = new Set(stockItems.map((s) => s.name))
    const seasonal = findSeasonalRecipes(recipes)
    return { seasonal, stockNames }
  })

  if (!data) return null

  const { seasonal, stockNames } = data

  return (
    <div>
      <div className="py-6 text-center">
        <h2 className="text-lg font-bold text-text-primary mb-2">ようこそ</h2>
        <p className="text-sm text-text-secondary">
          下のタブで検索・在庫管理・お気に入りをご利用ください
        </p>
      </div>

      {seasonal.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-400" />
            <h3 className="text-base font-bold">旬のおすすめ</h3>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {seasonalIngredients.map((name) => (
              <span
                key={name}
                className="rounded-lg bg-green-500/20 px-2 py-1 text-xs font-medium text-green-400"
              >
                {name}
              </span>
            ))}
          </div>

          <div className="grid gap-4">
            {seasonal.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
                onClick={() => navigate(`/recipe/${recipe.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
