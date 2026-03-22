/**
 * Weekly Menu Preview/Edit Page
 *
 * Keeps rendering concerns in the page and moves data/state orchestration
 * into a dedicated controller hook.
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock3,
  Lock,
  RefreshCw,
  Share2,
  ShoppingCart,
  Unlock,
  UtensilsCrossed,
} from 'lucide-react'
import { format, parse } from 'date-fns'
import { ja } from 'date-fns/locale'
import { RecipeCard } from '../components/RecipeCard'
import { SwapModal } from '../components/weekly/SwapModal'
import { GanttDayModal } from '../components/weekly/GanttDayModal'
import { ShareMenuModal } from '../components/weekly/ShareMenuModal'
import { ServingsStepper } from '../components/weekly/ServingsStepper'
import { WeeklyShoppingListSheet } from '../components/weekly/WeeklyShoppingListSheet'
import { WeatherIllustration } from '../components/weather/WeatherIllustration'
import { WEATHER_TILE_TOKENS } from '../components/weather/weatherIllustrationTokens'
import { calculateMatchRate } from '../utils/recipeUtils'
import { getWeatherPresentation } from '../utils/season-weather/weatherPresentation'
import { aggregateIngredients } from '../utils/weeklyShoppingUtils'
import { useWeeklyMenuController } from '../hooks/useWeeklyMenuController'
import type { Ingredient, Recipe, WeeklyMenuItem } from '../db/db'

const BALANCE_TIER_LABEL: Record<'heuristic-3' | 'nutrition-5' | 'nutrition-7', string> = {
  'heuristic-3': '3段階推定',
  'nutrition-5': '5段階栄養',
  'nutrition-7': '7段階栄養',
}

interface WeeklyRecipeSlotProps {
  ariaLabel: string
  emptyLabel: string
  recipe?: Recipe
  matchRate?: number
  servings?: number
  onAdjustServings?: (next: number) => void
  onClickRecipe: (id: number) => void
}

function WeeklyRecipeSlot({
  ariaLabel,
  emptyLabel,
  recipe,
  matchRate,
  servings,
  onAdjustServings,
  onClickRecipe,
}: WeeklyRecipeSlotProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-text-secondary">
        <span>{ariaLabel}</span>
        {recipe && typeof servings === 'number' && onAdjustServings && (
          <ServingsStepper
            value={servings}
            ariaLabel={`${ariaLabel}の人数`}
            onChange={onAdjustServings}
          />
        )}
      </div>
      {recipe ? (
        <RecipeCard
          recipe={recipe}
          matchRate={matchRate}
          onClick={() => onClickRecipe(recipe.id!)}
          variant="menu"
        />
      ) : (
        <div className="ui-panel-muted flex min-h-[88px] items-center justify-center text-xs text-text-secondary">
          {emptyLabel}
        </div>
      )}
    </div>
  )
}

interface WeeklyDayAccordionCardProps {
  item: WeeklyMenuItem
  index: number
  isFeatured: boolean
  featuredLabel: string
  changedSinceLastRegenerate?: boolean
  expanded: boolean
  onToggleExpanded?: () => void
  onToggleLock: () => void
  onOpenSwap: (type: 'main' | 'side') => void
  onOpenTimeline: () => void
  onClickRecipe: (id: number) => void
  onAdjustServings: (type: 'main' | 'side', next: number) => void
  mainRecipe?: Recipe
  sideRecipe?: Recipe
  stockNames: Set<string>
  cookStart: Date | null
  desiredMealTime: Date
  swapLoading: boolean
}

function WeeklyDayAccordionCard({
  item,
  index,
  isFeatured,
  featuredLabel,
  changedSinceLastRegenerate = false,
  expanded,
  onToggleExpanded,
  onToggleLock,
  onOpenSwap,
  onOpenTimeline,
  onClickRecipe,
  onAdjustServings,
  mainRecipe,
  sideRecipe,
  stockNames,
  cookStart,
  desiredMealTime,
  swapLoading,
}: WeeklyDayAccordionCardProps) {
  const date = parse(item.date, 'yyyy-MM-dd', new Date())
  const mainMatchRate = mainRecipe ? calculateMatchRate(mainRecipe.ingredients as Ingredient[], stockNames) : undefined
  const sideMatchRate = sideRecipe ? calculateMatchRate(sideRecipe.ingredients as Ingredient[], stockNames) : undefined
  const mainServings = mainRecipe ? (item.mainServings ?? mainRecipe.baseServings) : 0
  const sideServings = sideRecipe ? (item.sideServings ?? sideRecipe.baseServings) : 0
  const title = mainRecipe?.title ?? '未設定'
  const subtitle = sideRecipe?.title ? `＋ ${sideRecipe.title}` : '副菜・スープなし'

  return (
    <div
      data-testid="weekly-day-card"
      data-day-date={item.date}
      className={`rounded-2xl border bg-bg-card p-4 ${isFeatured ? 'border-accent/30 shadow-[0_12px_28px_rgba(227,127,67,0.14)]' : 'border-border-soft'}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${isFeatured ? 'text-accent' : 'text-text-primary'}`}>
                {format(date, 'M/d (E)', { locale: ja })}
              </span>
              {isFeatured && (
                <span className="rounded-md bg-accent/16 px-2 py-0.5 text-xs font-bold text-accent">
                  {featuredLabel}
                </span>
              )}
              {item.locked && (
                <span className="rounded-md bg-bg-card-hover px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                  固定
                </span>
              )}
              {!item.locked && changedSinceLastRegenerate && (
                <span className="rounded-md bg-accent-fresh/16 px-2 py-0.5 text-[11px] font-semibold text-accent-fresh">
                  変更
                </span>
              )}
            </div>
            <p data-testid="weekly-day-title" className="mt-2 truncate text-sm font-bold text-text-primary">{title}</p>
            <p data-testid="weekly-day-subtitle" className="mt-1 truncate text-xs text-text-secondary">{subtitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              {cookStart && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  開始 {format(cookStart, 'HH:mm')}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <UtensilsCrossed className="h-3.5 w-3.5 text-accent" />
                食事 {format(desiredMealTime, 'HH:mm')}
              </span>
            </div>
          </div>
          {onToggleExpanded ? (
            expanded ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-text-secondary" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-text-secondary" />
          ) : null}
        </button>
        <button
          type="button"
          onClick={onToggleLock}
          className="rounded-xl border border-border-soft bg-bg-card-hover p-2 text-text-secondary transition-colors hover:text-accent"
          aria-label={item.locked ? `献立${index + 1}を固定解除` : `献立${index + 1}を固定`}
        >
          {item.locked ? <Lock className="h-4 w-4 text-accent" /> : <Unlock className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <button
            type="button"
            onClick={onOpenTimeline}
            data-testid="weekly-timeline-trigger"
            className="ui-panel-muted flex w-full items-center justify-between text-left"
          >
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
              {cookStart && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 shrink-0" />
                  調理開始 <span className="font-bold text-text-primary">{format(cookStart, 'HH:mm')}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 shrink-0 text-accent" />
                食事時間 <span className="font-bold text-accent">{format(desiredMealTime, 'HH:mm')}</span>
              </span>
            </div>
            <CalendarClock className="h-5 w-5 shrink-0 text-text-secondary" />
          </button>

          <div className="grid grid-cols-1 gap-4">
            <WeeklyRecipeSlot
              ariaLabel="主菜"
              emptyLabel="主菜なし"
              recipe={mainRecipe}
              matchRate={mainMatchRate}
              servings={mainServings}
              onAdjustServings={(next) => onAdjustServings('main', next)}
              onClickRecipe={onClickRecipe}
            />
            <WeeklyRecipeSlot
              ariaLabel="副菜 / スープ"
              emptyLabel="副菜なし"
              recipe={sideRecipe}
              matchRate={sideMatchRate}
              servings={sideServings}
              onAdjustServings={(next) => onAdjustServings('side', next)}
              onClickRecipe={onClickRecipe}
            />
          </div>

          {!item.locked && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenSwap('main')}
                disabled={swapLoading}
                data-testid="weekly-swap-main"
                className="ui-btn ui-btn-secondary text-xs disabled:opacity-50"
              >
                {swapLoading ? '読込中...' : '主菜を変更'}
              </button>
              <button
                type="button"
                onClick={() => onOpenSwap('side')}
                disabled={swapLoading}
                data-testid="weekly-swap-side"
                className="ui-btn ui-btn-secondary text-xs disabled:opacity-50"
              >
                {swapLoading ? '読込中...' : '副菜を変更'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function WeeklyMenuPage() {
  const navigate = useNavigate()
  const {
    adjustWeek,
    desiredMealTime,
    fallbackNutritionCount,
    ganttDayIndex,
    generating,
    getCookingStartTime,
    handleAdjustServings,
    handleGenerate,
    handleImportFromCode,
    handleOpenSwap,
    handleRegisterCalendar,
    handleScanMenuImage,
    handleSelectSwap,
    handleShareLink,
    handleToggleLock,
    includeSeasonings,
    isOverlayOpen,
    lastRegeneratedChangedDates,
    lastRegeneratedChangedMainDays,
    lowConfidenceNutritionCount,
    menu,
    nutritionInsights,
    providerToken,
    recipes,
    refreshWeeklyWeather,
    registering,
    selectedRecipes,
    setGanttDayIndex,
    setIncludeSeasonings,
    setShareCodeInput,
    setShareOpen,
    setShowShoppingList,
    setSwapDayIndex,
    setSwapSearchQuery,
    setWeatherExpanded,
    shareCode,
    shareCodeInput,
    shareOpen,
    showShoppingList,
    stockItems,
    stockNames,
    swapCandidates,
    swapDayIndex,
    swapFavorites,
    swapLoading,
    swapSearchQuery,
    swapType,
    weatherExpanded,
    weatherLastFetchedAt,
    weatherLoading,
    weekEndStr,
    weekStartDisplay,
    weekStartStr,
    weeklyWeatherCards,
  } = useWeeklyMenuController()

  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  const shoppingIngredients = useMemo(
    () => (stockItems ? aggregateIngredients(selectedRecipes, stockItems) : []),
    [selectedRecipes, stockItems],
  )
  const visibleShoppingIngredients = useMemo(
    () => shoppingIngredients.filter((ingredient) => includeSeasonings || ingredient.ingredientCategory === 'main'),
    [includeSeasonings, shoppingIngredients],
  )
  const missingCount = visibleShoppingIngredients.filter((ingredient) => !ingredient.inStock).length
  const featuredIndex = useMemo(() => {
    if (!menu) return -1
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayIndex = menu.items.findIndex((item) => item.date === today)
    return todayIndex >= 0 ? todayIndex : 0
  }, [menu])
  const featuredItem = featuredIndex >= 0 && menu ? menu.items[featuredIndex] : null
  const isFeaturedToday = !!featuredItem && featuredItem.date === format(new Date(), 'yyyy-MM-dd')
  const restItems = useMemo(
    () => (menu ? menu.items.filter((_, index) => index !== featuredIndex) : []),
    [featuredIndex, menu],
  )
  const activeExpandedDate = menu?.items.some((item) => item.date === expandedDate) ? expandedDate : null
  const changedDatesSinceLastRegenerate = useMemo(
    () => new Set(lastRegeneratedChangedDates),
    [lastRegeneratedChangedDates],
  )

  const toggleExpandedDate = (date: string) => {
    setExpandedDate((current) => (current === date ? null : date))
  }

  return (
    <div className="pt-4">
      <div className={`space-y-4 ${menu ? 'pb-36' : 'pb-24'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ui-section-kicker">Weekly Plan</p>
            <h2 className="mt-1 text-xl font-extrabold text-text-primary">週間献立</h2>
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            disabled={!menu}
            className="ui-btn ui-btn-secondary min-w-[44px] px-3 text-xs disabled:opacity-40"
          >
            共有
          </button>
        </div>

        <div className="ui-panel">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => adjustWeek(-1)}
              className="ui-btn ui-btn-secondary px-3 text-sm"
            >
              前の週
            </button>
            <div className="text-center">
              <div className="text-xl font-extrabold text-accent">
                {weekStartDisplay} - {weekEndStr}
              </div>
            </div>
            <button
              type="button"
              onClick={() => adjustWeek(1)}
              className="ui-btn ui-btn-secondary px-3 text-sm"
            >
              次の週
            </button>
          </div>
        </div>

        <div className="ui-panel">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setWeatherExpanded((prev) => !prev)}
              className="flex flex-1 items-center justify-between text-left"
              aria-expanded={weatherExpanded}
              aria-label="今週の東京都天気カードを展開"
            >
              <h4 className="text-sm font-bold text-text-secondary">今週の東京都天気（気象庁）</h4>
              {weatherExpanded ? <ChevronUp className="h-4 w-4 text-text-secondary" /> : <ChevronDown className="h-4 w-4 text-text-secondary" />}
            </button>
            <button
              type="button"
              onClick={() => void refreshWeeklyWeather()}
              disabled={weatherLoading}
              className="ui-btn ui-btn-secondary min-h-[36px] px-2 py-1 text-xs disabled:opacity-50"
              aria-label="天気予報を再取得"
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
              再取得
            </button>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">
            取得タイミング: 週の切替時に自動取得 / 手動で再取得可能
            {weatherLastFetchedAt ? `（最終取得: ${format(weatherLastFetchedAt, 'M/d HH:mm')}）` : ''}
          </p>

          {weatherExpanded && (
            <div className="mt-3">
              {weatherLoading && weeklyWeatherCards.length === 0 ? (
                <p className="text-xs text-text-secondary">天気予報を読み込み中...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
                  {weeklyWeatherCards.map((weather) => {
                    const presentation = getWeatherPresentation(weather)
                    const tileToken = WEATHER_TILE_TOKENS[presentation.variant]

                    return (
                      <div
                        key={weather.date}
                        data-testid="weekly-weather-card"
                        data-weather-date={weather.date}
                        data-weather-variant={presentation.variant}
                        className="rounded-xl p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        style={{
                          background: tileToken.background,
                          border: `1px solid ${tileToken.border}`,
                        }}
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{format(parse(weather.date, 'yyyy-MM-dd', new Date()), 'M/d (E)', { locale: ja })}</p>
                            <span
                              data-testid="weekly-weather-label"
                              className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold"
                              style={{ backgroundColor: tileToken.badgeBg, color: tileToken.badgeText }}
                            >
                              {presentation.label}
                            </span>
                          </div>
                          <div className="shrink-0 rounded-xl bg-black/15 p-1.5 ring-1 ring-white/10">
                            <WeatherIllustration weather={weather} size={48} />
                          </div>
                        </div>

                        <div className="mb-1 flex items-end gap-2">
                          <span className="text-lg font-extrabold" style={{ color: tileToken.tempHigh }}>
                            {weather.maxTempC}℃
                          </span>
                          <span className="text-sm font-semibold" style={{ color: tileToken.tempLow }}>
                            / {weather.minTempC}℃
                          </span>
                        </div>

                        <div className="space-y-0.5 text-[12px] text-white/82">
                          <p>降水目安: {weather.precipitationMm}mm</p>
                          <p>湿度: {weather.humidityPercent != null ? `${weather.humidityPercent}%` : '—'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {!menu ? (
          <div className="ui-action-card text-center">
            <p className="mb-2 text-base font-bold text-text-primary">
              この週の献立はまだ生成されていません
            </p>
            <p className="mx-auto mb-5 max-w-xs text-sm leading-relaxed text-text-secondary">
              まず 1 回作成すると、買い物リスト、共有、Google カレンダー登録までこの画面でまとめて扱えます。
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="ui-btn ui-btn-primary w-full disabled:opacity-50"
            >
              {generating ? '生成中...' : '献立を自動生成'}
            </button>
          </div>
        ) : (
          <>
            <div data-testid="weekly-summary-card" className="ui-action-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ui-section-kicker">Summary</p>
                  <h3 className="mt-1 text-lg font-extrabold text-text-primary">今週の状態</h3>
                </div>
                <span className="rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                  {BALANCE_TIER_LABEL[nutritionInsights.tierDecision.tier]}
                </span>
              </div>

              <div className="mt-4 space-y-1.5 text-sm">
                {lastRegeneratedChangedMainDays != null && (
                  <div
                    data-testid="weekly-regenerate-diff-summary"
                    className="mb-3 rounded-xl border border-accent-fresh/20 bg-accent-fresh/10 px-3 py-2 text-sm font-semibold text-accent-fresh"
                  >
                    主菜変更 {lastRegeneratedChangedMainDays} / {menu.items.length}日
                  </div>
                )}
                {nutritionInsights.gaps.map((gap) => (
                  <p key={gap} className="text-warning">・{gap}</p>
                ))}
                {nutritionInsights.highlights.map((highlight) => (
                  <p key={highlight} className="text-accent-fresh">・{highlight}</p>
                ))}
                {lowConfidenceNutritionCount > 0 && (
                  <p className="text-warning">
                    ・推定精度注意: {lowConfidenceNutritionCount} 品は栄養推定の信頼度が低めです
                  </p>
                )}
                {fallbackNutritionCount > 0 && (
                  <p className="text-warning">
                    ・補完推定: {fallbackNutritionCount} 品でエネルギー基準の補完計算を使用
                  </p>
                )}
              </div>
            </div>

            {featuredItem && (
              <section data-testid="weekly-featured-day" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="ui-section-kicker">{isFeaturedToday ? 'Today' : 'Featured'}</p>
                    <h3 className="ui-section-title mt-1">{isFeaturedToday ? '今日の献立' : '週の先頭メニュー'}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShoppingList(true)}
                    className="ui-btn ui-btn-secondary px-3 text-xs"
                  >
                    買い物リスト
                  </button>
                </div>
                <WeeklyDayAccordionCard
                  item={featuredItem}
                  index={featuredIndex}
                  isFeatured
                  featuredLabel={isFeaturedToday ? '今日' : '注目'}
                  changedSinceLastRegenerate={changedDatesSinceLastRegenerate.has(featuredItem.date)}
                  expanded
                  onToggleLock={() => handleToggleLock(featuredIndex)}
                  onOpenSwap={(type) => handleOpenSwap(featuredIndex, type)}
                  onOpenTimeline={() => setGanttDayIndex(featuredIndex)}
                  onClickRecipe={(id) => navigate(`/recipe/${id}`)}
                  onAdjustServings={(type, next) => {
                    const recipe = type === 'main'
                      ? recipes.get(featuredItem.recipeId)
                      : featuredItem.sideRecipeId != null ? recipes.get(featuredItem.sideRecipeId) : undefined
                    const current = recipe
                      ? type === 'main'
                        ? (featuredItem.mainServings ?? recipe.baseServings)
                        : (featuredItem.sideServings ?? recipe.baseServings)
                      : 0
                    handleAdjustServings(featuredIndex, type, next - current)
                  }}
                  mainRecipe={recipes.get(featuredItem.recipeId)}
                  sideRecipe={featuredItem.sideRecipeId != null ? recipes.get(featuredItem.sideRecipeId) : undefined}
                  stockNames={stockNames}
                  cookStart={getCookingStartTime(recipes.get(featuredItem.recipeId))}
                  desiredMealTime={desiredMealTime}
                  swapLoading={swapLoading}
                />
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="ui-section-kicker">Rest Of Week</p>
                  <h3 className="ui-section-title mt-1">残りの日程</h3>
                </div>
                <span className="text-xs text-text-secondary">{restItems.length}日分</span>
              </div>
                <div className="space-y-3">
                {restItems.map((item) => {
                  const expanded = activeExpandedDate === item.date
                  const itemIndex = menu.items.findIndex((candidate) => candidate.date === item.date)
                  return (
                    <WeeklyDayAccordionCard
                      key={item.date}
                      item={item}
                      index={itemIndex}
                      isFeatured={false}
                      featuredLabel=""
                      changedSinceLastRegenerate={changedDatesSinceLastRegenerate.has(item.date)}
                      expanded={expanded}
                      onToggleExpanded={() => toggleExpandedDate(item.date)}
                      onToggleLock={() => handleToggleLock(itemIndex)}
                      onOpenSwap={(type) => handleOpenSwap(itemIndex, type)}
                      onOpenTimeline={() => setGanttDayIndex(itemIndex)}
                      onClickRecipe={(id) => navigate(`/recipe/${id}`)}
                      onAdjustServings={(type, next) => {
                        const recipe = type === 'main'
                          ? recipes.get(item.recipeId)
                          : item.sideRecipeId != null ? recipes.get(item.sideRecipeId) : undefined
                        const current = recipe
                          ? type === 'main'
                            ? (item.mainServings ?? recipe.baseServings)
                            : (item.sideServings ?? recipe.baseServings)
                          : 0
                        handleAdjustServings(itemIndex, type, next - current)
                      }}
                      mainRecipe={recipes.get(item.recipeId)}
                      sideRecipe={item.sideRecipeId != null ? recipes.get(item.sideRecipeId) : undefined}
                      stockNames={stockNames}
                      cookStart={getCookingStartTime(recipes.get(item.recipeId))}
                      desiredMealTime={desiredMealTime}
                      swapLoading={swapLoading}
                    />
                  )
                })}
              </div>
            </section>
          </>
        )}

        {swapDayIndex !== null && (
          <SwapModal
            swapType={swapType}
            candidates={swapCandidates}
            favorites={swapFavorites}
            searchQuery={swapSearchQuery}
            stockNames={stockNames}
            onSearchChange={setSwapSearchQuery}
            onSelect={handleSelectSwap}
            onClose={() => setSwapDayIndex(null)}
          />
        )}

        {ganttDayIndex !== null && menu && (
          <GanttDayModal
            item={menu.items[ganttDayIndex]}
            mainRecipe={recipes.get(menu.items[ganttDayIndex].recipeId)}
            sideRecipe={menu.items[ganttDayIndex].sideRecipeId != null
              ? recipes.get(menu.items[ganttDayIndex].sideRecipeId!)
              : undefined}
            desiredMealTime={desiredMealTime}
            onClose={() => setGanttDayIndex(null)}
          />
        )}

        {shareOpen && menu && (
          <ShareMenuModal
            weekLabel={`${weekStartDisplay}〜${weekEndStr}`}
            shareCode={shareCode}
            importCode={shareCodeInput}
            onImportCodeChange={setShareCodeInput}
            onShare={handleShareLink}
            onImport={handleImportFromCode}
            onScanImage={handleScanMenuImage}
            onClose={() => setShareOpen(false)}
          />
        )}
      </div>

      {!isOverlayOpen && menu && !showShoppingList && typeof document !== 'undefined' && createPortal(
        <div
          data-testid="weekly-action-bar"
          className="fixed inset-x-0 z-40 flex justify-center px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
        >
          <div className="w-full max-w-lg rounded-[1.25rem] border border-border-soft bg-bg-primary/98 shadow-[0_-18px_32px_rgba(32,24,15,0.14)]">
            <div className="grid grid-cols-2 gap-2 px-4 py-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="ui-btn ui-btn-secondary flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                再生成
              </button>
              <button
                type="button"
                onClick={() => setShowShoppingList(true)}
                className="ui-btn ui-btn-secondary flex items-center justify-center gap-1.5"
              >
                <ShoppingCart className="h-4 w-4" />
                買い物リスト
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="ui-btn ui-btn-secondary flex items-center justify-center gap-1.5"
              >
                <Share2 className="h-4 w-4" />
                共有
              </button>
              <button
                type="button"
                onClick={handleRegisterCalendar}
                disabled={registering}
                className="ui-btn ui-btn-primary flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Calendar className="h-4 w-4" />
                {registering ? '登録中...' : providerToken ? '家族カレンダーに登録' : 'ログインして登録'}
              </button>
            </div>
            <p className="px-4 pb-4 text-xs text-text-secondary">
              週間献立と買い物リストは、設定した家族カレンダーにまとめて登録します。
            </p>
          </div>
        </div>,
        document.body,
      )}

      {showShoppingList && menu && (
        <WeeklyShoppingListSheet
          weekLabel={`${weekStartDisplay}〜${weekEndStr}`}
          missingCount={missingCount}
          ingredients={shoppingIngredients}
          storageKey={`shopping_checked_${weekStartStr}`}
          includeSeasonings={includeSeasonings}
          onToggleIncludeSeasonings={() => setIncludeSeasonings((value) => !value)}
          onClose={() => setShowShoppingList(false)}
        />
      )}
    </div>
  )
}
