import Fuse, { type IFuseOptions } from 'fuse.js'
import type { Recipe } from '../db/db'
import { expandSynonyms } from '../data/synonyms'

/**
 * Fuse.js options for recipe fuzzy search.
 * Searches both title and ingredient names.
 */
const fuseOptions: IFuseOptions<Recipe> = {
    keys: [
        { name: 'title', weight: 2 },
        { name: 'ingredients.name', weight: 1 },
    ],
    threshold: 0.4,       // 0 = exact, 1 = match anything
    distance: 100,
    ignoreLocation: true,  // don't penalize matches at end of string
    includeScore: true,
}

let fuseInstance: Fuse<Recipe> | null = null
let lastRecipes: Recipe[] | null = null

export interface SearchScoredRecipe {
    recipe: Recipe
    queryScore: number
}

/**
 * Get or create a Fuse.js index (reuses if recipes haven't changed).
 */
function getFuseInstance(recipes: Recipe[]): Fuse<Recipe> {
    if (fuseInstance && lastRecipes === recipes) {
        return fuseInstance
    }
    fuseInstance = new Fuse(recipes, fuseOptions)
    lastRecipes = recipes
    return fuseInstance
}

/**
 * Search recipes with fuzzy matching + synonym expansion.
 * Returns matching recipes sorted by relevance.
 */
export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
    return searchRecipesWithScores(recipes, query).map((item) => item.recipe)
}

/**
 * Search recipes and return both recipe + normalized query relevance score.
 * queryScore: 0..1 (higher is better).
 */
export function searchRecipesWithScores(recipes: Recipe[], query: string): SearchScoredRecipe[] {
    if (!query.trim()) return recipes.map((recipe) => ({ recipe, queryScore: 0.5 }))

    const fuse = getFuseInstance(recipes)

    // Expand synonyms: "とり肉" → ["とり肉", "鶏肉", "チキン", ...]
    const expanded = expandSynonyms(query)

    // Run Fuse.js search for each synonym and deduplicate
    const resultMap = new Map<number, { recipe: Recipe; score: number }>()

    for (const term of expanded) {
        const results = fuse.search(term)
        for (const result of results) {
            const id = result.item.id!
            const score = result.score ?? 1
            const existing = resultMap.get(id)
            if (!existing || score < existing.score) {
                resultMap.set(id, { recipe: result.item, score })
            }
        }
    }

    // Sort by best score (lower = better match) and normalize to queryScore (higher = better)
    return [...resultMap.values()]
        .sort((a, b) => a.score - b.score)
        .map((r) => ({
            recipe: r.recipe,
            queryScore: Math.max(0, 1 - Math.min(1, r.score)),
        }))
}
