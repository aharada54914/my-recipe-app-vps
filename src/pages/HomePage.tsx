import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Search, Leaf, Sparkles, ChevronRight, Flame, Cloud } from 'lucide-react'
import { db } from '../db/db'
import type { Recipe } from '../db/db'
import { RecipeCard } from '../components/RecipeCard'
import { calculateMatchRate, isHelsioDeli } from '../utils/recipeUtils'
import { getCurrentSeasonalIngredients } from '../data/seasonalIngredients'
import { getLocalRecommendations } from '../utils/geminiRecommender'
import { WeeklyMenuTimeline } from '../components/WeeklyMenuTimeline'
import { CategoryGrid } from '../components/CategoryGrid'
import { getWeeklyWeatherForecast } from '../utils/season-weather/weatherProvider'
import type { DailyWeather } from '../utils/season-weather/weatherProvider'
import {
  computeUnifiedWeatherScore,
} from '../utils/season-weather/weatherScoring'

const seasonalIngredients = getCurrentSeasonalIngredients()

function findSeasonalRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.filter((r) =>
    !isHelsioDeli(r) &&
    r.ingredients.some((ing) =>
      seasonalIngredients.some((s) => ing.name.includes(s))
    )
  ).slice(0, 4)
}

/**
 * Softmaxを用いて上位 k 件を確率的にサンプリングする。
 * temperature が小さいほど決定論的（最高スコアを優先）。
 * 多様性を確保しつつ低品質レシピが頻繁に出ることを防ぐ。
 */
function softmaxSample<T>(
  items: { item: T; score: number }[],
  k: number,
  temperature = 0.4,
): T[] {
  if (items.length <= k) return items.map((i) => i.item)
  const maxScore = Math.max(...items.map((i) => i.score))
  const exp = items.map((i) => ({
    item: i.item,
    p: Math.exp((i.score - maxScore) / temperature),
  }))
  const total = exp.reduce((sum, e) => sum + e.p, 0)
  const pool = exp.map((e) => ({ item: e.item, p: e.p / total }))

  const selected: T[] = []
  for (let drawn = 0; drawn < k && pool.length > 0; drawn++) {
    const r = Math.random()
    let cumProb = 0
    for (let j = 0; j < pool.length; j++) {
      cumProb += pool[j].p
      if (r <= cumProb || j === pool.length - 1) {
        selected.push(pool[j].item)
        pool.splice(j, 1)
        // 残りを再正規化
        const newTotal = pool.reduce((s, e) => s + e.p, 0)
        if (newTotal > 0) pool.forEach((e) => { e.p /= newTotal })
        break
      }
    }
  }
  return selected
}

/** 年通算日を計算 (1-365) */
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000)
}

/**
 * 今日おすすめレシピを選出する（Phase 3: T_opt × Softmax版）
 *
 * スコア構成:
 *   - 天気ベクトルドット積スコア × 0.4  (Phase 2 ベクトルスコア)
 *   - T_opt個人補正天気スコア × 0.35    (Phase 3 個人化)
 *   - 旬食材一致ボーナス × 0.25         (旬フィルタ)
 *
 * 最終選出: Softmax確率的サンプリング（多様性確保）
 */
function findTodayRecipes(
  recipes: Recipe[],
  todayWeather: DailyWeather | null,
  tOpt = 22,
): Recipe[] {
  const candidates = recipes.filter((r) => !isHelsioDeli(r))
  if (!todayWeather) {
    // フォールバック: 旬食材フィルタのみ
    return candidates
      .filter((r) => r.ingredients.some((ing) => seasonalIngredients.some((s) => ing.name.includes(s))))
      .slice(0, 4)
  }

  const today = new Date()
  const dayOfYear = getDayOfYear(today)
  const scored = candidates.map((r) => {
    const unifiedWeatherScore = computeUnifiedWeatherScore(r, todayWeather, tOpt, dayOfYear)
    const seasonalScore = r.ingredients.some((ing) =>
      seasonalIngredients.some((s) => ing.name.includes(s))
    ) ? 1 : 0

    return {
      item: r,
      score: 0.75 * unifiedWeatherScore + 0.25 * seasonalScore,
    }
  })

  // Softmax確率的サンプリング (temperature=0.4: 多様性と品質のバランス)
  return softmaxSample(scored, 4, 0.4)
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
  const [recommendations, setRecommendations] = useState<{ recipe: Recipe; matchRate: number }[]>([])
  const [todayWeather, setTodayWeather] = useState<DailyWeather | null>(null)

  const data = useLiveQuery(async () => {
    const [recipes, stockItems, prefs] = await Promise.all([
      db.recipes.limit(200).toArray(),
      db.stock.filter(item => item.inStock).toArray(),
      db.userPreferences.limit(1).toArray(),
    ])
    const stockNames = new Set(stockItems.map((s) => s.name))
    const seasonal = findSeasonalRecipes(recipes)
    const hasStock = stockItems.length > 0
    const tOpt = prefs[0]?.tOpt ?? 22  // T_opt個人最適気温（デフォルト22°C）
    return { recipes, seasonal, stockNames, hasStock, tOpt }
  })

  // Load recommendations when stock data is available
  useEffect(() => {
    if (!data?.hasStock) return
    let cancelled = false
    getLocalRecommendations(4).then(recs => {
      if (!cancelled) setRecommendations(recs)
    })
    return () => { cancelled = true }
  }, [data?.hasStock])

  // Load today's weather
  useEffect(() => {
    let cancelled = false
    getWeeklyWeatherForecast(new Date()).then(forecast => {
      if (!cancelled && forecast.length > 0) setTodayWeather(forecast[0])
    })
    return () => { cancelled = true }
  }, [])

  const todayFoodRef = useRef<HTMLDivElement>(null)
  const stockSectionRef = useRef<HTMLDivElement>(null)
  const seasonalSectionRef = useRef<HTMLDivElement>(null)

  if (!data) return null

  const { recipes, seasonal, stockNames, tOpt } = data

  const displayRecs = data.hasStock ? recommendations : []
  const recMatchRates = new Map(displayRecs.map(r => [r.recipe.id!, r.matchRate]))

  const todayRecipes = findTodayRecipes(recipes, todayWeather, tOpt)

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
        {todayRecipes.length > 0 && (
          <button
            onClick={() => todayFoodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="ui-btn ui-btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors hover:text-accent active:scale-95"
          >
            <Flame className="h-4 w-4 text-orange-400" />
            今日食べたい料理
          </button>
        )}
        {displayRecs.length > 0 && (
          <button
            onClick={() => stockSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="ui-btn ui-btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors hover:text-accent active:scale-95"
          >
            <Sparkles className="h-4 w-4 text-accent" />
            在庫レシピ
          </button>
        )}
        {seasonal.length > 0 && (
          <button
            onClick={() => seasonalSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="ui-btn ui-btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors hover:text-accent active:scale-95"
          >
            <Leaf className="h-4 w-4 text-green-400" />
            旬のレシピ
          </button>
        )}
      </div>

      {/* Category grid */}
      <div className="mb-6">
        <CategoryGrid />
      </div>

      {/* Weekly menu compact timeline */}
      <div className="mb-6">
        <WeeklyMenuTimeline compact />
      </div>

      {/* Seasonal recipes — 2×2, placed directly below WeeklyMenuTimeline */}
      {seasonal.length > 0 && (
        <div ref={seasonalSectionRef}>
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
        </div>
      )}

      {/* 今日食べたい料理 — weather × seasonal scoring, 2×2 */}
      {todayRecipes.length > 0 && (
        <div ref={todayFoodRef}>
          {todayWeather?.weatherText && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-text-secondary">
              <Cloud className="h-3.5 w-3.5" />
              <span>今日の天気: {todayWeather.weatherText}（{todayWeather.maxTempC}°C）</span>
            </div>
          )}
          <TwoColRecipeSection
            icon={<Flame className="h-5 w-5 text-orange-400" />}
            title="今日食べたい料理"
            recipes={todayRecipes}
            stockNames={stockNames}
            onSelect={(id) => navigate(`/recipe/${id}`)}
          />
        </div>
      )}

      {/* Stock-based recommendations — 2×2 */}
      {displayRecs.length > 0 && (
        <div ref={stockSectionRef}>
          <TwoColRecipeSection
            icon={<Sparkles className="h-5 w-5 text-accent" />}
            title="在庫でつくれるレシピ"
            recipes={displayRecs.map(r => r.recipe)}
            stockNames={stockNames}
            matchRates={recMatchRates}
            onSelect={(id) => navigate(`/recipe/${id}`)}
          />
        </div>
      )}
    </div>
  )
}
