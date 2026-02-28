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
  // AI feature settings (Drive-backup eligible)
  geminiModelChat: string
  geminiModelRecipeImportText: string
  geminiModelRecipeImportUrl: string
  geminiModelImageIngredientExtract: string
  geminiModelStockRecipeSuggest: string
  geminiModelWeeklyMenuRefine: string
  geminiRetryEscalationForUrlAndImage: boolean
  geminiEstimatedDailyLimit: number
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
  }
}

export const db = new RecipeDB()
