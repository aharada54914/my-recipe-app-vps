import { useMemo } from 'react'
import type { RecipeSearchModelInput } from '../utils/recipeSearchModel'
import { buildRecipeCategoryCounts, buildRecipeSearchResults } from '../utils/recipeSearchModel'

export function useRecipeSearchModel(input: RecipeSearchModelInput) {
  const results = useMemo(() => buildRecipeSearchResults(input), [input])
  const categoryCounts = useMemo(() => buildRecipeCategoryCounts(input.recipes), [input.recipes])

  return { results, categoryCounts }
}
