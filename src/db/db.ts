import Dexie, { type Table } from 'dexie'

// --- Type Definitions ---

export type DeviceType = 'hotcook' | 'healsio' | 'manual'
export type IngredientCategory = 'main' | 'sub'
export type SaltMode = 0.6 | 0.8 | 1.2
export type RecipeCategory = 'すべて' | '主菜' | '副菜' | 'スープ' | 'ご飯もの' | 'デザート'
export type TabId = 'home' | 'search' | 'favorites' | 'stock' | 'history'

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
  // Cloud sync fields
  supabaseId?: string
  updatedAt?: Date
}

export interface StockItem {
  id?: number
  name: string
  inStock: boolean
  // T-27: Quantity fields
  quantity?: number
  unit?: string
  // Cloud sync fields
  supabaseId?: string
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
  supabaseId?: string
}

export interface UserNote {
  id?: number
  recipeId: number
  content: string
  updatedAt: Date
  supabaseId?: string
}

export interface ViewHistory {
  id?: number
  recipeId: number
  viewedAt: Date
  supabaseId?: string
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
    // v6: Add supabaseId for cloud sync
    this.version(6).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl, supabaseId',
      stock: '++id, &name, inStock, supabaseId',
      favorites: '++id, &recipeId, addedAt, supabaseId',
      userNotes: '++id, &recipeId, updatedAt, supabaseId',
      viewHistory: '++id, recipeId, viewedAt, supabaseId',
    })
  }
}

export const db = new RecipeDB()
