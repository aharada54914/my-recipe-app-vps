import Dexie, { type Table } from 'dexie'

// --- Type Definitions ---

export type DeviceType = 'hotcook' | 'healsio' | 'manual'
export type IngredientCategory = 'main' | 'sub'
export type SaltMode = 0.6 | 0.8 | 1.2
export type RecipeCategory = 'すべて' | '主菜' | '副菜' | 'スープ' | 'ご飯もの' | 'デザート'
export type TabId = 'search' | 'favorites' | 'stock' | 'history'

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
}

export interface StockItem {
  id?: number
  name: string
  inStock: boolean
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

export type ViewState =
  | { view: 'list' }
  | { view: 'detail'; recipeId: number }
  | { view: 'ai-parse' }
  | { view: 'multi-schedule' }

// --- Dexie Database ---

class RecipeDB extends Dexie {
  recipes!: Table<Recipe, number>
  stock!: Table<StockItem, number>

  constructor() {
    super('RecipeDB')
    this.version(1).stores({
      recipes: '++id, title, device, category',
      stock: '++id, &name',
    })
  }
}

export const db = new RecipeDB()
