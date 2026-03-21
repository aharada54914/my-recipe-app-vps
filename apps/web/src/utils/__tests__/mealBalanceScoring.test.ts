import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../db/db'
import type { MealBalanceInference } from '../mealBalanceTypes'
import { computeMainScore, computeSideScore } from '../mealBalanceScoring'

function makeRecipe(
  id: number,
  title: string,
  category: Recipe['category'] = '主菜',
  device: Recipe['device'] = 'manual',
): Recipe {
  return {
    id,
    title,
    recipeNumber: `T-${id}`,
    device,
    category,
    baseServings: 2,
    totalWeightG: 500,
    ingredients: [{ name: title, quantity: 1, unit: '個', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 10 }],
    totalTimeMinutes: 10,
  }
}

function makeInference(overrides: Partial<MealBalanceInference> = {}): MealBalanceInference {
  return {
    nutrition: { protein: 1, vegetable: 0, carb: 0, fat: 0, soupLike: 0 },
    colors: { red: 0, green: 0, yellow: 0, white: 0, black: 0 },
    dominantColors: [],
    primaryIngredients: [],
    genre: 'other',
    isHeavy: false,
    ...overrides,
  }
}

describe('meal balance scoring', () => {
  it('penalizes consecutive mains that repeat the same primary ingredient', () => {
    const sameTagScore = computeMainScore({
      recipe: makeRecipe(1, '豚肉炒め'),
      baseScore: 100,
      selectedCategories: ['主菜'],
      selectedDevices: ['manual'],
      mainDeviceTargets: { hotcook: 0, healsio: 0, manual: 7 },
      candidateInference: makeInference({ primaryIngredients: ['pork'] }),
      selectedMainInferences: [
        makeInference({ primaryIngredients: ['pork'], isHeavy: true }),
      ],
      selectedMainRecipes: [makeRecipe(90, '豚肉炒め')],
      balanceTier: 'heuristic-3',
    })

    const differentTagScore = computeMainScore({
      recipe: makeRecipe(2, '鮭の塩焼き'),
      baseScore: 100,
      selectedCategories: ['主菜'],
      selectedDevices: ['manual'],
      mainDeviceTargets: { hotcook: 0, healsio: 0, manual: 7 },
      candidateInference: makeInference({ primaryIngredients: ['fish'] }),
      selectedMainInferences: [
        makeInference({ primaryIngredients: ['pork'], isHeavy: true }),
      ],
      selectedMainRecipes: [makeRecipe(90, '豚肉炒め')],
      balanceTier: 'heuristic-3',
    })

    expect(differentTagScore).toBeGreaterThan(sameTagScore)
  })

  it('prefers vegetable-rich and color-complementary side dishes for heavy mains', () => {
    const mainInference = makeInference({
      primaryIngredients: ['pork'],
      dominantColors: ['red'],
      nutrition: { protein: 2, vegetable: 0, carb: 0, fat: 2, soupLike: 0 },
      genre: 'japanese',
      isHeavy: true,
    })

    const veggieSoupScore = computeSideScore({
      recipe: makeRecipe(11, 'ほうれん草スープ', 'スープ'),
      mainRecipe: makeRecipe(1, '豚バラ炒め'),
      baseScore: 80,
      candidateInference: makeInference({
        primaryIngredients: ['soy'],
        dominantColors: ['green'],
        nutrition: { protein: 0, vegetable: 2, carb: 0, fat: 0, soupLike: 2 },
        genre: 'japanese',
        isHeavy: false,
      }),
      mainInference,
      usedSideCategories: [],
      balanceTier: 'heuristic-3',
    })

    const overlappingHeavyScore = computeSideScore({
      recipe: makeRecipe(12, '豚肉の小鉢', '副菜'),
      mainRecipe: makeRecipe(1, '豚バラ炒め'),
      baseScore: 80,
      candidateInference: makeInference({
        primaryIngredients: ['pork'],
        dominantColors: ['red'],
        nutrition: { protein: 2, vegetable: 0, carb: 0, fat: 2, soupLike: 0 },
        genre: 'japanese',
        isHeavy: true,
      }),
      mainInference,
      usedSideCategories: [],
      balanceTier: 'heuristic-3',
    })

    expect(veggieSoupScore).toBeGreaterThan(overlappingHeavyScore)
  })

  it('increases nutrition contribution in nutrition-7 tier', () => {
    const scoreHeuristic = computeSideScore({
      recipe: {
        ...makeRecipe(21, '野菜スープ', 'スープ'),
        nutritionPerServing: {
          energyKcal: 180,
          proteinG: 6,
          fatG: 5,
          carbG: 16,
          saltEquivalentG: 1.5,
          fiberG: 5.2,
          saturatedFatG: 1.2,
          sugarG: 4.5,
          potassiumMg: 620,
        },
      },
      mainRecipe: {
        ...makeRecipe(1, '豚バラメイン'),
        nutritionPerServing: { energyKcal: 650, proteinG: 18, fatG: 30, carbG: 25, saltEquivalentG: 3.2 },
      },
      baseScore: 50,
      candidateInference: makeInference({
        dominantColors: ['green'],
        nutrition: { protein: 0, vegetable: 2, carb: 0, fat: 0, soupLike: 2 },
      }),
      mainInference: makeInference({
        dominantColors: ['red'],
        nutrition: { protein: 2, vegetable: 0, carb: 0, fat: 2, soupLike: 0 },
        isHeavy: true,
      }),
      usedSideCategories: [],
      balanceTier: 'heuristic-3',
    })

    const scoreNutrition7 = computeSideScore({
      recipe: {
        ...makeRecipe(21, '野菜スープ', 'スープ'),
        nutritionPerServing: {
          energyKcal: 180,
          proteinG: 6,
          fatG: 5,
          carbG: 16,
          saltEquivalentG: 1.5,
          fiberG: 5.2,
          saturatedFatG: 1.2,
          sugarG: 4.5,
          potassiumMg: 620,
        },
      },
      mainRecipe: {
        ...makeRecipe(1, '豚バラメイン'),
        nutritionPerServing: { energyKcal: 650, proteinG: 18, fatG: 30, carbG: 25, saltEquivalentG: 3.2 },
      },
      baseScore: 50,
      candidateInference: makeInference({
        dominantColors: ['green'],
        nutrition: { protein: 0, vegetable: 2, carb: 0, fat: 0, soupLike: 2 },
      }),
      mainInference: makeInference({
        dominantColors: ['red'],
        nutrition: { protein: 2, vegetable: 0, carb: 0, fat: 2, soupLike: 0 },
        isHeavy: true,
      }),
      usedSideCategories: [],
      balanceTier: 'nutrition-7',
    })

    expect(scoreNutrition7).toBeGreaterThan(scoreHeuristic)
  })
})
