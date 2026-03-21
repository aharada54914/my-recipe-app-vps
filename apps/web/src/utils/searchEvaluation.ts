import type { Recipe } from '../db/db'
import { searchRecipes } from './searchUtils'

export interface EvaluationCase {
    query: string
    relevantRecipeIds: number[]
    k?: number
}

export interface PrecisionResult {
    query: string
    precisionAtK: number
    hits: number
    evaluatedCount: number
}

export function evaluatePrecisionAtK(recipes: Recipe[], testCases: EvaluationCase[]): PrecisionResult[] {
    return testCases.map(({ query, relevantRecipeIds, k = 5 }) => {
        const found = searchRecipes(recipes, query).slice(0, k)
        const relevantSet = new Set(relevantRecipeIds)
        const hits = found.filter((recipe) => relevantSet.has(recipe.id!)).length
        const evaluatedCount = Math.max(1, Math.min(k, found.length))

        return {
            query,
            precisionAtK: hits / evaluatedCount,
            hits,
            evaluatedCount,
        }
    })
}
