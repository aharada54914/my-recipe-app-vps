import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Search, Leaf, Sparkles, ChevronRight, Package } from 'lucide-react'
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
  const { user, signInWithGoogle, loading: authLoading, isOAuthAvailable } = useAuth()
  const [recommendations, setRecommendations] = useState<{ recipe: Recipe; matchRate: number }[]>([])

  const data = useLiveQuery(async () => {
    const [recipes, stockItems] = await Promise.all([
      db.recipes.toArray(),
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
  const showLoginBanner = isOAuthAvailable && !authLoading && !user

  return (
    <div>
      {/* Search bar — navigates to /search on tap */}
      <button
        onClick={() => navigate('/search')}
        className="mt-4 mb-5 flex min-h-[48px] w-full items-center gap-3 rounded-2xl bg-bg-card px-4 py-3 ring-1 ring-white/10"
      >
        <Search className="h-5 w-5 text-text-secondary" />
        <span className="text-base text-text-secondary">レシピを検索...</span>
      </button>

      {/* Quick actions */}
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => navigate('/stock')}
          className="ui-btn ui-btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors hover:text-accent active:scale-95"
        >
          <Package className="h-4 w-4" />
          在庫管理
        </button>
      </div>

      {/* Login banner — non-intrusive, only when not logged in */}
      {showLoginBanner && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-border bg-bg-card px-4 py-3">
          <div>
            <p className="text-base font-semibold">Google Driveにバックアップ</p>
            <p className="text-sm text-text-secondary">在庫・お気に入り・メモ・履歴・献立を自動保存</p>
          </div>
          <button
            onClick={signInWithGoogle}
            className="ui-btn ui-btn-primary min-h-[44px] px-4 py-2 text-sm transition-transform active:scale-95"
          >
            ログイン
          </button>
        </div>
      )}

      {!isOAuthAvailable && (
        <div className="mb-5 rounded-2xl border border-border bg-bg-card px-4 py-3">
          <p className="text-sm font-medium">Googleログインは現在未設定です</p>
          <p className="mt-1 text-xs text-text-secondary">
            バックアップ連携を使うには `VITE_GOOGLE_CLIENT_ID` の設定が必要です。
          </p>
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
