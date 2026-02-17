/**
 * Bidirectional sync engine between Dexie (local) and Supabase (cloud).
 *
 * Sync order (respects foreign-key dependencies):
 *   1. recipes  (referenced by favorites, userNotes, viewHistory)
 *   2. stock    (independent)
 *   3. favorites
 *   4. userNotes
 *   5. viewHistory
 *
 * Strategy: full-table sync (not differential) — data volumes are small.
 * Conflict resolution: last-write-wins based on updated_at / added_at.
 */

import { db, type Recipe, type StockItem, type Favorite, type UserNote, type ViewHistory } from '../db/db'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import {
  recipeToCloud, recipeFromCloud,
  stockToCloud, stockFromCloud,
  favoriteToCloud, favoriteFromCloud,
  userNoteToCloud, userNoteFromCloud,
  viewHistoryToCloud, viewHistoryFromCloud,
} from './syncConverters'

// --- Row type aliases for explicit typing ---
type RecipeRow = Database['public']['Tables']['recipes']['Row']
type StockRow = Database['public']['Tables']['stock']['Row']
type FavoriteRow = Database['public']['Tables']['favorites']['Row']
type UserNoteRow = Database['public']['Tables']['user_notes']['Row']
type ViewHistoryRow = Database['public']['Tables']['view_history']['Row']

export interface SyncResult {
  pushed: number
  pulled: number
  errors: string[]
}

/**
 * Run a full bidirectional sync for the authenticated user.
 */
export async function syncAll(userId: string): Promise<SyncResult> {
  if (!supabase) return { pushed: 0, pulled: 0, errors: ['Supabase not configured'] }

  const result: SyncResult = { pushed: 0, pulled: 0, errors: [] }

  try {
    const recipeResult = await syncRecipes(userId)
    result.pushed += recipeResult.pushed
    result.pulled += recipeResult.pulled

    const stockResult = await syncStock(userId)
    result.pushed += stockResult.pushed
    result.pulled += stockResult.pulled

    const recipeIdMap = await buildRecipeIdMap()

    const favResult = await syncFavorites(userId, recipeIdMap)
    result.pushed += favResult.pushed
    result.pulled += favResult.pulled

    const noteResult = await syncUserNotes(userId, recipeIdMap)
    result.pushed += noteResult.pushed
    result.pulled += noteResult.pulled

    const histResult = await syncViewHistory(userId, recipeIdMap)
    result.pushed += histResult.pushed
    result.pulled += histResult.pulled
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err))
  }

  return result
}

// ============================================================
// Recipe ID mapping
// ============================================================

interface RecipeIdMap {
  localToCloud: Map<number, string>
  cloudToLocal: Map<string, number>
}

async function buildRecipeIdMap(): Promise<RecipeIdMap> {
  const localToCloud = new Map<number, string>()
  const cloudToLocal = new Map<string, number>()

  await db.recipes.each((recipe) => {
    if (recipe.id != null && recipe.supabaseId) {
      localToCloud.set(recipe.id, recipe.supabaseId)
      cloudToLocal.set(recipe.supabaseId, recipe.id)
    }
  })

  return { localToCloud, cloudToLocal }
}

// ============================================================
// Recipes sync (user-created only)
// ============================================================

async function syncRecipes(userId: string): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0
  let pulled = 0

  // --- PUSH: local recipes without supabaseId (user-created via AI parser) ---
  const unsyncedRecipes = await db.recipes
    .filter((r) => !r.supabaseId && !!r.sourceUrl)
    .toArray()

  for (const recipe of unsyncedRecipes) {
    const cloudData = recipeToCloud(recipe, userId)
    delete (cloudData as Record<string, unknown>).id
    const { data, error } = await supabase!
      .from('recipes')
      .insert(cloudData)
      .select('id')
      .single<{ id: string }>()

    if (error || !data) continue
    await db.recipes.update(recipe.id!, { supabaseId: data.id, updatedAt: new Date() })
    pushed++
  }

  // --- PUSH: locally updated synced recipes ---
  const syncedRecipes = await db.recipes
    .filter((r) => !!r.supabaseId)
    .toArray()

  for (const recipe of syncedRecipes) {
    const cloudData = recipeToCloud(recipe, userId)
    const { error } = await supabase!
      .from('recipes')
      .upsert(cloudData, { onConflict: 'id' })

    if (!error) pushed++
  }

  // --- PULL: cloud recipes not in local ---
  const { data: cloudRecipes, error: pullError } = await supabase!
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .returns<RecipeRow[]>()

  if (pullError || !cloudRecipes) return { pushed, pulled }

  const localSupabaseIds = new Set(
    (await db.recipes.where('supabaseId').above('').toArray()).map((r) => r.supabaseId),
  )

  for (const row of cloudRecipes) {
    if (!localSupabaseIds.has(row.id)) {
      await db.recipes.add(recipeFromCloud(row) as Recipe)
      pulled++
    }
  }

  return { pushed, pulled }
}

// ============================================================
// Stock sync
// ============================================================

async function syncStock(userId: string): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0
  let pulled = 0

  // --- PUSH: unsynced ---
  const unsyncedStock = await db.stock.filter((s) => !s.supabaseId).toArray()

  for (const item of unsyncedStock) {
    const cloudData = stockToCloud(item, userId)
    delete (cloudData as Record<string, unknown>).id
    const { data, error } = await supabase!
      .from('stock')
      .upsert(cloudData, { onConflict: 'user_id,name' })
      .select('id')
      .single<{ id: string }>()

    if (error || !data) continue
    await db.stock.update(item.id!, { supabaseId: data.id, updatedAt: new Date() })
    pushed++
  }

  // --- PUSH: synced ---
  const syncedStock = await db.stock.filter((s) => !!s.supabaseId).toArray()

  for (const item of syncedStock) {
    const cloudData = stockToCloud(item, userId)
    const { error } = await supabase!
      .from('stock')
      .upsert(cloudData, { onConflict: 'id' })

    if (!error) pushed++
  }

  // --- PULL ---
  const { data: cloudStock, error: pullError } = await supabase!
    .from('stock')
    .select('*')
    .eq('user_id', userId)
    .returns<StockRow[]>()

  if (pullError || !cloudStock) return { pushed, pulled }

  const localSupabaseIds = new Set(
    (await db.stock.filter((s) => !!s.supabaseId).toArray()).map((s) => s.supabaseId),
  )

  for (const row of cloudStock) {
    if (!localSupabaseIds.has(row.id)) {
      await db.stock.add(stockFromCloud(row) as StockItem)
      pulled++
    }
  }

  // --- DELETE: removed from cloud ---
  const cloudIds = new Set(cloudStock.map((r) => r.id))
  for (const item of syncedStock) {
    if (item.supabaseId && !cloudIds.has(item.supabaseId)) {
      await db.stock.delete(item.id!)
    }
  }

  return { pushed, pulled }
}

// ============================================================
// Favorites sync
// ============================================================

async function syncFavorites(
  userId: string,
  idMap: RecipeIdMap,
): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0
  let pulled = 0

  // --- PUSH ---
  const unsyncedFavs = await db.favorites.filter((f) => !f.supabaseId).toArray()

  for (const fav of unsyncedFavs) {
    const recipeCloudId = idMap.localToCloud.get(fav.recipeId)
    if (!recipeCloudId) continue

    const cloudData = favoriteToCloud(fav, userId, recipeCloudId)
    delete (cloudData as Record<string, unknown>).id
    const { data, error } = await supabase!
      .from('favorites')
      .upsert(cloudData, { onConflict: 'user_id,recipe_id' })
      .select('id')
      .single<{ id: string }>()

    if (error || !data) continue
    await db.favorites.update(fav.id!, { supabaseId: data.id })
    pushed++
  }

  // --- PULL ---
  const { data: cloudFavs, error: pullError } = await supabase!
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .returns<FavoriteRow[]>()

  if (pullError || !cloudFavs) return { pushed, pulled }

  const localSupabaseIds = new Set(
    (await db.favorites.filter((f) => !!f.supabaseId).toArray()).map((f) => f.supabaseId),
  )

  for (const row of cloudFavs) {
    if (localSupabaseIds.has(row.id)) continue
    const localRecipeId = idMap.cloudToLocal.get(row.recipe_id)
    if (localRecipeId == null) continue

    await db.favorites.add(favoriteFromCloud(row, localRecipeId) as Favorite)
    pulled++
  }

  return { pushed, pulled }
}

// ============================================================
// UserNotes sync
// ============================================================

async function syncUserNotes(
  userId: string,
  idMap: RecipeIdMap,
): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0
  let pulled = 0

  // --- PUSH: unsynced ---
  const unsyncedNotes = await db.userNotes.filter((n) => !n.supabaseId).toArray()

  for (const note of unsyncedNotes) {
    const recipeCloudId = idMap.localToCloud.get(note.recipeId)
    if (!recipeCloudId) continue

    const cloudData = userNoteToCloud(note, userId, recipeCloudId)
    delete (cloudData as Record<string, unknown>).id
    const { data, error } = await supabase!
      .from('user_notes')
      .upsert(cloudData, { onConflict: 'user_id,recipe_id' })
      .select('id')
      .single<{ id: string }>()

    if (error || !data) continue
    await db.userNotes.update(note.id!, { supabaseId: data.id })
    pushed++
  }

  // --- PUSH: synced ---
  const syncedNotes = await db.userNotes.filter((n) => !!n.supabaseId).toArray()

  for (const note of syncedNotes) {
    const recipeCloudId = idMap.localToCloud.get(note.recipeId)
    if (!recipeCloudId) continue

    const cloudData = userNoteToCloud(note, userId, recipeCloudId)
    const { error } = await supabase!
      .from('user_notes')
      .upsert(cloudData, { onConflict: 'id' })

    if (!error) pushed++
  }

  // --- PULL ---
  const { data: cloudNotes, error: pullError } = await supabase!
    .from('user_notes')
    .select('*')
    .eq('user_id', userId)
    .returns<UserNoteRow[]>()

  if (pullError || !cloudNotes) return { pushed, pulled }

  const localSupabaseIds = new Set(
    (await db.userNotes.filter((n) => !!n.supabaseId).toArray()).map((n) => n.supabaseId),
  )

  for (const row of cloudNotes) {
    if (localSupabaseIds.has(row.id)) continue
    const localRecipeId = idMap.cloudToLocal.get(row.recipe_id)
    if (localRecipeId == null) continue

    await db.userNotes.add(userNoteFromCloud(row, localRecipeId) as UserNote)
    pulled++
  }

  return { pushed, pulled }
}

// ============================================================
// ViewHistory sync (limited to 200 most recent)
// ============================================================

async function syncViewHistory(
  userId: string,
  idMap: RecipeIdMap,
): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0
  let pulled = 0

  // --- PUSH ---
  const unsyncedHistory = await db.viewHistory
    .orderBy('viewedAt')
    .reverse()
    .filter((vh) => !vh.supabaseId)
    .limit(200)
    .toArray()

  for (const vh of unsyncedHistory) {
    const recipeCloudId = idMap.localToCloud.get(vh.recipeId)
    if (!recipeCloudId) continue

    const cloudData = viewHistoryToCloud(vh, userId, recipeCloudId)
    delete (cloudData as Record<string, unknown>).id
    const { data, error } = await supabase!
      .from('view_history')
      .insert(cloudData)
      .select('id')
      .single<{ id: string }>()

    if (error || !data) continue
    await db.viewHistory.update(vh.id!, { supabaseId: data.id })
    pushed++
  }

  // --- PULL ---
  const { data: cloudHistory, error: pullError } = await supabase!
    .from('view_history')
    .select('*')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(200)
    .returns<ViewHistoryRow[]>()

  if (pullError || !cloudHistory) return { pushed, pulled }

  const localSupabaseIds = new Set(
    (await db.viewHistory.filter((vh) => !!vh.supabaseId).toArray()).map((vh) => vh.supabaseId),
  )

  for (const row of cloudHistory) {
    if (localSupabaseIds.has(row.id)) continue
    const localRecipeId = idMap.cloudToLocal.get(row.recipe_id)
    if (localRecipeId == null) continue

    await db.viewHistory.add(viewHistoryFromCloud(row, localRecipeId) as ViewHistory)
    pulled++
  }

  return { pushed, pulled }
}
