import {
  BALANCE_WEIGHTS,
  WEEKLY_MENU_DEVICE_WEIGHTS,
} from '../constants/recipeConstants'
import type { Recipe } from '../db/db'
import type {
  BalanceColor,
  MainScoreContext,
  MealBalanceInference,
  PrimaryIngredientTag,
  SideScoreContext,
} from './mealBalanceTypes'

function tierScale(tier: MainScoreContext['balanceTier']): { nutrition: number, color: number } {
  if (tier === 'nutrition-7') return { nutrition: 1.4, color: 0.7 }
  if (tier === 'nutrition-5') return { nutrition: 1.2, color: 0.8 }
  return { nutrition: 1, color: 1 }
}

interface NumericNutritionSignals {
  energyKcal?: number
  proteinG?: number
  fatG?: number
  carbG?: number
  saltEquivalentG?: number
  fiberG?: number
  sugarG?: number
  saturatedFatG?: number
  potassiumMg?: number
}

function sodiumToSaltEquivalentG(sodiumMg: number): number {
  return (sodiumMg * 2.54) / 1000
}

function getNumericSignals(recipe: Recipe): NumericNutritionSignals | null {
  const n = recipe.nutritionPerServing
  if (!n) return null

  const saltEquivalentG = typeof n.saltEquivalentG === 'number'
    ? n.saltEquivalentG
    : typeof n.sodiumMg === 'number'
      ? sodiumToSaltEquivalentG(n.sodiumMg)
      : undefined

  return {
    energyKcal: n.energyKcal,
    proteinG: n.proteinG,
    fatG: n.fatG,
    carbG: n.carbG,
    saltEquivalentG,
    fiberG: n.fiberG,
    sugarG: n.sugarG,
    saturatedFatG: n.saturatedFatG,
    potassiumMg: n.potassiumMg,
  }
}

function averageNumericSignals(recipes: Recipe[]): NumericNutritionSignals | null {
  if (recipes.length === 0) return null
  let count = 0
  const sum: Required<NumericNutritionSignals> = {
    energyKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    saltEquivalentG: 0,
    fiberG: 0,
    sugarG: 0,
    saturatedFatG: 0,
    potassiumMg: 0,
  }

  for (const recipe of recipes) {
    const signals = getNumericSignals(recipe)
    if (!signals) continue
    if (typeof signals.energyKcal === 'number') sum.energyKcal += signals.energyKcal
    if (typeof signals.proteinG === 'number') sum.proteinG += signals.proteinG
    if (typeof signals.fatG === 'number') sum.fatG += signals.fatG
    if (typeof signals.carbG === 'number') sum.carbG += signals.carbG
    if (typeof signals.saltEquivalentG === 'number') sum.saltEquivalentG += signals.saltEquivalentG
    if (typeof signals.fiberG === 'number') sum.fiberG += signals.fiberG
    if (typeof signals.sugarG === 'number') sum.sugarG += signals.sugarG
    if (typeof signals.saturatedFatG === 'number') sum.saturatedFatG += signals.saturatedFatG
    if (typeof signals.potassiumMg === 'number') sum.potassiumMg += signals.potassiumMg
    count += 1
  }

  if (count === 0) return null
  return {
    energyKcal: sum.energyKcal / count,
    proteinG: sum.proteinG / count,
    fatG: sum.fatG / count,
    carbG: sum.carbG / count,
    saltEquivalentG: sum.saltEquivalentG / count,
    fiberG: sum.fiberG / count,
    sugarG: sum.sugarG / count,
    saturatedFatG: sum.saturatedFatG / count,
    potassiumMg: sum.potassiumMg / count,
  }
}

function scoreMainNumericNutrition(
  recipe: Recipe,
  selectedMainRecipes: Recipe[],
  balanceTier: MainScoreContext['balanceTier'],
  nutritionScale: number,
): number {
  if (balanceTier === 'heuristic-3') return 0
  const candidate = getNumericSignals(recipe)
  if (!candidate) return 0

  let score = 0

  if (typeof candidate.proteinG === 'number') {
    if (candidate.proteinG >= 20) score += 4
    else if (candidate.proteinG < 12) score -= 4
  }

  if (typeof candidate.fatG === 'number') {
    if (candidate.fatG > 28) score -= 4
    else if (candidate.fatG <= 16) score += 2
  }

  if (typeof candidate.saltEquivalentG === 'number') {
    if (candidate.saltEquivalentG > 3.2) score -= 5
    else if (candidate.saltEquivalentG <= 2.2) score += 2
  }

  if (typeof candidate.energyKcal === 'number') {
    if (candidate.energyKcal < 280 || candidate.energyKcal > 850) score -= 2
    else score += 1
  }

  const avg = averageNumericSignals(selectedMainRecipes)
  if (avg) {
    if (
      typeof avg.saltEquivalentG === 'number' &&
      avg.saltEquivalentG > 3.0 &&
      typeof candidate.saltEquivalentG === 'number' &&
      candidate.saltEquivalentG <= 2.5
    ) score += 4

    if (
      typeof avg.fatG === 'number' &&
      avg.fatG > 24 &&
      typeof candidate.fatG === 'number' &&
      candidate.fatG <= 18
    ) score += 4

    if (
      typeof avg.proteinG === 'number' &&
      avg.proteinG < 18 &&
      typeof candidate.proteinG === 'number' &&
      candidate.proteinG >= 20
    ) score += 4
  }

  if (balanceTier === 'nutrition-7') {
    if (typeof candidate.fiberG === 'number' && candidate.fiberG >= 5) score += 3
    if (typeof candidate.saturatedFatG === 'number' && candidate.saturatedFatG > 8) score -= 3
    if (typeof candidate.sugarG === 'number' && candidate.sugarG > 20) score -= 2
    if (typeof candidate.potassiumMg === 'number' && candidate.potassiumMg >= 700) score += 2
  }

  return score * nutritionScale
}

function scoreSideNumericNutrition(
  recipe: Recipe,
  mainRecipe: Recipe,
  balanceTier: SideScoreContext['balanceTier'],
  nutritionScale: number,
): number {
  if (balanceTier === 'heuristic-3') return 0
  const candidate = getNumericSignals(recipe)
  const main = getNumericSignals(mainRecipe)
  if (!candidate || !main) return 0

  let score = 0

  if (
    typeof main.fatG === 'number' &&
    main.fatG >= 24 &&
    typeof candidate.fatG === 'number' &&
    candidate.fatG <= 12
  ) score += 4

  if (
    typeof main.saltEquivalentG === 'number' &&
    main.saltEquivalentG >= 3.0 &&
    typeof candidate.saltEquivalentG === 'number' &&
    candidate.saltEquivalentG <= 2.0
  ) score += 4

  if (
    typeof main.energyKcal === 'number' &&
    typeof candidate.energyKcal === 'number' &&
    candidate.energyKcal > main.energyKcal * 0.9
  ) score -= 2

  if (
    typeof main.proteinG === 'number' &&
    main.proteinG < 18 &&
    typeof candidate.proteinG === 'number' &&
    candidate.proteinG >= 12
  ) score += 2

  if (balanceTier === 'nutrition-7') {
    if (typeof candidate.fiberG === 'number' && candidate.fiberG >= 4) score += 3
    if (typeof candidate.saturatedFatG === 'number' && candidate.saturatedFatG > 6) score -= 3
    if (typeof candidate.sugarG === 'number' && candidate.sugarG > 15) score -= 2
    if (typeof candidate.potassiumMg === 'number' && candidate.potassiumMg >= 500) score += 1
  }

  return score * nutritionScale
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {} as Record<T, number>)
}

function countPrimaryTags(inferences: MealBalanceInference[]): Record<PrimaryIngredientTag, number> {
  const allTags = inferences.flatMap((inf) => inf.primaryIngredients)
  return countBy(allTags)
}

function countDominantColors(inferences: MealBalanceInference[]): Record<BalanceColor, number> {
  const allColors = inferences.flatMap((inf) => inf.dominantColors)
  return countBy(allColors)
}

function countTagOverlap(a: PrimaryIngredientTag[], b: PrimaryIngredientTag[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const bSet = new Set(b)
  let overlap = 0
  for (const tag of a) {
    if (bSet.has(tag)) overlap += 1
  }
  return overlap
}

export function computeMainScore(context: MainScoreContext): number {
  const {
    recipe,
    baseScore,
    selectedCategories,
    selectedDevices,
    mainDeviceTargets,
    candidateInference,
    selectedMainInferences,
    selectedMainRecipes,
    balanceTier,
  } = context

  let score = baseScore
  const scale = tierScale(balanceTier)

  const catCount = selectedCategories.filter((c) => c === recipe.category).length
  if (catCount >= 2) {
    score -= (catCount - 1) * BALANCE_WEIGHTS.categoryRepeatPenalty
  }

  const devCount = selectedDevices.filter((d) => d === recipe.device).length
  const devTarget = mainDeviceTargets[recipe.device]
  const deficit = Math.max(0, devTarget - devCount)
  const overTarget = Math.max(0, devCount - devTarget)
  score += deficit * WEEKLY_MENU_DEVICE_WEIGHTS.deficitBonus
  score -= overTarget * WEEKLY_MENU_DEVICE_WEIGHTS.overTargetPenalty

  if (selectedDevices.length > 0 && selectedDevices[selectedDevices.length - 1] !== recipe.device) {
    score += WEEKLY_MENU_DEVICE_WEIGHTS.alternationBonus
  }

  const previousMain = selectedMainInferences[selectedMainInferences.length - 1]
  if (previousMain) {
    const overlap = countTagOverlap(previousMain.primaryIngredients, candidateInference.primaryIngredients)
    score -= overlap * BALANCE_WEIGHTS.mainPrimaryConsecutivePenalty

    if (previousMain.isHeavy && candidateInference.isHeavy) {
      score -= BALANCE_WEIGHTS.mainHeavyConsecutivePenalty
    }
  }

  const weeklyTagCounts = countPrimaryTags(selectedMainInferences)
  for (const tag of candidateInference.primaryIngredients) {
    const count = weeklyTagCounts[tag] ?? 0
    if (count >= 2) {
      score -= (count - 1) * BALANCE_WEIGHTS.mainPrimaryWeeklyPenalty
    }
  }

  if (selectedMainInferences.length > 0) {
    const avgVegetable = selectedMainInferences
      .reduce((sum, inf) => sum + inf.nutrition.vegetable, 0) / selectedMainInferences.length
    const avgFat = selectedMainInferences
      .reduce((sum, inf) => sum + inf.nutrition.fat, 0) / selectedMainInferences.length

    if (avgVegetable < 1.1 && candidateInference.nutrition.vegetable >= 1) {
      score += BALANCE_WEIGHTS.mainVegetableRecoveryBonus * scale.nutrition
    }

    if (avgFat >= 1.0 && candidateInference.nutrition.fat === 0) {
      score += BALANCE_WEIGHTS.mainLightRecoveryBonus * scale.nutrition
    } else if (avgFat >= 1.2 && candidateInference.nutrition.fat === 2) {
      score -= BALANCE_WEIGHTS.mainFatOverloadPenalty * scale.nutrition
    }
  }

  score += scoreMainNumericNutrition(recipe, selectedMainRecipes, balanceTier, scale.nutrition)

  const weeklyColorCounts = countDominantColors(selectedMainInferences)
  if (candidateInference.dominantColors.length > 0) {
    let hasUnusedColor = false

    for (const color of candidateInference.dominantColors) {
      const used = weeklyColorCounts[color] ?? 0
      if (used === 0) {
        hasUnusedColor = true
        continue
      }
      if (used >= 2) {
        score -= BALANCE_WEIGHTS.mainColorOverusePenalty * scale.color
      }
    }

    if (hasUnusedColor) {
      score += BALANCE_WEIGHTS.mainColorDiversityBonus * scale.color
    }
  }

  return score
}

export function computeSideScore(context: SideScoreContext): number {
  const {
    recipe,
    mainRecipe,
    baseScore,
    candidateInference,
    mainInference,
    usedSideCategories,
    balanceTier,
  } = context

  let score = baseScore
  const scale = tierScale(balanceTier)

  const sideCategoryCount = usedSideCategories.filter((category) => category === recipe.category).length
  if (sideCategoryCount >= 3) {
    score -= (sideCategoryCount - 2) * BALANCE_WEIGHTS.sideCategoryRepeatPenalty
  }

  if (mainInference.genre !== 'other' && candidateInference.genre === mainInference.genre) {
    score += BALANCE_WEIGHTS.genreMatchBonus
  }

  if (mainInference.isHeavy && !candidateInference.isHeavy) {
    score += BALANCE_WEIGHTS.heavyToLightBonus
  } else if (!mainInference.isHeavy && candidateInference.isHeavy) {
    score += BALANCE_WEIGHTS.lightToHeavyBonus
  } else if (mainInference.isHeavy && candidateInference.isHeavy) {
    score -= BALANCE_WEIGHTS.heavyPairPenalty
  }

  if (mainInference.isHeavy && candidateInference.nutrition.vegetable >= 1) {
    score += BALANCE_WEIGHTS.sideVegetableComplementBonus * scale.nutrition
  }

  if (candidateInference.nutrition.soupLike >= 1 && mainInference.nutrition.soupLike === 0) {
    score += BALANCE_WEIGHTS.sideSoupComplementBonus * scale.nutrition
  }

  if (mainInference.nutrition.fat >= 1 && candidateInference.nutrition.fat >= 1) {
    score -= BALANCE_WEIGHTS.sideFatOnFatPenalty * scale.nutrition
  }

  const overlap = countTagOverlap(mainInference.primaryIngredients, candidateInference.primaryIngredients)
  score -= overlap * BALANCE_WEIGHTS.sidePrimaryOverlapPenalty

  if (candidateInference.dominantColors.length > 0) {
    const mainColors = new Set(mainInference.dominantColors)
    const hasComplementaryColor = candidateInference.dominantColors.some((color) => !mainColors.has(color))
    if (hasComplementaryColor) {
      score += BALANCE_WEIGHTS.sideColorComplementBonus * scale.color
    } else if (mainColors.size > 0) {
      score -= BALANCE_WEIGHTS.sideSameColorPenalty * scale.color
    }
  }

  score += scoreSideNumericNutrition(recipe, mainRecipe, balanceTier, scale.nutrition)

  return score
}
