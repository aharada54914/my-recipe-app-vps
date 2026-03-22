import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import { addDays, addMinutes, format } from 'date-fns'
import jsQR from 'jsqr'
import { db, type Recipe, type WeeklyMenu, type WeeklyMenuItem } from '../db/db'
import { usePreferences } from './usePreferences'
import { useAuth } from './useAuth'
import { useUIStore } from '../stores/uiStore'
import { selectWeeklyMenu, getWeekStartDate } from '../utils/weeklyMenuSelector'
import {
  buildWeeklyMenuRecipesWithServings,
  filterBySeasoningOption,
  formatWeeklyShoppingListByStoreSection,
  getMissingWeeklyIngredients,
} from '../utils/weeklyShoppingUtils'
import { registerShoppingListToCalendar, registerWeeklyMenuToCalendar } from '../utils/weeklyMenuCalendar'
import { calculateMatchRate, isHelsioDeli } from '../utils/recipeUtils'
import { createWeeklyMenuShareCode, parseWeeklyMenuShareCode } from '../utils/weeklyMenuShare'
import { getNotificationPermission, showLocalNotification } from '../utils/notifications'
import { isRecipeAllowedForRole } from '../utils/mealRoleRules'
import { analyzeWeeklyMenuNutrition } from '../utils/weeklyMenuNutritionInsights'
import { getWeeklyWeatherForecast, type DailyWeather } from '../utils/season-weather/weatherProvider'
import { buildDisplayForecastForWeek, filterForecastForWeek, isCompleteForecastForWeek } from '../utils/season-weather/weekWeather'
import { learnTOptFromHistory } from '../utils/season-weather/tOptLearner'
import { logWeeklyMenuSwap } from '../utils/weeklyMenuSelectionLogging'
import { WEEKLY_MENU_IMPORT_PARAM } from '../utils/weeklyMenuQr'
import { getWeeklyMenuGenerationErrorMessage } from '../utils/weeklyMenuGenerationError'
import {
  getWeeklyMenuByWeekStart,
  saveWeeklyMenuDraft,
  updateWeeklyMenuItems as persistWeeklyMenuItems,
} from '../repositories/weeklyMenuRepository'

function collectRecipeIds(items: WeeklyMenuItem[]): number[] {
  const ids: number[] = []
  for (const item of items) {
    ids.push(item.recipeId)
    if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
  }
  return ids
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function hashStringToSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function buildWeeklyMenuFingerprint(items: WeeklyMenuItem[]): string {
  return items
    .map((item) => `${item.date}:${item.recipeId}:${item.sideRecipeId ?? 0}:${item.locked ? 1 : 0}`)
    .join('|')
}

function getMinimumChangedUnlockedDays(items: WeeklyMenuItem[]): number {
  const unlockedDays = items.filter((item) => !item.locked).length
  if (unlockedDays === 0) return 0
  return Math.min(unlockedDays, Math.max(4, Math.ceil(unlockedDays * 0.6)))
}

function getChangedMainDates(previousItems: WeeklyMenuItem[], nextItems: WeeklyMenuItem[]): string[] {
  const previousByDate = new Map(previousItems.map((item) => [item.date, item.recipeId]))
  return nextItems
    .filter((item) => previousByDate.get(item.date) !== item.recipeId)
    .map((item) => item.date)
}

export function useWeeklyMenuController() {
  const navigate = useNavigate()
  const location = useLocation()
  const { preferences, updatePreferences } = usePreferences()
  const { providerToken, signInWithGoogle, isOAuthAvailable } = useAuth()
  const addToast = useUIStore((state) => state.addToast)

  const [weekStart, setWeekStart] = useState(() => getWeekStartDate(new Date()))
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  const existingMenu = useLiveQuery(
    () => getWeeklyMenuByWeekStart(weekStartStr),
    [weekStartStr],
  )

  const [menu, setMenu] = useState<WeeklyMenu | null>(null)
  const [recipes, setRecipes] = useState<Map<number, Recipe>>(new Map())
  const [generating, setGenerating] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [includeSeasonings, setIncludeSeasonings] = useState(false)
  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null)
  const [swapType, setSwapType] = useState<'main' | 'side'>('main')
  const [swapCandidates, setSwapCandidates] = useState<Recipe[]>([])
  const [swapFavorites, setSwapFavorites] = useState<Recipe[]>([])
  const [swapSearchQuery, setSwapSearchQuery] = useState('')
  const [ganttDayIndex, setGanttDayIndex] = useState<number | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCodeInput, setShareCodeInput] = useState('')
  const [swapLoading, setSwapLoading] = useState(false)
  const [weeklyWeather, setWeeklyWeather] = useState<DailyWeather[]>([])
  const [weatherExpanded, setWeatherExpanded] = useState(false)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherLastFetchedAt, setWeatherLastFetchedAt] = useState<Date | null>(null)
  const [lastRegeneratedChangedMainDays, setLastRegeneratedChangedMainDays] = useState<number | null>(null)
  const [lastRegeneratedChangedDates, setLastRegeneratedChangedDates] = useState<string[]>([])

  const stockItems = useLiveQuery(() => db.stock.filter((item) => item.inStock).toArray(), [])
  const latestWeather = useLiveQuery(() => db.weatherCache.orderBy('fetchedAt').last(), [])
  const stockNames = useMemo(() => new Set((stockItems ?? []).map((item) => item.name)), [stockItems])
  const weeklyWeatherCards = useMemo(
    () => (weeklyWeather.length > 0 ? buildDisplayForecastForWeek(weeklyWeather, weekStart) : []),
    [weeklyWeather, weekStart],
  )

  const loadRecipes = useCallback(async (recipeIds: number[]) => {
    if (recipeIds.length === 0) {
      setRecipes(new Map())
      return
    }

    const loaded = await db.recipes.bulkGet(recipeIds)
    const nextRecipes = new Map<number, Recipe>()
    for (const recipe of loaded) {
      if (recipe?.id != null) nextRecipes.set(recipe.id, recipe)
    }
    setRecipes(nextRecipes)
  }, [])

  const persistMenuForWeek = useCallback(async (
    targetWeekStartDate: string,
    items: WeeklyMenuItem[],
    existing?: WeeklyMenu | null,
  ) => {
    const nextMenu = await saveWeeklyMenuDraft(targetWeekStartDate, items, existing)
    setMenu(nextMenu)
    await loadRecipes(collectRecipeIds(items))
    return nextMenu
  }, [loadRecipes])

  const updateMenuItems = useCallback(async (updater: (items: WeeklyMenuItem[]) => WeeklyMenuItem[]) => {
    if (!menu) return null

    const nextItems = updater(menu.items)
    const nextMenu: WeeklyMenu = {
      ...menu,
      items: nextItems,
      updatedAt: new Date(),
    }

    setMenu(nextMenu)
    if (menu.id != null) {
      const persistedMenu = await persistWeeklyMenuItems(menu, nextItems)
      setMenu(persistedMenu)
      return persistedMenu
    }

    return nextMenu
  }, [menu])

  useEffect(() => {
    if (existingMenu === undefined) return
    if (existingMenu === null) {
      setMenu(null)
      setRecipes(new Map())
      return
    }

    setMenu(existingMenu)
    void loadRecipes(collectRecipeIds(existingMenu.items))
  }, [existingMenu, loadRecipes])

  useEffect(() => {
    setLastRegeneratedChangedMainDays(null)
    setLastRegeneratedChangedDates([])
  }, [weekStartStr])

  const handleGenerate = useCallback(async () => {
    const currentItems = menu?.items ?? []
    const isRegenerate = currentItems.length > 0
    if (isRegenerate && currentItems.every((item) => item.locked)) {
      addToast({ type: 'info', message: 'すべて固定されているため再生成できません' })
      return
    }

    setGenerating(true)
    try {
      const minimumChangedUnlockedDays = isRegenerate ? getMinimumChangedUnlockedDays(currentItems) : undefined
      const regenerateSeed = isRegenerate
        ? hashStringToSeed(`${weekStartStr}:${buildWeeklyMenuFingerprint(currentItems)}`)
        : undefined
      const items = await selectWeeklyMenu(
        weekStart,
        {
          ...preferences,
          generationMode: isRegenerate ? 'regenerate' : 'initial',
          minimumChangedUnlockedDays,
          regenerateSeed,
          preloadedWeather: isCompleteForecastForWeek(weeklyWeather, weekStart)
            ? filterForecastForWeek(weeklyWeather, weekStart)
            : undefined,
        },
        currentItems,
        currentItems,
      )

      await persistMenuForWeek(weekStartStr, items, menu)

      const changedMainDates = isRegenerate ? getChangedMainDates(currentItems, items) : []
      setLastRegeneratedChangedDates(changedMainDates)
      setLastRegeneratedChangedMainDays(isRegenerate ? changedMainDates.length : null)

      if (preferences.notifyWeeklyMenuDone && getNotificationPermission() === 'granted') {
        await showLocalNotification({
          title: isRegenerate ? '週間献立を更新しました' : '週間献立を作成しました',
          body: `${format(weekStart, 'M/d')}開始の献立を更新しました。`,
          tag: `weekly_menu_${weekStartStr}`,
        })
      }

      if (isRegenerate) {
        addToast({
          type: 'success',
          message: `週間献立を更新しました（主菜${changedMainDates.length}日分を変更）`,
        })
      } else {
        addToast({ type: 'success', message: '週間献立を作成しました' })
      }
    } catch (error) {
      console.error('献立の生成に失敗しました', error)
      addToast({
        type: 'error',
        message: `献立生成に失敗しました: ${getWeeklyMenuGenerationErrorMessage(error)}`,
        durationMs: 4500,
      })
    } finally {
      setGenerating(false)
    }
  }, [addToast, menu, persistMenuForWeek, preferences, weekStart, weekStartStr, weeklyWeather])

  const handleToggleLock = useCallback((dayIndex: number) => {
    void updateMenuItems((items) => {
      const nextItems = [...items]
      nextItems[dayIndex] = { ...nextItems[dayIndex], locked: !nextItems[dayIndex].locked }
      return nextItems
    })
  }, [updateMenuItems])

  const handleOpenSwap = useCallback(async (dayIndex: number, type: 'main' | 'side') => {
    if (!menu) return
    setSwapLoading(true)
    try {
      const usedIds = new Set(menu.items.flatMap((item) => {
        const ids: number[] = [item.recipeId]
        if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
        return ids
      }))

      const [allRecipes, favoriteRecords] = await Promise.all([
        db.recipes.toArray(),
        db.favorites.toArray(),
      ])

      const favoriteIds = new Set(favoriteRecords.map((record) => record.recipeId))
      const role = type === 'main' ? 'main' : 'side'
      const candidates = allRecipes
        .filter((recipe) => recipe.id != null && !usedIds.has(recipe.id) && !isHelsioDeli(recipe))
        .filter((recipe) => isRecipeAllowedForRole(recipe, role))
        .map((recipe) => ({ recipe, matchRate: calculateMatchRate(recipe.ingredients ?? [], stockNames) }))
        .sort((left, right) => right.matchRate - left.matchRate)
        .map((entry) => entry.recipe)

      setSwapCandidates(candidates)
      setSwapFavorites(candidates.filter((recipe) => favoriteIds.has(recipe.id!)))
      setSwapSearchQuery('')
      setSwapDayIndex(dayIndex)
      setSwapType(type)
    } catch (error) {
      console.error('Failed to open swap modal', error)
      addToast({ type: 'error', message: 'レシピ変更候補の読み込みに失敗しました', durationMs: 4000 })
    } finally {
      setSwapLoading(false)
    }
  }, [addToast, menu, stockNames])

  const handleSelectSwap = useCallback(async (recipe: Recipe) => {
    if (!menu || swapDayIndex === null) return
    if (!isRecipeAllowedForRole(recipe, swapType === 'main' ? 'main' : 'side')) {
      addToast({ type: 'error', message: 'この枠に割り当てできないレシピです' })
      return
    }

    const currentItem = menu.items[swapDayIndex]
    const previousRecipeId = swapType === 'main'
      ? currentItem.recipeId
      : currentItem.sideRecipeId

    await updateMenuItems((items) => {
      const nextItems = [...items]
      nextItems[swapDayIndex] = swapType === 'main'
        ? { ...currentItem, recipeId: recipe.id!, mainServings: undefined }
        : { ...currentItem, sideRecipeId: recipe.id!, sideServings: undefined }
      return nextItems
    })

    setRecipes((prev) => new Map(prev).set(recipe.id!, recipe))
    setSwapDayIndex(null)

    if (previousRecipeId != null) {
      void logWeeklyMenuSwap({
        weekStartDate: weekStartStr,
        dayIndex: swapDayIndex,
        role: swapType,
        replacedRecipeId: previousRecipeId,
        selectedRecipeId: recipe.id!,
      })
    }

    addToast({ type: 'success', message: `${swapType === 'main' ? '主菜' : '副菜'}を変更しました` })
  }, [addToast, menu, swapDayIndex, swapType, updateMenuItems, weekStartStr])

  const selectedRecipes = useMemo(() => {
    if (!menu) return [] as Recipe[]
    return buildWeeklyMenuRecipesWithServings(menu, recipes)
  }, [menu, recipes])

  const nutritionInsights = useMemo(() => analyzeWeeklyMenuNutrition(selectedRecipes), [selectedRecipes])

  const lowConfidenceNutritionCount = useMemo(
    () => selectedRecipes.filter((recipe) => recipe.nutritionMeta?.source === 'estimated' && recipe.nutritionMeta?.lowConfidence).length,
    [selectedRecipes],
  )
  const fallbackNutritionCount = useMemo(
    () => selectedRecipes.filter((recipe) => recipe.nutritionMeta?.source === 'estimated' && recipe.nutritionMeta?.usedFallback).length,
    [selectedRecipes],
  )

  const handleAdjustServings = useCallback((dayIndex: number, type: 'main' | 'side', delta: number) => {
    if (!menu) return
    const item = menu.items[dayIndex]
    if (!item) return

    const recipe = type === 'main'
      ? recipes.get(item.recipeId)
      : item.sideRecipeId != null ? recipes.get(item.sideRecipeId) : undefined
    if (!recipe) return

    const current = type === 'main'
      ? (item.mainServings ?? recipe.baseServings)
      : (item.sideServings ?? recipe.baseServings)
    const nextValue = Math.min(10, Math.max(1, current + delta))

    void updateMenuItems((items) => {
      const nextItems = [...items]
      nextItems[dayIndex] = type === 'main'
        ? { ...item, mainServings: nextValue }
        : { ...item, sideServings: nextValue }
      return nextItems
    })
  }, [menu, recipes, updateMenuItems])

  const handleRegisterCalendar = useCallback(async () => {
    if (!menu) return
    if (!isOAuthAvailable) {
      addToast({
        type: 'error',
        message: 'Google連携が未設定です。設定画面で OAuth を確認してください',
        durationMs: 4500,
      })
      return
    }
    if (!providerToken) {
      signInWithGoogle()
      return
    }
    if (!preferences.familyCalendarId) {
      addToast({
        type: 'error',
        message: '家族カレンダーが未設定です。設定 → カレンダー で「家族カレンダー」を先に選んでください',
        durationMs: 5000,
      })
      return
    }

    setRegistering(true)
    try {
      const mealRecipes = Array.from(recipes.values())
      const result = await registerWeeklyMenuToCalendar(providerToken, menu, mealRecipes, preferences)

      if (stockItems) {
        const missing = filterBySeasoningOption(
          getMissingWeeklyIngredients(selectedRecipes, stockItems),
          includeSeasonings,
        )
        if (missing.length > 0) {
          const shoppingListText = formatWeeklyShoppingListByStoreSection(weekStartStr, missing)
          await registerShoppingListToCalendar(providerToken, shoppingListText, weekStart, preferences, menu, recipes)
        }
      }

      if (result.errors.length > 0) {
        addToast({
          type: 'error',
          message: `家族カレンダー登録: ${result.registered}件成功 / ${result.errors.length}件失敗`,
          durationMs: 5000,
        })
      } else {
        addToast({ type: 'success', message: `家族カレンダー登録が完了しました（${result.registered}件）`, durationMs: 4000 })
      }

      void learnTOptFromHistory(preferences.tOpt).then((updatedTOpt) => {
        void updatePreferences({ tOpt: updatedTOpt })
      })
    } catch (error) {
      console.error('Calendar registration failed', error)
      addToast({
        type: 'error',
        message: `カレンダー登録に失敗しました: ${getErrorMessage(error, '不明なエラー')}`,
        durationMs: 5000,
      })
    } finally {
      setRegistering(false)
    }
  }, [
    addToast,
    includeSeasonings,
    isOAuthAvailable,
    menu,
    preferences,
    providerToken,
    recipes,
    selectedRecipes,
    signInWithGoogle,
    stockItems,
    updatePreferences,
    weekStart,
    weekStartStr,
  ])

  const adjustWeek = useCallback((delta: number) => {
    setWeekStart((prev) => addDays(prev, delta * 7))
    setMenu(null)
    setRecipes(new Map())
    setShowShoppingList(false)
    setShareOpen(false)
  }, [])

  const desiredMealTime = useMemo(() => {
    const date = new Date()
    date.setHours(preferences.desiredMealHour, preferences.desiredMealMinute, 0, 0)
    return date
  }, [preferences.desiredMealHour, preferences.desiredMealMinute])

  const getCookingStartTime = useCallback((mainRecipe: Recipe | undefined) => {
    if (!mainRecipe || !mainRecipe.totalTimeMinutes) return null
    return addMinutes(desiredMealTime, -mainRecipe.totalTimeMinutes)
  }, [desiredMealTime])

  const weekEndStr = format(addDays(weekStart, 6), 'M/d')
  const weekStartDisplay = format(weekStart, 'M/d')
  const shareCode = useMemo(() => {
    if (!menu) return ''
    return createWeeklyMenuShareCode(weekStartStr, menu.items)
  }, [menu, weekStartStr])
  const isOverlayOpen = swapDayIndex !== null || ganttDayIndex !== null || shareOpen

  const applySharedMenu = useCallback(async (code: string) => {
    const shared = parseWeeklyMenuShareCode(code)
    const existing = await getWeeklyMenuByWeekStart(shared.weekStartDate)
    await persistMenuForWeek(shared.weekStartDate, shared.items, existing)
    setWeekStart(new Date(`${shared.weekStartDate}T00:00:00`))
  }, [persistMenuForWeek])

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('shared')
    if (!code) return

    void applySharedMenu(code)
      .then(() => {
        addToast({ type: 'success', message: '共有された週間献立を読み込みました', durationMs: 4000 })
      })
      .catch((error) => {
        addToast({
          type: 'error',
          message: `共有コードの読み込みに失敗しました: ${getErrorMessage(error, '不明なエラー')}`,
          durationMs: 5000,
        })
      })
      .finally(() => {
        navigate('/weekly-menu', { replace: true })
      })
  }, [addToast, applySharedMenu, location.search, navigate])

  const handleShareLink = useCallback(async () => {
    if (!menu) return
    const url = `${window.location.origin}/weekly-menu?shared=${encodeURIComponent(shareCode)}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Kitchen App 週間献立 ${weekStartDisplay}〜${weekEndStr}`,
          text: '週間献立を共有します',
          url,
        })
        return
      }

      await navigator.clipboard.writeText(url)
      addToast({ type: 'success', message: '共有リンクをコピーしました' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      addToast({
        type: 'error',
        message: `共有に失敗しました: ${getErrorMessage(error, '不明なエラー')}`,
        durationMs: 4000,
      })
    }
  }, [addToast, menu, shareCode, weekEndStr, weekStartDisplay])

  const handleImportFromCode = useCallback(async () => {
    if (!shareCodeInput.trim()) {
      addToast({ type: 'info', message: '共有コードを入力してください' })
      return
    }

    try {
      await applySharedMenu(shareCodeInput)
      setShareOpen(false)
      setShareCodeInput('')
      addToast({ type: 'success', message: '共有コードから週間献立を読み込みました', durationMs: 4000 })
    } catch (error) {
      addToast({
        type: 'error',
        message: `共有コードが不正です: ${getErrorMessage(error, '不明なエラー')}`,
        durationMs: 4500,
      })
    }
  }, [addToast, applySharedMenu, shareCodeInput])

  const handleScanMenuImage = useCallback((file: File) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')

      if (!context) {
        URL.revokeObjectURL(objectUrl)
        addToast({ type: 'error', message: '画像読み取りに必要な Canvas が使えません' })
        return
      }

      context.drawImage(image, 0, 0)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })
      URL.revokeObjectURL(objectUrl)

      if (!code?.data) {
        addToast({ type: 'error', message: 'QRコードが見つかりませんでした', durationMs: 4000 })
        return
      }

      try {
        const qrUrl = new URL(code.data)
        const param = qrUrl.searchParams.get(WEEKLY_MENU_IMPORT_PARAM)
        if (param) {
          navigate(`/weekly-menu?${WEEKLY_MENU_IMPORT_PARAM}=${encodeURIComponent(param)}`, { replace: false })
          return
        }
      } catch {
        // Continue and treat it as a raw share code.
      }

      void applySharedMenu(code.data)
        .then(() => addToast({ type: 'success', message: '共有コードから週間献立を読み込みました', durationMs: 4000 }))
        .catch(() => addToast({ type: 'error', message: 'QRデータを読み取れませんでした', durationMs: 4000 }))
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      addToast({ type: 'error', message: '画像の読み込みに失敗しました' })
    }

    image.src = objectUrl
  }, [addToast, applySharedMenu, navigate])

  const refreshWeeklyWeather = useCallback(async (source: 'auto' | 'manual' = 'manual') => {
    setWeatherLoading(true)
    try {
      const forecast = await getWeeklyWeatherForecast(weekStart)
      setWeeklyWeather(filterForecastForWeek(forecast, weekStart))
      setWeatherLastFetchedAt(new Date())
      if (source === 'manual') {
        addToast({ type: 'success', message: '天気予報を更新しました' })
      }
    } catch (error) {
      console.error('Weekly weather refresh failed', error)
      addToast({
        type: 'error',
        message: `天気予報の取得に失敗しました: ${getErrorMessage(error, '不明なエラー')}`,
        durationMs: 4500,
      })
    } finally {
      setWeatherLoading(false)
    }
  }, [addToast, weekStart])

  useEffect(() => {
    void refreshWeeklyWeather('auto')
  }, [refreshWeeklyWeather])

  useEffect(() => {
    if (!showShoppingList) return
    if (!stockItems || !preferences.notifyShoppingListDone) return
    if (getNotificationPermission() !== 'granted') return

    const missing = getMissingWeeklyIngredients(selectedRecipes, stockItems)
    if (missing.length === 0) return

    void showLocalNotification({
      title: '買い物リストを確認しましょう',
      body: `${missing.length}件の不足食材があります。`,
      tag: `shopping_${weekStartStr}`,
    })
  }, [preferences.notifyShoppingListDone, selectedRecipes, showShoppingList, stockItems, weekStartStr])

  return {
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
    latestWeather,
    lastRegeneratedChangedDates,
    lastRegeneratedChangedMainDays,
    lowConfidenceNutritionCount,
    menu,
    nutritionInsights,
    preferences,
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
    weekStart,
    weekStartDisplay,
    weekStartStr,
    weeklyWeatherCards,
    adjustWeek,
  }
}
