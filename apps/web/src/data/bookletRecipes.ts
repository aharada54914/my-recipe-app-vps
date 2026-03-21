import type { Recipe } from '../db/db'
import rawData from './recipes-booklet.json'

/**
 * Sharp COCORO KITCHEN レシピ冊子（TCAD CA055KRRZ 23H②）から転記した6レシピ。
 * ホットクック専用カレー＆洋食レシピ集。
 * DB初回 seed および v19 マイグレーションで挿入される。
 * データの正規化は src/data/recipes-booklet.json が source of truth。
 */
export const BOOKLET_RECIPES = rawData as unknown as Omit<Recipe, 'id'>[]
