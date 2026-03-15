import { useMemo } from 'react'
import type { RecipeSearchModelInput } from '../utils/recipeSearchModel'
import {
  buildRecipeCategoryCounts,
  buildRecipeSearchResultsFromScored,
  createRecipeSearchStaticContext,
  scoreRecipesForQuery,
} from '../utils/recipeSearchModel'

export function useRecipeSearchModel(input: RecipeSearchModelInput) {
  const staticContext = useMemo(() => createRecipeSearchStaticContext({
    recipes: input.recipes,
    stockItems: input.stockItems,
    viewHistory: input.viewHistory,
    favorites: input.favorites,
    weeklyMenus: input.weeklyMenus,
    calendarEvents: input.calendarEvents,
  }), [
    input.calendarEvents,
    input.favorites,
    input.recipes,
    input.stockItems,
    input.viewHistory,
    input.weeklyMenus,
  ])

  // Fuse.js検索はクエリ変更時のみ実行（ファセット変更では再実行しない）
  const scored = useMemo(
    () => scoreRecipesForQuery(staticContext, input.searchQuery),
    [staticContext, input.searchQuery],
  )

  const results = useMemo(
    () => buildRecipeSearchResultsFromScored(staticContext, scored, input.facets),
    [staticContext, scored, input.facets],
  )

  const categoryCounts = useMemo(() => {
    const allResults = buildRecipeSearchResultsFromScored(
      staticContext,
      scored,
      { ...input.facets, categories: [] },
    )
    return buildRecipeCategoryCounts(allResults.map((entry) => entry.recipe))
  }, [staticContext, scored, input.facets])

  return { results, categoryCounts }
}
