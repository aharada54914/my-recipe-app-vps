import type { Recipe } from '../../db/db'

function containsPremiumTag(recipe: Recipe): boolean {
  const title = recipe.title
  return /ステーキ|和牛|海老|えび|うなぎ|蟹|かに|ローストビーフ/.test(title)
}

export function computeLuxuryExperienceScore(recipe: Recipe, dayIndex: number): number {
  const premium = containsPremiumTag(recipe) ? 1 : 0.4
  const variety = recipe.category === '主菜' ? 0.8 : 0.5
  const occasionFit = dayIndex >= 5 ? 1 : 0.6
  const cookingDelight = (recipe.totalTimeMinutes ?? 30) >= 20 ? 0.8 : 0.5
  const presentation = /焼き|グリル|ロースト|彩り/.test(recipe.title) ? 0.9 : 0.6
  const nutritionFloor = recipe.nutritionPerServing?.proteinG && recipe.nutritionPerServing.proteinG >= 15 ? 0.8 : 0.6

  const score =
    0.28 * premium +
    0.20 * variety +
    0.16 * occasionFit +
    0.14 * cookingDelight +
    0.12 * presentation +
    0.10 * nutritionFloor

  return Math.round(score * 100) / 100
}
