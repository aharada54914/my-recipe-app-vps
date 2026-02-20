import { useState, useEffect } from 'react'
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
import { useAuth } from '../hooks/useAuth'

const seasonalIngredients = getCurrentSeasonalIngredients()

function findSeasonalRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.filter((r) =>
    !isHelsioDeli(r) &&
    r.ingredients.some((ing) =>
      seasonalIngredients.some((s) => ing.name.includes(s))
    )
  ).slice(0, 6)
}

/** 2-column tile grid section with a "more" link */
function TwoColRecipeSection({
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

      <div className="grid grid-cols-2 gap-3">
        {recipes.map((recipe) => {
          const mr = matchRates?.get(recipe.id!) ?? calculateMatchRate(recipe.ingredients, stockNames)
          return (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              variant="grid"
              matchRate={mr}
              onClick={() => onSelect(recipe.id!)}
            />
          )
        })}
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { user, signInWithGoogle, loading: authLoading } = useAuth()
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

  // Only show recommendations when stock exists
  const displayRecs = data.hasStock ? recommendations : []
  const recMatchRates = new Map(displayRecs.map(r => [r.recipe.id!, r.matchRate]))

  // Show login banner when not logged in
  const showLoginBanner = !authLoading && !user

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

      {/* Login banner — non-intrusive, only when not logged in */}
      {showLoginBanner && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-border bg-bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Google Driveにバックアップ</p>
            <p className="text-xs text-text-secondary">在庫・お気に入り・献立を自動保存</p>
          </div>
          <button
            onClick={signInWithGoogle}
            className="min-h-[44px] rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95"
          >
            ログイン
          </button>
        </div>
      )}

      {/* Category grid */}
      <div className="mb-6">
        <CategoryGrid />
      </div>

      {/* Weekly menu compact timeline */}
      <div className="mb-6">
        <WeeklyMenuTimeline compact />
      </div>

      {/* Stock-based recommendations — 2-column grid */}
      {displayRecs.length > 0 && (
        <TwoColRecipeSection
          icon={<Sparkles className="h-5 w-5 text-accent" />}
          title="在庫でつくれるレシピ"
          recipes={displayRecs.map(r => r.recipe)}
          stockNames={stockNames}
          matchRates={recMatchRates}
          onSelect={(id) => navigate(`/recipe/${id}`)}
        />
      )}

      {/* Seasonal recipes — 2-column grid */}
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
          <TwoColRecipeSection
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
