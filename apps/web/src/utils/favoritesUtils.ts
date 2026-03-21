import { db } from '../db/db'
import type { Favorite } from '../db/db'

/**
 * Toggle a recipe's favorite status.
 * If already favorited, remove it. Otherwise, add it.
 */
export async function toggleFavorite(recipeId: number): Promise<boolean> {
    const existing = await db.favorites.where('recipeId').equals(recipeId).first()
    if (existing) {
        await db.favorites.delete(existing.id!)
        return false // removed
    } else {
        await db.favorites.add({ recipeId, addedAt: new Date() } as Favorite)
        return true // added
    }
}

/**
 * Check if a recipe is favorited.
 */
export async function isFavorited(recipeId: number): Promise<boolean> {
    const count = await db.favorites.where('recipeId').equals(recipeId).count()
    return count > 0
}

/**
 * Get all favorite recipe IDs.
 */
export async function getFavoriteRecipeIds(): Promise<number[]> {
    const favorites = await db.favorites.toArray()
    return favorites.map((f) => f.recipeId)
}
