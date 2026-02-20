import Dexie, { type Table } from 'dexie'

// --- Type Definitions ---

export type DeviceType = 'hotcook' | 'healsio' | 'manual'
export type IngredientCategory = 'main' | 'sub'
export type SaltMode = 0.6 | 0.8 | 1.2
export type RecipeCategory = 'すべて' | '主菜' | '副菜' | 'スープ' | 'ご飯もの' | 'デザート'
export type TabId = 'home' | 'menu' | 'gemini' | 'favorites' | 'history'

export interface Ingredient {
  name: string
  quantity: number
  unit: string
  category: IngredientCategory
  optional?: boolean
}

export interface CookingStep {
  name: string
  durationMinutes: number
  isDeviceStep?: boolean
}

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
  // Metadata fields
  updatedAt?: Date
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
  // Meta
  updatedAt: Date
}

export type WeeklyMenuStatus = 'draft' | 'confirmed' | 'registered'

export interface WeeklyMenuItem {
  recipeId: number        // 主菜
  sideRecipeId?: number   // 副菜またはスープ
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
  }
}

export const db = new RecipeDB()
