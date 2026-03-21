import type { Recipe } from '../db/db'
import type { BalanceScoringTier } from '../db/db'

export type NutritionLevel = 0 | 1 | 2
export type CuisineGenre = 'japanese' | 'western' | 'chinese' | 'other'
export type BalanceColor = 'red' | 'green' | 'yellow' | 'white' | 'black'
export type PrimaryIngredientTag = 'chicken' | 'pork' | 'beef' | 'fish' | 'egg' | 'soy' | 'rice' | 'noodle'

export interface NutritionSignals {
  protein: NutritionLevel
  vegetable: NutritionLevel
  carb: NutritionLevel
  fat: NutritionLevel
  soupLike: NutritionLevel
}

export type ColorSignals = Record<BalanceColor, NutritionLevel>

export interface MealBalanceInference {
  nutrition: NutritionSignals
  colors: ColorSignals
  dominantColors: BalanceColor[]
  primaryIngredients: PrimaryIngredientTag[]
  genre: CuisineGenre
  isHeavy: boolean
}

export interface MainScoreContext {
  recipe: Recipe
  baseScore: number
  selectedCategories: string[]
  selectedDevices: Recipe['device'][]
  mainDeviceTargets: Record<Recipe['device'], number>
  candidateInference: MealBalanceInference
  selectedMainInferences: MealBalanceInference[]
  selectedMainRecipes: Recipe[]
  balanceTier: BalanceScoringTier
}

export interface SideScoreContext {
  recipe: Recipe
  mainRecipe: Recipe
  baseScore: number
  candidateInference: MealBalanceInference
  mainInference: MealBalanceInference
  usedSideCategories: string[]
  balanceTier: BalanceScoringTier
}
