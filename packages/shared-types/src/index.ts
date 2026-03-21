// ============================================
// Shared types for kitchen app monorepo
// ============================================

import { z } from 'zod'

// --- Device & Category Types ---

export const DeviceTypeSchema = z.enum(['hotcook', 'healsio', 'manual'])
export type DeviceType = z.infer<typeof DeviceTypeSchema>

export const RecipeCategorySchema = z.enum(['すべて', '主菜', '副菜', 'スープ', '一品料理', 'スイーツ'])
export type RecipeCategory = z.infer<typeof RecipeCategorySchema>

export const IngredientCategorySchema = z.enum(['main', 'sub'])
export type IngredientCategory = z.infer<typeof IngredientCategorySchema>

// --- Ingredient ---

export const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.number(), z.string()]),
  unit: z.string(),
  category: IngredientCategorySchema.catch('main'),
  optional: z.boolean().optional(),
})
export type Ingredient = z.infer<typeof IngredientSchema>

// --- Cooking Step ---

export const CookingStepSchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.number(),
  isDeviceStep: z.boolean().optional(),
})
export type CookingStep = z.infer<typeof CookingStepSchema>

// --- Nutrition ---

export const NutritionPerServingSchema = z.object({
  servingSizeG: z.number().optional(),
  energyKcal: z.number().optional(),
  proteinG: z.number().optional(),
  fatG: z.number().optional(),
  carbG: z.number().optional(),
  sodiumMg: z.number().optional(),
  saltEquivalentG: z.number().optional(),
  fiberG: z.number().optional(),
  sugarG: z.number().optional(),
  saturatedFatG: z.number().optional(),
  potassiumMg: z.number().optional(),
  calciumMg: z.number().optional(),
  ironMg: z.number().optional(),
  vitaminCMg: z.number().optional(),
})
export type NutritionPerServing = z.infer<typeof NutritionPerServingSchema>

// --- Recipe ---

export const RecipeSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(1),
  recipeNumber: z.string(),
  device: DeviceTypeSchema,
  category: RecipeCategorySchema,
  baseServings: z.number().int().positive(),
  totalWeightG: z.number(),
  ingredients: z.array(IngredientSchema),
  steps: z.array(CookingStepSchema),
  totalTimeMinutes: z.number(),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  nutritionPerServing: NutritionPerServingSchema.optional(),
  isUserAdded: z.boolean().optional(),
})
export type Recipe = z.infer<typeof RecipeSchema>

// --- Weekly Menu ---

export const WeeklyMenuStatusSchema = z.enum(['draft', 'confirmed', 'registered'])
export type WeeklyMenuStatus = z.infer<typeof WeeklyMenuStatusSchema>

export const WeeklyMenuItemSchema = z.object({
  recipeId: z.number(),
  sideRecipeId: z.number().optional(),
  mainServings: z.number().optional(),
  sideServings: z.number().optional(),
  date: z.string(),
  mealType: z.literal('dinner'),
  locked: z.boolean(),
})
export type WeeklyMenuItem = z.infer<typeof WeeklyMenuItemSchema>

export const WeeklyMenuSchema = z.object({
  id: z.number().optional(),
  weekStartDate: z.string(),
  items: z.array(WeeklyMenuItemSchema),
  shoppingList: z.string().optional(),
  status: WeeklyMenuStatusSchema,
})
export type WeeklyMenu = z.infer<typeof WeeklyMenuSchema>

// --- Stock ---

export const StockItemSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  inStock: z.boolean(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
})
export type StockItem = z.infer<typeof StockItemSchema>

// --- Favorite ---

export const FavoriteSchema = z.object({
  id: z.number().optional(),
  recipeId: z.number(),
  addedAt: z.coerce.date(),
})
export type Favorite = z.infer<typeof FavoriteSchema>

// --- User Preferences (subset for API) ---

export const UserPreferencesSchema = z.object({
  appearanceMode: z.enum(['system', 'light', 'dark']).default('system'),
  familyCalendarId: z.string().optional(),
  mealStartHour: z.number().default(18),
  mealStartMinute: z.number().default(0),
  mealEndHour: z.number().default(19),
  mealEndMinute: z.number().default(0),
  weeklyMenuGenerationDay: z.number().default(0),
  seasonalPriority: z.enum(['low', 'medium', 'high']).default('medium'),
  weeklyMenuCostMode: z.enum(['saving', 'ignore', 'luxury']).default('ignore'),
  userPrompt: z.string().default(''),
  notifyWeeklyMenuDone: z.boolean().default(true),
  notifyShoppingListDone: z.boolean().default(true),
})
export type UserPreferences = z.infer<typeof UserPreferencesSchema>

// --- API Response ---

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}

// --- Consultation ---

export const ConsultationRequestSchema = z.object({
  message: z.string().min(1).max(500),
  context: z.object({
    todayMenu: WeeklyMenuItemSchema.optional(),
    stockItems: z.array(StockItemSchema).optional(),
    preferences: UserPreferencesSchema.optional(),
  }).optional(),
})
export type ConsultationRequest = z.infer<typeof ConsultationRequestSchema>

// --- Shopping List ---

export const ShoppingCategorySchema = z.enum([
  '野菜・果物',
  '肉類',
  '魚介類',
  '乳製品・卵',
  '調味料',
  '冷凍食品',
  '乾物・缶詰',
  '豆腐・大豆製品',
  'その他',
])
export type ShoppingCategory = z.infer<typeof ShoppingCategorySchema>

export interface ShoppingListItem {
  name: string
  quantity: string
  category: ShoppingCategory
}

export interface SortedShoppingList {
  weekStartDate: string
  categories: Array<{
    category: ShoppingCategory
    items: ShoppingListItem[]
  }>
}

export const RegisterToCalendarRequestSchema = z.object({
  weekStartDate: z.string(),
  scheduledDate: z.string(),
  scheduledTime: z.string().optional(),
})
export type RegisterToCalendarRequest = z.infer<typeof RegisterToCalendarRequestSchema>
