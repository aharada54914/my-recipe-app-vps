/**
 * Conversion utilities between Dexie (camelCase) and Supabase (snake_case).
 * Each table has toCloud() and fromCloud() converters.
 */

import type { Recipe, StockItem, Favorite, UserNote, ViewHistory } from '../db/db'
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
