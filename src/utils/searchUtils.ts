import Fuse, { type IFuseOptions } from 'fuse.js'
import type { Recipe } from '../db/db'
import { expandSynonyms, synonymMap } from '../data/synonyms'
import { readingMap } from '../data/readings'
import { normalizeJaText } from './jaText'
import { tokenizeJa } from './tokenizeJa'

/**
 * Fuse.js options for recipe fuzzy search.
 * Searches both title and ingredient names.
 */
const fuseOptions: IFuseOptions<Recipe> = {
    keys: [
        { name: 'title', weight: 2 },
        { name: 'ingredients.name', weight: 1 },
    ],
    threshold: 0.4, // 0 = exact, 1 = match anything
    distance: 100,
    ignoreLocation: true, // don't penalize matches at end of string
    includeScore: true,
}

let fuseInstance: Fuse<Recipe> | null = null
let lastRecipes: Recipe[] | null = null

export interface SearchScoredRecipe {
    recipe: Recipe
    queryScore: number
}

function getFuseInstance(recipes: Recipe[]): Fuse<Recipe> {
    if (fuseInstance && lastRecipes === recipes) {
        return fuseInstance
    }
    fuseInstance = new Fuse(recipes, fuseOptions)
    lastRecipes = recipes
    return fuseInstance
}

function findCanonicalByReading(term: string): string[] {
    const normalized = normalizeJaText(term)
    if (!normalized) return []

    const matches: string[] = []
    for (const [canonical, readings] of Object.entries(readingMap)) {
        const hasMatch = readings.some((r) => normalizeJaText(r) === normalized)
        if (hasMatch) matches.push(canonical)
    }
    return matches
}

function shouldUseToken(token: string): boolean {
    // precision-first: avoid short pure-hiragana tokens like "にく" being too broad.
    if (token.length < 2) return false
    if (/^[ぁ-ん]+$/.test(token)) return token.length >= 4
    return true
}

function createSearchTerms(query: string): string[] {
    const normalized = normalizeJaText(query)
    const terms = new Set<string>([query])
    if (normalized) terms.add(normalized)

    for (const token of tokenizeJa(query)) {
        if (shouldUseToken(token)) {
            terms.add(token)
        }
    }

    const currentTerms = [...terms]
    for (const term of currentTerms) {
        for (const canonical of findCanonicalByReading(term)) {
            terms.add(canonical)
            for (const synonym of expandSynonyms(canonical)) {
                terms.add(synonym)
            }

            const canonicalAliases = synonymMap[canonical] ?? []
            for (const alias of canonicalAliases) {
                terms.add(alias)
            }
        }

        for (const synonym of expandSynonyms(term)) {
            terms.add(synonym)
        }
    }

    return [...terms]
}

export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
    return searchRecipesWithScores(recipes, query).map((item) => item.recipe)
}

export function searchRecipesWithScores(recipes: Recipe[], query: string): SearchScoredRecipe[] {
    if (!query.trim()) return recipes.map((recipe) => ({ recipe, queryScore: 0.5 }))

    const fuse = getFuseInstance(recipes)
    const expandedTerms = createSearchTerms(query)
    const resultMap = new Map<number, { recipe: Recipe; score: number }>()

    for (const term of expandedTerms) {
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

    return [...resultMap.values()]
        .sort((a, b) => a.score - b.score)
        .map((r) => ({
            recipe: r.recipe,
            queryScore: Math.max(0, 1 - Math.min(1, r.score)),
        }))
}

export function getExpandedSearchTermsForDebug(query: string): string[] {
    return createSearchTerms(query)
}

export function getRecentSearchSuggestions(history: string[], focused: boolean): string[] {
    if (!focused) return []
    return history.slice(0, 5)
}
