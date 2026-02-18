import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Search, Leaf, Sparkles, ChevronRight } from 'lucide-react'
import { db } from '../db/db'
import type { Recipe } from '../db/db'
import { RecipeCard } from '../components/RecipeCard'
import { calculateMatchRate, isHelsioDeli } from '../utils/recipeUtils'
import { getCurrentSeasonalIngredients } from '../data/seasonalIngredients'
import { getLocalRecommendations } from '../utils/geminiRecommender'
import { WeeklyMenuTimeline } from '../components/WeeklyMenuTimeline'
import { CategoryGrid } from '../components/CategoryGrid'

const seasonalIngredients = getCurrentSeasonalIngredients()

function findSeasonalRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.filter((r) =>
    !isHelsioDeli(r) &&
    r.ingredients.some((ing) =>
      seasonalIngredients.some((s) => ing.name.includes(s))
    )
  ).slice(0, 10)
}

/** Horizontal scroll section with a "more" link */
function HorizontalRecipeSection({
  icon,
  title,
  recipes,
  stockNames,
  matchRates,
  onMore,
  onSelect,
}: {
  icon: React.ReactNode
  title: string
  recipes: Recipe[]
  stockNames: Set<string>
  matchRates?: Map<number, number>
  onMore?: () => void
  onSelect: (id: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base font-bold">{title}</h3>
        </div>
        {onMore && (
          <button
            onClick={onMore}
            className="flex items-center gap-0.5 text-xs text-text-secondary hover:text-accent"
          >
            もっと見る
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
      >
        {recipes.map((recipe) => {
          const mr = matchRates?.get(recipe.id!) ?? calculateMatchRate(recipe.ingredients, stockNames)
          return (
            <div key={recipe.id} className="w-[260px] flex-shrink-0">
              <RecipeCard
                recipe={recipe}
                matchRate={mr}
                onClick={() => onSelect(recipe.id!)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [recommendations, setRecommendations] = useState<{ recipe: Recipe; matchRate: number }[]>([])

  const data = useLiveQuery(async () => {
    const [recipes, stockItems] = await Promise.all([
      db.recipes.limit(200).toArray(),
      db.stock.filter(item => item.inStock).toArray(),
    ])
    const stockNames = new Set(stockItems.map((s) => s.name))
    const seasonal = findSeasonalRecipes(recipes)
    const hasStock = stockItems.length > 0
    return { seasonal, stockNames, hasStock }
  })

  // Load recommendations when stock data is available
  useEffect(() => {
    if (!data?.hasStock) return
    let cancelled = false
    getLocalRecommendations(6).then(recs => {
      if (!cancelled) setRecommendations(recs)
    })
    return () => { cancelled = true }
  }, [data?.hasStock])

  if (!data) return null

  const { seasonal, stockNames } = data

  // Only show recommendations when stock exists; avoids synchronous setState in effect
  const displayRecs = data.hasStock ? recommendations : []
  const recMatchRates = new Map(displayRecs.map(r => [r.recipe.id!, r.matchRate]))

  return (
    <div>
      {/* Search bar — navigates to /search on tap */}
      <button
        onClick={() => navigate('/search')}
        className="mt-4 mb-5 flex w-full items-center gap-3 rounded-2xl bg-bg-card px-4 py-3"
      >
        <Search className="h-5 w-5 text-text-secondary" />
        <span className="text-sm text-text-secondary">レシピを検索...</span>
      </button>

      {/* Category grid */}
      <div className="mb-6">
        <CategoryGrid />
      </div>

      {/* Weekly menu compact timeline */}
      <div className="mb-6">
        <WeeklyMenuTimeline compact />
      </div>

      {/* Stock-based recommendations — horizontal scroll */}
      {displayRecs.length > 0 && (
        <HorizontalRecipeSection
          icon={<Sparkles className="h-5 w-5 text-accent" />}
          title="在庫でつくれるレシピ"
          recipes={displayRecs.map(r => r.recipe)}
          stockNames={stockNames}
          matchRates={recMatchRates}
          onSelect={(id) => navigate(`/recipe/${id}`)}
        />
      )}

      {/* Seasonal recipes — horizontal scroll */}
      {seasonal.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {seasonalIngredients.map((name) => (
              <span
                key={name}
                className="rounded-lg bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400"
              >
                {name}
              </span>
            ))}
          </div>
          <HorizontalRecipeSection
            icon={<Leaf className="h-5 w-5 text-green-400" />}
            title="旬のおすすめ"
            recipes={seasonal}
            stockNames={stockNames}
            onMore={() => navigate('/search?filter=seasonal')}
            onSelect={(id) => navigate(`/recipe/${id}`)}
          />
        </>
      )}
    </div>
  )
}
