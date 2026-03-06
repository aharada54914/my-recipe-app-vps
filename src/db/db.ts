import Dexie, { type Table } from 'dexie'

// --- Type Definitions ---

export type DeviceType = 'hotcook' | 'healsio' | 'manual'
export type IngredientCategory = 'main' | 'sub'
export type SaltMode = 0.6 | 0.8 | 1.2
export type RecipeCategory = 'すべて' | '主菜' | '副菜' | 'スープ' | '一品料理' | 'スイーツ'
export type TabId = 'home' | 'menu' | 'gemini' | 'favorites' | 'history'

export interface Ingredient {
  name: string
  quantity: number | string
  unit: string
  category: IngredientCategory
  optional?: boolean
}

export interface CookingStep {
  name: string
  durationMinutes: number
  isDeviceStep?: boolean
}

export interface RecipeNutritionPerServing {
  servingSizeG?: number
  energyKcal?: number
  proteinG?: number
  fatG?: number
  carbG?: number
  sodiumMg?: number
  saltEquivalentG?: number
  fiberG?: number
  sugarG?: number
  saturatedFatG?: number
  potassiumMg?: number
  calciumMg?: number
  ironMg?: number
  vitaminCMg?: number
}

export interface RecipeNutritionMeta {
  source?: 'csv' | 'jsonld' | 'gemini' | 'estimated'
  confidence?: number
  schemaVersion?: number
  referenceDataset?: 'japanese-food-composition-table-2020-8th'
  referenceLabel?: string
  estimatorVersion?: string
  totalIngredientCount?: number
  matchedIngredientCount?: number
  ingredientMatchRatio?: number
  matchedWeightRatio?: number
  usedFallback?: boolean
  lowConfidence?: boolean
  officialFoodCodeCount?: number
  derivedFoodCodeCount?: number
  matchedFoodCodes?: string[]
  updatedAt?: Date
}

export type BalanceScoringTier = 'heuristic-3' | 'nutrition-5' | 'nutrition-7'

export interface Recipe {
  id?: number
  title: string
  recipeNumber: string
  device: DeviceType
  category: RecipeCategory
  baseServings: number
  totalWeightG: number
  ingredients: Ingredient[]
  steps: CookingStep[]
  totalTimeMinutes: number
  // T-21: Image fields
  imageUrl?: string
  thumbnailUrl?: string
  imageBlurHash?: string
  // T-23: CSV import fields
  sourceUrl?: string
  servings?: string
  calories?: string
  saltContent?: string
  cookingTime?: string
  rawSteps?: string[]
  // Phase F: future nutrition-based balance scoring support
  nutritionPerServing?: RecipeNutritionPerServing
  nutritionMeta?: RecipeNutritionMeta
  // Metadata fields
  updatedAt?: Date
  // True for recipes added by the user (AI import, manual entry) — backed up to Drive
  isUserAdded?: boolean
}



export interface StockItem {
  id?: number
  name: string
  inStock: boolean
  // T-27: Quantity fields
  quantity?: number
  unit?: string
  // Metadata fields
  updatedAt?: Date
}

export interface SaltResult {
  saltG: number
  soySauceMl: number
  misoG: number
}

export interface ScheduleEntry {
  name: string
  start: Date
  end: Date
  isDeviceStep: boolean
}

// AI parse status
export type ParseStatus = 'idle' | 'parsing' | 'previewing' | 'saving' | 'error'

// Multi-recipe schedule
export interface RecipeSchedule {
  recipeId: number
  recipeTitle: string
  colorIndex: number
  entries: ScheduleEntry[]
}

export interface Favorite {
  id?: number
  recipeId: number
  addedAt: Date
}

export interface UserNote {
  id?: number
  recipeId: number
  content: string
  updatedAt: Date
}

export interface ViewHistory {
  id?: number
  recipeId: number
  viewedAt: Date
}

export interface CalendarEventRecord {
  id?: number
  recipeId: number
  googleEventId: string
  calendarId: string
  eventType: 'meal' | 'shopping'
  startTime: Date
  endTime: Date
  createdAt: Date
}

export type SeasonalPriority = 'low' | 'medium' | 'high'
export type WeeklyMenuCostMode = 'saving' | 'ignore' | 'luxury'

export interface IngredientPrice {
  id?: number
  normalizedName: string
  unitBasis: 'g' | 'ml' | 'piece'
  tokyoAvgPrice: number
  sourceId: string
  sourceUrl: string
  confidence: number
  updatedAt: Date
}

export interface IngredientPriceSyncLog {
  id?: number
  startedAt: Date
  endedAt: Date
  status: 'success' | 'failed'
  updatedCount: number
  failedCount: number
  errorSummary: string
}

export interface IngredientSimilarityCache {
  id?: number
  name: string
  candidateName: string
  score: number
  updatedAt: Date
}

export interface WeatherCacheItem {
  id?: number
  date: string
  maxTempC: number
  minTempC: number
  precipitationMm: number
  updatedAt: Date
}

export interface IngredientFeatureRecord {
  id?: number
  recipeId: number
  confidence: number
  source: 'csv' | 'gemini' | 'estimated'
  updatedAt: Date
  seasonalityScore?: number
  priceSignalScore?: number
}

export interface UserPreferences {
  id?: number
  // Calendar settings
  familyCalendarId?: string
  mealStartHour: number
  mealStartMinute: number
  mealEndHour: number
  mealEndMinute: number
  defaultCalendarId?: string
  // Weekly menu settings
  weeklyMenuGenerationDay: number
  weeklyMenuGenerationHour: number
  weeklyMenuGenerationMinute: number
  shoppingListHour: number
  shoppingListMinute: number
  // Seasonal priority
  seasonalPriority: SeasonalPriority
  // Cost mode (price-aware weekly planning)
  weeklyMenuCostMode: WeeklyMenuCostMode
  // Luxury mode reward slots (variable count per week)
  weeklyMenuLuxuryRewardDays: number
  // Last sync timestamps
  lastPriceSyncAt?: Date
  lastWeatherSyncAt?: Date
  // User prompt
  userPrompt: string
  // Notification settings
  notifyWeeklyMenuDone: boolean
  notifyShoppingListDone: boolean
  // Cooking start notification
  cookingNotifyEnabled: boolean
  cookingNotifyHour: number
  cookingNotifyMinute: number
  // Desired meal time
  desiredMealHour: number
  desiredMealMinute: number
  weeklyMenuCostMode: WeeklyMenuCostMode
  weeklyMenuLuxuryRewardDays?: number
  weeklyBudgetYen?: number
  lastPriceSyncAt?: Date
  lastWeatherSyncAt?: Date
  // AI feature settings (Drive-backup eligible)
  geminiModelChat: string
  geminiModelRecipeImportText: string
  geminiModelRecipeImportUrl: string
  geminiModelImageIngredientExtract: string
  geminiModelStockRecipeSuggest: string
  geminiModelWeeklyMenuRefine: string
  geminiRetryEscalationForUrlAndImage: boolean
  geminiEstimatedDailyLimit: number
  // Phase 3: 個人最適気温パラメータ (T_opt)
  // 献立採用履歴から学習。デフォルト22°C。
  // 寒がりなら高め（例25）、暑がりなら低め（例18）に収束する。
  tOpt?: number
  // Meta
  updatedAt: Date
}

export type WeeklyMenuStatus = 'draft' | 'confirmed' | 'registered'

export interface WeeklyMenuItem {
  recipeId: number        // 主菜
  sideRecipeId?: number   // 副菜またはスープ
  mainServings?: number   // 主菜の最終人数
  sideServings?: number   // 副菜/スープの最終人数
  date: string            // 'YYYY-MM-DD'
  mealType: 'dinner'
  locked: boolean
}

export interface WeeklyMenu {
  id?: number
  weekStartDate: string   // 'YYYY-MM-DD' (Sunday start)
  items: WeeklyMenuItem[]
  shoppingList?: string
  status: WeeklyMenuStatus
  createdAt: Date
  updatedAt: Date
}

export type ViewState =
  | { view: 'list' }
  | { view: 'detail'; recipeId: number }
  | { view: 'ai-parse' }
  | { view: 'multi-schedule' }

function parseLegacyNutritionNumber(raw: unknown): number | undefined {
  if (typeof raw !== 'string') return undefined
  const normalized = raw
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
  const match = normalized.match(/(\d+(?:\.\d+)?)/)
  if (!match) return undefined
  const parsed = Number.parseFloat(match[1].replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : undefined
}

function estimateServingSizeG(totalWeightG: unknown, baseServings: unknown): number | undefined {
  if (typeof totalWeightG !== 'number' || !Number.isFinite(totalWeightG) || totalWeightG <= 0) return undefined
  if (typeof baseServings !== 'number' || !Number.isFinite(baseServings) || baseServings <= 0) return undefined
  return Math.round((totalWeightG / baseServings) * 10) / 10
}

// --- Dexie Database ---

class RecipeDB extends Dexie {
  recipes!: Table<Recipe, number>
  stock!: Table<StockItem, number>
  favorites!: Table<Favorite, number>
  userNotes!: Table<UserNote, number>
  viewHistory!: Table<ViewHistory, number>
  calendarEvents!: Table<CalendarEventRecord, number>
  userPreferences!: Table<UserPreferences, number>
  weeklyMenus!: Table<WeeklyMenu, number>
  ingredientPrices!: Table<IngredientPrice, number>
  ingredientPriceSyncLogs!: Table<IngredientPriceSyncLog, number>
  ingredientSimilarityCache!: Table<IngredientSimilarityCache, number>
  weatherCache!: Table<WeatherCacheItem, number>
  recipeFeatureMatrix!: Table<IngredientFeatureRecord, number>

  constructor() {
    super('RecipeDB')
    this.version(1).stores({
      recipes: '++id, title, device, category',
      stock: '++id, &name',
    })
    this.version(2).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device]',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
    })
    // T-21: Add imageUrl index
    this.version(3).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
    })
    // T-23/T-27: CSV import fields + stock quantity (data-only, no index changes needed)
    this.version(4).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
    })
    // v5: Add viewHistory table
    this.version(5).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
    })
    // v6: keep schema compatibility (legacy migration step)
    this.version(6).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
    })
    // v7: Add calendarEvents + userPreferences tables (Phase 4-5)
    this.version(7).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
    })
    // v8: Add weeklyMenus table (Phase 6)
    this.version(8).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
      weeklyMenus: '++id, weekStartDate',
    })
    // v9: Category names migration
    this.version(9).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
      weeklyMenus: '++id, weekStartDate',
    }).upgrade(async tx => {
      // Migrate existing recipes to use new category names
      await tx.table('recipes').toCollection().modify(recipe => {
        // We typecast since TypeScript check uses the current type
        const migratable = recipe as { category?: string }
        if (migratable.category === 'ご飯もの') {
          migratable.category = '一品料理'
        } else if (migratable.category === 'デザート') {
          migratable.category = 'スイーツ'
        }
      })
    })
    // v10: Backfill structured nutrition fields from legacy CSV string columns
    this.version(10).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
      weeklyMenus: '++id, weekStartDate',
    }).upgrade(async (tx) => {
      await tx.table('recipes').toCollection().modify((recipe) => {
        const migratable = recipe as Recipe & {
          calories?: string
          saltContent?: string
        }

        const nutrition = { ...(migratable.nutritionPerServing ?? {}) }
        let changed = false

        if (typeof nutrition.servingSizeG !== 'number') {
          const servingSizeG = estimateServingSizeG(migratable.totalWeightG, migratable.baseServings)
          if (typeof servingSizeG === 'number') {
            nutrition.servingSizeG = servingSizeG
            changed = true
          }
        }

        if (typeof nutrition.energyKcal !== 'number') {
          const energy = parseLegacyNutritionNumber(migratable.calories)
          if (typeof energy === 'number') {
            nutrition.energyKcal = energy
            changed = true
          }
        }

        if (typeof nutrition.saltEquivalentG !== 'number' && typeof nutrition.sodiumMg !== 'number') {
          const saltValue = parseLegacyNutritionNumber(migratable.saltContent)
          if (typeof saltValue === 'number') {
            const isMg = typeof migratable.saltContent === 'string' && /mg/i.test(migratable.saltContent)
            if (isMg) nutrition.sodiumMg = saltValue
            else nutrition.saltEquivalentG = saltValue
            changed = true
          }
        }

        if (!changed) return
        migratable.nutritionPerServing = nutrition

        const meta = migratable.nutritionMeta ?? {}
        if (!meta.source) meta.source = 'estimated'
        if (typeof meta.confidence !== 'number') meta.confidence = 0.45
        if (typeof meta.schemaVersion !== 'number') meta.schemaVersion = 1
        if (!meta.updatedAt) meta.updatedAt = new Date()
        migratable.nutritionMeta = meta
      })
    })
    // v11: Estimate full nutrition (PFC + 7段階 micronutrients) for all recipes
    // using ingredient-based estimation with Japanese Food Composition Table 2020.
    // Preserves existing CSV-parsed energyKcal / saltEquivalentG when present.
    this.version(11).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
      weeklyMenus: '++id, weekStartDate',
    }).upgrade(async (tx) => {
      // Dynamic import: only loaded during this one-time migration, excluded from the main bundle
      const { estimateRecipeNutrition } = await import('../utils/nutritionEstimator')
      await tx.table('recipes').toCollection().modify((recipe) => {
        const r = recipe as Recipe
        const existing = r.nutritionPerServing ?? {}

        const estimated = estimateRecipeNutrition(r)

        // Merge: existing CSV-parsed fields take priority over estimates
        const merged: RecipeNutritionPerServing = {
          servingSizeG: existing.servingSizeG ?? estimated.servingSizeG,
          energyKcal: existing.energyKcal ?? estimated.energyKcal,
          proteinG: existing.proteinG ?? estimated.proteinG,
          fatG: existing.fatG ?? estimated.fatG,
          carbG: existing.carbG ?? estimated.carbG,
          saltEquivalentG: existing.saltEquivalentG ?? estimated.saltEquivalentG,
          sodiumMg: existing.sodiumMg ?? estimated.sodiumMg,
          fiberG: existing.fiberG ?? estimated.fiberG,
          sugarG: existing.sugarG ?? estimated.sugarG,
          saturatedFatG: existing.saturatedFatG ?? estimated.saturatedFatG,
          potassiumMg: existing.potassiumMg ?? estimated.potassiumMg,
          calciumMg: existing.calciumMg ?? estimated.calciumMg,
          ironMg: existing.ironMg ?? estimated.ironMg,
          vitaminCMg: existing.vitaminCMg ?? estimated.vitaminCMg,
        }

        r.nutritionPerServing = merged
        r.nutritionMeta = {
          source: r.nutritionMeta?.source === 'jsonld' || r.nutritionMeta?.source === 'gemini'
            ? r.nutritionMeta.source
            : 'estimated',
          confidence: r.nutritionMeta?.confidence ?? 0.35,
          schemaVersion: 1,
          updatedAt: new Date(),
        }
      })
    })
    // v12: Upgrade estimated nutrition metadata with detailed diagnostics and
    // reference dataset tracking for Japanese Food Composition Table 2020 (8th).
    this.version(12).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
      weeklyMenus: '++id, weekStartDate',
    }).upgrade(async (tx) => {
      const {
        estimateRecipeNutritionDetailed,
        resolveNutritionMetaConfidence,
      } = await import('../utils/nutritionEstimator')
      const { NUTRITION_REFERENCE } = await import('../data/nutritionLookup')
      await tx.table('recipes').toCollection().modify((recipe) => {
        const r = recipe as Recipe
        const existing = r.nutritionPerServing ?? {}
        const { nutrition: estimated, diagnostics } = estimateRecipeNutritionDetailed(r)

        r.nutritionPerServing = {
          servingSizeG: existing.servingSizeG ?? estimated.servingSizeG,
          energyKcal: existing.energyKcal ?? estimated.energyKcal,
          proteinG: existing.proteinG ?? estimated.proteinG,
          fatG: existing.fatG ?? estimated.fatG,
          carbG: existing.carbG ?? estimated.carbG,
          saltEquivalentG: existing.saltEquivalentG ?? estimated.saltEquivalentG,
          sodiumMg: existing.sodiumMg ?? estimated.sodiumMg,
          fiberG: existing.fiberG ?? estimated.fiberG,
          sugarG: existing.sugarG ?? estimated.sugarG,
          saturatedFatG: existing.saturatedFatG ?? estimated.saturatedFatG,
          potassiumMg: existing.potassiumMg ?? estimated.potassiumMg,
          calciumMg: existing.calciumMg ?? estimated.calciumMg,
          ironMg: existing.ironMg ?? estimated.ironMg,
          vitaminCMg: existing.vitaminCMg ?? estimated.vitaminCMg,
        }

        r.nutritionMeta = {
          source: r.nutritionMeta?.source === 'jsonld' || r.nutritionMeta?.source === 'gemini'
            ? r.nutritionMeta.source
            : 'estimated',
          confidence: resolveNutritionMetaConfidence(
            r.nutritionMeta?.source,
            r.nutritionMeta?.confidence,
            diagnostics,
          ),
          schemaVersion: 3,
          referenceDataset: NUTRITION_REFERENCE.dataset,
          referenceLabel: NUTRITION_REFERENCE.label,
          estimatorVersion: NUTRITION_REFERENCE.estimatorVersion,
          totalIngredientCount: diagnostics.totalIngredientCount,
          matchedIngredientCount: diagnostics.matchedIngredientCount,
          ingredientMatchRatio: diagnostics.ingredientMatchRatio,
          matchedWeightRatio: diagnostics.matchedWeightRatio,
          usedFallback: diagnostics.usedFallback,
          lowConfidence: diagnostics.lowConfidence,
          officialFoodCodeCount: diagnostics.officialFoodCodeCount,
          derivedFoodCodeCount: diagnostics.derivedFoodCodeCount,
          matchedFoodCodes: diagnostics.matchedFoodCodes,
          updatedAt: new Date(),
        }
      })
    })
    // v13: Re-estimate estimated/unknown nutrition rows when estimator version changes.
    this.version(13).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
      weeklyMenus: '++id, weekStartDate',
    }).upgrade(async (tx) => {
      const {
        estimateRecipeNutritionDetailed,
        deriveEstimationConfidence,
      } = await import('../utils/nutritionEstimator')
      const { NUTRITION_REFERENCE } = await import('../data/nutritionLookup')
      await tx.table('recipes').toCollection().modify((recipe) => {
        const r = recipe as Recipe
        const source = r.nutritionMeta?.source
        const isEstimatedOrUnknown = !source || source === 'estimated'
        if (!isEstimatedOrUnknown) return

        const schemaVersion = typeof r.nutritionMeta?.schemaVersion === 'number'
          ? r.nutritionMeta.schemaVersion
          : 0
        const estimatorVersion = typeof r.nutritionMeta?.estimatorVersion === 'string'
          ? r.nutritionMeta.estimatorVersion
          : undefined
        const alreadyCurrent =
          schemaVersion >= 3 &&
          estimatorVersion === NUTRITION_REFERENCE.estimatorVersion
        if (alreadyCurrent) return

        const existing = r.nutritionPerServing ?? {}
        const { nutrition: estimated, diagnostics } = estimateRecipeNutritionDetailed(r)

        r.nutritionPerServing = {
          servingSizeG: existing.servingSizeG ?? estimated.servingSizeG,
          energyKcal: existing.energyKcal ?? estimated.energyKcal,
          proteinG: existing.proteinG ?? estimated.proteinG,
          fatG: existing.fatG ?? estimated.fatG,
          carbG: existing.carbG ?? estimated.carbG,
          saltEquivalentG: existing.saltEquivalentG ?? estimated.saltEquivalentG,
          sodiumMg: existing.sodiumMg ?? estimated.sodiumMg,
          fiberG: existing.fiberG ?? estimated.fiberG,
          sugarG: existing.sugarG ?? estimated.sugarG,
          saturatedFatG: existing.saturatedFatG ?? estimated.saturatedFatG,
          potassiumMg: existing.potassiumMg ?? estimated.potassiumMg,
          calciumMg: existing.calciumMg ?? estimated.calciumMg,
          ironMg: existing.ironMg ?? estimated.ironMg,
          vitaminCMg: existing.vitaminCMg ?? estimated.vitaminCMg,
        }

        r.nutritionMeta = {
          source: 'estimated',
          confidence: deriveEstimationConfidence(diagnostics),
          schemaVersion: 3,
          referenceDataset: NUTRITION_REFERENCE.dataset,
          referenceLabel: NUTRITION_REFERENCE.label,
          estimatorVersion: NUTRITION_REFERENCE.estimatorVersion,
          totalIngredientCount: diagnostics.totalIngredientCount,
          matchedIngredientCount: diagnostics.matchedIngredientCount,
          ingredientMatchRatio: diagnostics.ingredientMatchRatio,
          matchedWeightRatio: diagnostics.matchedWeightRatio,
          usedFallback: diagnostics.usedFallback,
          lowConfidence: diagnostics.lowConfidence,
          officialFoodCodeCount: diagnostics.officialFoodCodeCount,
          derivedFoodCodeCount: diagnostics.derivedFoodCodeCount,
          matchedFoodCodes: diagnostics.matchedFoodCodes,
          updatedAt: new Date(),
        }
      })
    })

    // v14: Add price/weather/feature tables for weekly menu optimization
    this.version(14).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
      weeklyMenus: '++id, weekStartDate',
      ingredientPrices: '++id, &normalizedName, updatedAt',
      ingredientPriceSyncLogs: '++id, startedAt, status',
      ingredientSimilarityCache: '++id, name, candidateName, score',
      weatherCache: '++id, &date, updatedAt',
    }).upgrade(async (tx) => {
      await tx.table('userPreferences').toCollection().modify((record) => {
        const prefs = record as UserPreferences
        if (!prefs.weeklyMenuCostMode) prefs.weeklyMenuCostMode = 'ignore'
      })
    })

    // v15: Add recipeFeatureMatrix for Gemini confidence floor and price/seasonality signals
    this.version(15).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl',
      stock: '++id, &name, inStock',
      favorites: '++id, &recipeId, addedAt',
      userNotes: '++id, &recipeId, updatedAt',
      viewHistory: '++id, recipeId, viewedAt',
      calendarEvents: '++id, recipeId, googleEventId',
      userPreferences: '++id',
      weeklyMenus: '++id, weekStartDate',
      ingredientPrices: '++id, &normalizedName, updatedAt',
      ingredientPriceSyncLogs: '++id, startedAt, status',
      ingredientSimilarityCache: '++id, name, candidateName, score',
      weatherCache: '++id, &date, updatedAt',
      recipeFeatureMatrix: '++id, &recipeId, confidence, source',
    })
  }
}

export const db = new RecipeDB()
