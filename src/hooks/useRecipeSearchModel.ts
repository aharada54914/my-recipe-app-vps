import { useMemo } from 'react'
import type { RecipeSearchModelInput } from '../utils/recipeSearchModel'
import {
  buildFacetAwareCategoryCountsFromContext,
  buildRecipeSearchResultsFromContext,
  createRecipeSearchStaticContext,
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

  const results = useMemo(
    () => buildRecipeSearchResultsFromContext(staticContext, input.searchQuery, input.facets),
    [input.facets, input.searchQuery, staticContext],
  )

  const categoryCounts = useMemo(
    () => buildFacetAwareCategoryCountsFromContext(staticContext, input.searchQuery, input.facets),
    [input.facets, input.searchQuery, staticContext],
  )

  return { results, categoryCounts }
}
