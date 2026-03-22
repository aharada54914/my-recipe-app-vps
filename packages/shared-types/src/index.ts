// ============================================
// Shared types for kitchen app monorepo
// ============================================

import { z } from 'zod'

// --- Device & Category Types ---

export const DeviceTypeSchema = z.enum(['hotcook', 'healsio', 'manual'])
export type DeviceType = z.infer<typeof DeviceTypeSchema>

export const RecipeCategorySchema = z.enum(['すべて', '主菜', '副菜', 'スープ', '一品料理', 'スイーツ'])
export type RecipeCategory = z.infer<typeof RecipeCategorySchema>
export const EditableRecipeCategorySchema = z.enum(['主菜', '副菜', 'スープ', '一品料理', 'スイーツ'])
export type EditableRecipeCategory = z.infer<typeof EditableRecipeCategorySchema>

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

// --- User Preferences ---

const OptionalStringSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().optional())

const OptionalDateSchema = z.preprocess((value) => {
  if (value == null || value === '') return undefined
  return value
}, z.coerce.date().optional())

const UpdatedAtSchema = z.preprocess((value) => {
  if (value == null || value === '') return new Date()
  return value
}, z.coerce.date())

export const USER_PREFERENCES_DEFAULTS = {
  appearanceMode: 'system',
  familyCalendarId: undefined,
  mealStartHour: 18,
  mealStartMinute: 0,
  mealEndHour: 19,
  mealEndMinute: 0,
  defaultCalendarId: undefined,
  weeklyMenuGenerationDay: 5,
  weeklyMenuGenerationHour: 18,
  weeklyMenuGenerationMinute: 0,
  shoppingListHour: 19,
  shoppingListMinute: 0,
  seasonalPriority: 'low',
  weeklyMenuCostMode: 'ignore',
  weeklyMenuLuxuryRewardDays: 2,
  lastPriceSyncAt: undefined,
  lastWeatherSyncAt: undefined,
  userPrompt: '',
  notifyWeeklyMenuDone: true,
  notifyShoppingListDone: true,
  cookingNotifyEnabled: true,
  cookingNotifyHour: 16,
  cookingNotifyMinute: 0,
  desiredMealHour: 18,
  desiredMealMinute: 0,
  tOpt: 22,
  weeklyBudgetYen: undefined,
  geminiModelChat: 'gemini-2.0-flash-lite',
  geminiModelRecipeImportText: 'gemini-2.0-flash-lite',
  geminiModelRecipeImportUrl: 'gemini-2.0-flash-lite',
  geminiModelImageIngredientExtract: 'gemini-2.0-flash',
  geminiModelStockRecipeSuggest: 'gemini-2.0-flash',
  geminiModelWeeklyMenuRefine: 'gemini-2.0-flash-lite',
  geminiRetryEscalationForUrlAndImage: true,
  geminiEstimatedDailyLimit: 40,
} as const

export const UserPreferencesSchema = z.object({
  appearanceMode: z.enum(['system', 'light', 'dark']).default(USER_PREFERENCES_DEFAULTS.appearanceMode),
  familyCalendarId: OptionalStringSchema,
  mealStartHour: z.number().int().min(0).max(23).default(USER_PREFERENCES_DEFAULTS.mealStartHour),
  mealStartMinute: z.number().int().min(0).max(59).default(USER_PREFERENCES_DEFAULTS.mealStartMinute),
  mealEndHour: z.number().int().min(0).max(23).default(USER_PREFERENCES_DEFAULTS.mealEndHour),
  mealEndMinute: z.number().int().min(0).max(59).default(USER_PREFERENCES_DEFAULTS.mealEndMinute),
  defaultCalendarId: OptionalStringSchema,
  weeklyMenuGenerationDay: z.number().int().min(0).max(6).default(USER_PREFERENCES_DEFAULTS.weeklyMenuGenerationDay),
  weeklyMenuGenerationHour: z.number().int().min(0).max(23).default(USER_PREFERENCES_DEFAULTS.weeklyMenuGenerationHour),
  weeklyMenuGenerationMinute: z.number().int().min(0).max(59).default(USER_PREFERENCES_DEFAULTS.weeklyMenuGenerationMinute),
  shoppingListHour: z.number().int().min(0).max(23).default(USER_PREFERENCES_DEFAULTS.shoppingListHour),
  shoppingListMinute: z.number().int().min(0).max(59).default(USER_PREFERENCES_DEFAULTS.shoppingListMinute),
  seasonalPriority: z.enum(['low', 'medium', 'high']).default(USER_PREFERENCES_DEFAULTS.seasonalPriority),
  weeklyMenuCostMode: z.enum(['saving', 'ignore', 'luxury']).default(USER_PREFERENCES_DEFAULTS.weeklyMenuCostMode),
  weeklyMenuLuxuryRewardDays: z.number().int().min(1).max(7).default(USER_PREFERENCES_DEFAULTS.weeklyMenuLuxuryRewardDays),
  lastPriceSyncAt: OptionalDateSchema,
  lastWeatherSyncAt: OptionalDateSchema,
  userPrompt: z.string().default(USER_PREFERENCES_DEFAULTS.userPrompt),
  notifyWeeklyMenuDone: z.boolean().default(USER_PREFERENCES_DEFAULTS.notifyWeeklyMenuDone),
  notifyShoppingListDone: z.boolean().default(USER_PREFERENCES_DEFAULTS.notifyShoppingListDone),
  cookingNotifyEnabled: z.boolean().default(USER_PREFERENCES_DEFAULTS.cookingNotifyEnabled),
  cookingNotifyHour: z.number().int().min(0).max(23).default(USER_PREFERENCES_DEFAULTS.cookingNotifyHour),
  cookingNotifyMinute: z.number().int().min(0).max(59).default(USER_PREFERENCES_DEFAULTS.cookingNotifyMinute),
  desiredMealHour: z.number().int().min(0).max(23).default(USER_PREFERENCES_DEFAULTS.desiredMealHour),
  desiredMealMinute: z.number().int().min(0).max(59).default(USER_PREFERENCES_DEFAULTS.desiredMealMinute),
  tOpt: z.number().min(-50).max(60).default(USER_PREFERENCES_DEFAULTS.tOpt),
  weeklyBudgetYen: z.number().int().positive().optional(),
  geminiModelChat: z.string().min(1).default(USER_PREFERENCES_DEFAULTS.geminiModelChat),
  geminiModelRecipeImportText: z.string().min(1).default(USER_PREFERENCES_DEFAULTS.geminiModelRecipeImportText),
  geminiModelRecipeImportUrl: z.string().min(1).default(USER_PREFERENCES_DEFAULTS.geminiModelRecipeImportUrl),
  geminiModelImageIngredientExtract: z.string().min(1).default(USER_PREFERENCES_DEFAULTS.geminiModelImageIngredientExtract),
  geminiModelStockRecipeSuggest: z.string().min(1).default(USER_PREFERENCES_DEFAULTS.geminiModelStockRecipeSuggest),
  geminiModelWeeklyMenuRefine: z.string().min(1).default(USER_PREFERENCES_DEFAULTS.geminiModelWeeklyMenuRefine),
  geminiRetryEscalationForUrlAndImage: z.boolean().default(USER_PREFERENCES_DEFAULTS.geminiRetryEscalationForUrlAndImage),
  geminiEstimatedDailyLimit: z.number().int().min(1).max(9999).default(USER_PREFERENCES_DEFAULTS.geminiEstimatedDailyLimit),
  updatedAt: UpdatedAtSchema,
})
export type UserPreferences = z.infer<typeof UserPreferencesSchema>

export const EditableUserPreferencesSchema = z.object({
  appearanceMode: z.enum(['system', 'light', 'dark']).optional(),
  familyCalendarId: OptionalStringSchema,
  mealStartHour: z.number().int().min(0).max(23).optional(),
  mealStartMinute: z.number().int().min(0).max(59).optional(),
  mealEndHour: z.number().int().min(0).max(23).optional(),
  mealEndMinute: z.number().int().min(0).max(59).optional(),
  defaultCalendarId: OptionalStringSchema,
  weeklyMenuGenerationDay: z.number().int().min(0).max(6).optional(),
  weeklyMenuGenerationHour: z.number().int().min(0).max(23).optional(),
  weeklyMenuGenerationMinute: z.number().int().min(0).max(59).optional(),
  shoppingListHour: z.number().int().min(0).max(23).optional(),
  shoppingListMinute: z.number().int().min(0).max(59).optional(),
  seasonalPriority: z.enum(['low', 'medium', 'high']).optional(),
  weeklyMenuCostMode: z.enum(['saving', 'ignore', 'luxury']).optional(),
  weeklyMenuLuxuryRewardDays: z.number().int().min(1).max(7).optional(),
  userPrompt: z.string().optional(),
  notifyWeeklyMenuDone: z.boolean().optional(),
  notifyShoppingListDone: z.boolean().optional(),
  cookingNotifyEnabled: z.boolean().optional(),
  cookingNotifyHour: z.number().int().min(0).max(23).optional(),
  cookingNotifyMinute: z.number().int().min(0).max(59).optional(),
  desiredMealHour: z.number().int().min(0).max(23).optional(),
  desiredMealMinute: z.number().int().min(0).max(59).optional(),
  tOpt: z.number().min(-50).max(60).optional(),
  weeklyBudgetYen: z.number().int().positive().optional(),
  geminiModelChat: z.string().min(1).optional(),
  geminiModelRecipeImportText: z.string().min(1).optional(),
  geminiModelRecipeImportUrl: z.string().min(1).optional(),
  geminiModelImageIngredientExtract: z.string().min(1).optional(),
  geminiModelStockRecipeSuggest: z.string().min(1).optional(),
  geminiModelWeeklyMenuRefine: z.string().min(1).optional(),
  geminiRetryEscalationForUrlAndImage: z.boolean().optional(),
  geminiEstimatedDailyLimit: z.number().int().min(1).max(9999).optional(),
}).strict()
export type EditableUserPreferences = z.infer<typeof EditableUserPreferencesSchema>

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

// --- Discord Workflow ---

export const DiscordWorkflowSchema = z.enum([
  'recipe_import',
  'weekly_menu',
  'stock_photo',
  'kitchen_advice',
])
export type DiscordWorkflow = z.infer<typeof DiscordWorkflowSchema>

export const ConversationSessionStatusSchema = z.enum([
  'draft',
  'awaiting_user',
  'approved',
  'cancelled',
  'completed',
  'error',
])
export type ConversationSessionStatus = z.infer<typeof ConversationSessionStatusSchema>

export const RecipeImportDraftStatusSchema = z.enum([
  'draft',
  'needs_review',
  'approved',
  'persisted',
  'cancelled',
  'error',
])
export type RecipeImportDraftStatus = z.infer<typeof RecipeImportDraftStatusSchema>

export const RecipeImportReviewFieldSchema = z.enum([
  'title',
  'device',
  'category',
  'baseServings',
  'totalTimeMinutes',
  'nutritionPerServing',
])
export type RecipeImportReviewField = z.infer<typeof RecipeImportReviewFieldSchema>

export const DiscordChannelBindingSchema = z.object({
  guildId: z.string().min(1),
  workflow: DiscordWorkflowSchema,
  channelId: z.string().min(1),
})
export type DiscordChannelBinding = z.infer<typeof DiscordChannelBindingSchema>

export const ConversationSessionSchema = z.object({
  id: z.number().int().positive().optional(),
  workflow: DiscordWorkflowSchema,
  status: ConversationSessionStatusSchema,
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  threadId: z.string().min(1).optional(),
  discordUserId: z.string().min(1),
  requestedServings: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  approvedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
})
export type ConversationSession = z.infer<typeof ConversationSessionSchema>

export const RecipeImportDraftSchema = z.object({
  id: z.number().int().positive().optional(),
  sessionId: z.number().int().positive(),
  sourceUrl: z.string().url(),
  requestedServings: z.number().int().positive(),
  extractedRecipe: RecipeSchema.omit({ id: true }),
  reviewFields: z.array(RecipeImportReviewFieldSchema).default([]),
  status: RecipeImportDraftStatusSchema.default('draft'),
  createdRecipeId: z.number().int().positive().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
})
export type RecipeImportDraft = z.infer<typeof RecipeImportDraftSchema>

export const RecipeImportDraftSummarySchema = z.object({
  id: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  threadId: z.string().min(1).optional(),
  status: RecipeImportDraftStatusSchema,
  sourceUrl: z.string().url(),
  requestedServings: z.number().int().positive(),
  title: z.string().min(1),
  baseServings: z.number().int().positive(),
  device: DeviceTypeSchema,
  category: EditableRecipeCategorySchema,
  totalTimeMinutes: z.number().int().positive(),
  ingredientCount: z.number().int().nonnegative(),
  stepCount: z.number().int().nonnegative(),
  reviewFields: z.array(RecipeImportReviewFieldSchema).default([]),
  createdRecipeId: z.number().int().positive().optional(),
})
export type RecipeImportDraftSummary = z.infer<typeof RecipeImportDraftSummarySchema>

export const CreateDiscordRecipeImportDraftRequestSchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  threadId: z.string().min(1).optional(),
  discordUserId: z.string().min(1),
  requestedServings: z.number().int().positive(),
  url: z.string().url(),
})
export type CreateDiscordRecipeImportDraftRequest =
  z.infer<typeof CreateDiscordRecipeImportDraftRequestSchema>

export const UpdateDiscordRecipeImportDraftRequestSchema = z.object({
  title: z.string().min(1).optional(),
  device: DeviceTypeSchema.optional(),
  category: EditableRecipeCategorySchema.optional(),
  baseServings: z.number().int().positive().optional(),
  totalTimeMinutes: z.number().int().positive().optional(),
}).strict()
export type UpdateDiscordRecipeImportDraftRequest =
  z.infer<typeof UpdateDiscordRecipeImportDraftRequestSchema>
