import type { Recipe, RecipeCategory } from '../db/db'

export type MealRole = 'main' | 'side'

const MAIN_CATEGORIES: RecipeCategory[] = ['主菜', 'ご飯もの']
const SIDE_CATEGORIES: RecipeCategory[] = ['副菜', 'スープ']

const CATEGORIES_BY_ROLE: Record<MealRole, RecipeCategory[]> = {
  main: MAIN_CATEGORIES,
  side: SIDE_CATEGORIES,
}

export function getAllowedCategoriesForRole(role: MealRole): RecipeCategory[] {
  return CATEGORIES_BY_ROLE[role]
}

export function isRecipeAllowedForRole(recipe: Pick<Recipe, 'category'>, role: MealRole): boolean {
  return getAllowedCategoriesForRole(role).includes(recipe.category)
}

export function filterRecipesByRole<T extends Pick<Recipe, 'category'>>(recipes: T[], role: MealRole): T[] {
  return recipes.filter((recipe) => isRecipeAllowedForRole(recipe, role))
}
