import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { RecipeCard } from '../components/RecipeCard'
import { getFavoriteRecipeIds } from '../utils/favoritesUtils'
import { calculateMatchRate } from '../utils/recipeUtils'
import { Star } from 'lucide-react'

export function FavoritesPage() {
    const navigate = useNavigate()

    const data = useLiveQuery(async () => {
        const [favoriteIds, stockItems] = await Promise.all([
            getFavoriteRecipeIds(),
            db.stock.where('inStock').equals(1).toArray(),
        ])
        if (favoriteIds.length === 0) return { recipes: [], stockNames: new Set<string>() }

        const recipes = await db.recipes.where('id').anyOf(favoriteIds).toArray()
        const stockNames = new Set(stockItems.map((s) => s.name))
        return { recipes, stockNames }
    })

    if (!data) return null

    const { recipes, stockNames } = data

    return (
        <div>
            <div className="mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-bold">お気に入り</h2>
                <span className="text-sm text-text-secondary">({recipes.length}件)</span>
            </div>

            {recipes.length === 0 ? (
                <p className="py-12 text-center text-sm text-text-secondary">
                    お気に入りに登録されたレシピはありません
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
