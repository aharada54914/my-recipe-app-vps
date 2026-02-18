/**
 * Conversion utilities between Dexie (camelCase) and Supabase (snake_case).
 * Each table has toCloud() and fromCloud() converters.
 */

import type { Recipe, StockItem, Favorite, UserNote, ViewHistory, CalendarEventRecord, UserPreferences } from '../db/db'
import type { Database } from '../lib/database.types'

// --- Type aliases for brevity ---
type RecipeRow = Database['public']['Tables']['recipes']['Row']
type RecipeInsert = Database['public']['Tables']['recipes']['Insert']
type StockRow = Database['public']['Tables']['stock']['Row']
type StockInsert = Database['public']['Tables']['stock']['Insert']
type FavoriteRow = Database['public']['Tables']['favorites']['Row']
type FavoriteInsert = Database['public']['Tables']['favorites']['Insert']
type UserNoteRow = Database['public']['Tables']['user_notes']['Row']
type UserNoteInsert = Database['public']['Tables']['user_notes']['Insert']
type ViewHistoryRow = Database['public']['Tables']['view_history']['Row']
type ViewHistoryInsert = Database['public']['Tables']['view_history']['Insert']
type CalendarEventRow = Database['public']['Tables']['calendar_events']['Row']
type CalendarEventInsert = Database['public']['Tables']['calendar_events']['Insert']
type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row']
type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert']

// ============================================================
// recipes
// ============================================================

export function recipeToCloud(r: Recipe, userId: string): RecipeInsert {
  return {
    id: r.supabaseId ?? undefined,
    user_id: userId,
    title: r.title,
    recipe_number: r.recipeNumber,
    device: r.device,
    category: r.category,
    base_servings: r.baseServings,
    total_weight_g: r.totalWeightG,
    ingredients: r.ingredients,
    steps: r.steps,
    total_time_minutes: r.totalTimeMinutes,
    image_url: r.imageUrl ?? null,
    thumbnail_url: r.thumbnailUrl ?? null,
    image_blur_hash: r.imageBlurHash ?? null,
    source_url: r.sourceUrl ?? null,
    servings: r.servings ?? null,
    calories: r.calories ?? null,
    salt_content: r.saltContent ?? null,
    cooking_time: r.cookingTime ?? null,
    raw_steps: r.rawSteps ?? null,
  }
}

export function recipeFromCloud(row: RecipeRow): Omit<Recipe, 'id'> {
  return {
    title: row.title,
    recipeNumber: row.recipe_number,
    device: row.device as Recipe['device'],
    category: row.category as Recipe['category'],
    baseServings: row.base_servings,
    totalWeightG: Number(row.total_weight_g),
    ingredients: row.ingredients as Recipe['ingredients'],
    steps: row.steps as Recipe['steps'],
    totalTimeMinutes: row.total_time_minutes,
    imageUrl: row.image_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    imageBlurHash: row.image_blur_hash ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    servings: row.servings ?? undefined,
    calories: row.calories ?? undefined,
    saltContent: row.salt_content ?? undefined,
    cookingTime: row.cooking_time ?? undefined,
    rawSteps: row.raw_steps as string[] | undefined,
    supabaseId: row.id,
    updatedAt: new Date(row.updated_at),
  }
}

// ============================================================
// stock
// ============================================================

export function stockToCloud(item: StockItem, userId: string): StockInsert {
  return {
    id: item.supabaseId ?? undefined,
    user_id: userId,
    name: item.name,
    in_stock: item.inStock,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
  }
}

export function stockFromCloud(row: StockRow): Omit<StockItem, 'id'> {
  return {
    name: row.name,
    inStock: row.in_stock,
    quantity: row.quantity != null ? Number(row.quantity) : undefined,
    unit: row.unit ?? undefined,
    supabaseId: row.id,
    updatedAt: new Date(row.updated_at),
  }
}

// ============================================================
// favorites
// ============================================================

export function favoriteToCloud(
  fav: Favorite,
  userId: string,
  recipeSupabaseId: string,
): FavoriteInsert {
  return {
    id: fav.supabaseId ?? undefined,
    user_id: userId,
    recipe_id: recipeSupabaseId,
    added_at: fav.addedAt.toISOString(),
  }
}

export function favoriteFromCloud(
  row: FavoriteRow,
  localRecipeId: number,
): Omit<Favorite, 'id'> {
  return {
    recipeId: localRecipeId,
    addedAt: new Date(row.added_at),
    supabaseId: row.id,
  }
}

// ============================================================
// userNotes
// ============================================================

export function userNoteToCloud(
  note: UserNote,
  userId: string,
  recipeSupabaseId: string,
): UserNoteInsert {
  return {
    id: note.supabaseId ?? undefined,
    user_id: userId,
    recipe_id: recipeSupabaseId,
    content: note.content,
    updated_at: note.updatedAt.toISOString(),
  }
}

export function userNoteFromCloud(
  row: UserNoteRow,
  localRecipeId: number,
): Omit<UserNote, 'id'> {
  return {
    recipeId: localRecipeId,
    content: row.content,
    updatedAt: new Date(row.updated_at),
    supabaseId: row.id,
  }
}

// ============================================================
// viewHistory
// ============================================================

export function viewHistoryToCloud(
  vh: ViewHistory,
  userId: string,
  recipeSupabaseId: string,
): ViewHistoryInsert {
  return {
    id: vh.supabaseId ?? undefined,
    user_id: userId,
    recipe_id: recipeSupabaseId,
    viewed_at: vh.viewedAt.toISOString(),
  }
}

export function viewHistoryFromCloud(
  row: ViewHistoryRow,
  localRecipeId: number,
): Omit<ViewHistory, 'id'> {
  return {
    recipeId: localRecipeId,
    viewedAt: new Date(row.viewed_at),
    supabaseId: row.id,
  }
}

// ============================================================
// calendarEvents
// ============================================================

export function calendarEventToCloud(
  item: CalendarEventRecord,
  userId: string,
  recipeSupabaseId: string,
): CalendarEventInsert {
  return {
    id: item.supabaseId ?? undefined,
    user_id: userId,
    recipe_id: recipeSupabaseId,
    google_event_id: item.googleEventId,
    calendar_id: item.calendarId,
    event_type: item.eventType,
    start_time: item.startTime.toISOString(),
    end_time: item.endTime.toISOString(),
  }
}

export function calendarEventFromCloud(
  row: CalendarEventRow,
  localRecipeId: number,
): Omit<CalendarEventRecord, 'id'> {
  return {
    recipeId: localRecipeId,
    googleEventId: row.google_event_id,
    calendarId: row.calendar_id,
    eventType: row.event_type as CalendarEventRecord['eventType'],
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    createdAt: new Date(row.created_at),
    supabaseId: row.id,
  }
}

// ============================================================
// userPreferences
// ============================================================

export function userPreferencesToCloud(
  prefs: UserPreferences,
  userId: string,
): UserPreferencesInsert {
  return {
    id: prefs.supabaseId ?? undefined,
    user_id: userId,
    family_calendar_id: prefs.familyCalendarId ?? null,
    meal_start_hour: prefs.mealStartHour,
    meal_start_minute: prefs.mealStartMinute,
    meal_end_hour: prefs.mealEndHour,
    meal_end_minute: prefs.mealEndMinute,
    default_calendar_id: prefs.defaultCalendarId ?? null,
    weekly_menu_generation_day: prefs.weeklyMenuGenerationDay,
    weekly_menu_generation_hour: prefs.weeklyMenuGenerationHour,
    weekly_menu_generation_minute: prefs.weeklyMenuGenerationMinute,
    shopping_list_hour: prefs.shoppingListHour,
    shopping_list_minute: prefs.shoppingListMinute,
    seasonal_priority: prefs.seasonalPriority,
    user_prompt: prefs.userPrompt,
    notify_weekly_menu_done: prefs.notifyWeeklyMenuDone,
    notify_shopping_list_done: prefs.notifyShoppingListDone,
    cooking_notify_enabled: prefs.cookingNotifyEnabled,
    cooking_notify_hour: prefs.cookingNotifyHour,
    cooking_notify_minute: prefs.cookingNotifyMinute,
    desired_meal_hour: prefs.desiredMealHour,
    desired_meal_minute: prefs.desiredMealMinute,
  }
}

export function userPreferencesFromCloud(
  row: UserPreferencesRow,
): Omit<UserPreferences, 'id'> {
  return {
    familyCalendarId: row.family_calendar_id ?? undefined,
    mealStartHour: row.meal_start_hour,
    mealStartMinute: row.meal_start_minute,
    mealEndHour: row.meal_end_hour,
    mealEndMinute: row.meal_end_minute,
    defaultCalendarId: row.default_calendar_id ?? undefined,
    weeklyMenuGenerationDay: row.weekly_menu_generation_day,
    weeklyMenuGenerationHour: row.weekly_menu_generation_hour,
    weeklyMenuGenerationMinute: row.weekly_menu_generation_minute,
    shoppingListHour: row.shopping_list_hour,
    shoppingListMinute: row.shopping_list_minute,
    seasonalPriority: row.seasonal_priority as UserPreferences['seasonalPriority'],
    userPrompt: row.user_prompt,
    notifyWeeklyMenuDone: row.notify_weekly_menu_done,
    notifyShoppingListDone: row.notify_shopping_list_done,
    cookingNotifyEnabled: row.cooking_notify_enabled,
    cookingNotifyHour: row.cooking_notify_hour,
    cookingNotifyMinute: row.cooking_notify_minute,
    desiredMealHour: row.desired_meal_hour,
    desiredMealMinute: row.desired_meal_minute,
    updatedAt: new Date(row.updated_at),
    supabaseId: row.id,
  }
}
