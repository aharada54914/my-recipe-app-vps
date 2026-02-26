import Fuse, { type IFuseOptions } from 'fuse.js'
import type { Recipe } from '../db/db'
import { expandSynonyms, synonymMap } from '../data/synonyms'
import { readingMap } from '../data/readings'
import { normalizeJaText } from './jaText'
import { tokenizeJa } from './tokenizeJa'
import {
    getKuromojiTokenizerVersion,
    getTitleReadingVariantsByKuromoji,
    warmupKuromojiTitleReadings,
} from './kuromojiTitleReadings'

interface SearchRecipeDoc {
    recipe: Recipe
    titleSearchText: string
    ingredientSearchText: string
    searchText: string
}

/**
 * Fuse.js options for recipe fuzzy search.
 * Searches both title and ingredient names.
 */
const fuseOptions: IFuseOptions<SearchRecipeDoc> = {
    keys: [
        { name: 'titleSearchText', weight: 2.4 },
        { name: 'ingredientSearchText', weight: 1.2 },
        { name: 'searchText', weight: 1 },
    ],
    threshold: 0.4, // 0 = exact, 1 = match anything
    distance: 100,
    ignoreLocation: true, // don't penalize matches at end of string
    includeScore: true,
}

let fuseInstance: Fuse<SearchRecipeDoc> | null = null
let lastRecipes: Recipe[] | null = null
let lastDocs: SearchRecipeDoc[] | null = null
let lastKuromojiVersion = -1

export interface SearchScoredRecipe {
    recipe: Recipe
    queryScore: number
}

function expandReadingsByCanonical(term: string): string[] {
    const normalized = normalizeJaText(term)
    if (!normalized) return []

    const result = new Set<string>()
    for (const [canonical, readings] of Object.entries(readingMap)) {
        const canonicalNorm = normalizeJaText(canonical)
        if (canonicalNorm === normalized) {
            result.add(canonical)
            for (const r of readings) result.add(r)
        }
    }
    return [...result]
}

function lexiconAliases(term: string): string[] {
    const out = new Set<string>([term])
    for (const s of expandSynonyms(term)) out.add(s)
    for (const s of expandReadingsByCanonical(term)) out.add(s)
    return [...out]
}

function generatePhraseVariants(text: string): string[] {
    const normalized = normalizeJaText(text)
    if (!normalized) return []

    const variants = new Set<string>([text, normalized])
    const tokens = tokenizeJa(text)
    const tokenAliases = tokens.map((token) => ({
        token,
        aliases: lexiconAliases(token).slice(0, 8),
    }))

    for (const { token, aliases } of tokenAliases) {
        if (!token) continue
        for (const alias of aliases) {
            variants.add(alias)
            if (text.includes(token)) variants.add(text.replaceAll(token, alias))
            if (normalized.includes(token)) variants.add(normalized.replaceAll(token, normalizeJaText(alias)))
        }
    }

    // Add token-level aliases as concatenated forms to absorb kanji/kana mixed titles like "粕汁" / "かす汁".
    if (tokenAliases.length > 0) {
        const aliasLists = tokenAliases.map(({ aliases }) => aliases.map((a) => normalizeJaText(a)).filter(Boolean))
        const maxCombos = 64
        let combos: string[] = ['']
        for (const list of aliasLists) {
            const next: string[] = []
            for (const base of combos) {
                for (const alias of list.slice(0, 6)) {
                    next.push(base + alias)
                    if (next.length >= maxCombos) break
                }
                if (next.length >= maxCombos) break
            }
            combos = next.length > 0 ? next : combos
            if (combos.length >= maxCombos) break
        }
        for (const combo of combos) variants.add(combo)
    }

    return [...variants]
}

function buildTitleSearchText(recipe: Recipe): string {
    const variants = new Set(generatePhraseVariants(recipe.title))
    for (const reading of getTitleReadingVariantsByKuromoji(recipe.title)) {
        variants.add(reading)
    }
    return [...variants].join(' ')
}

function buildIngredientSearchText(recipe: Recipe): string {
    const parts = new Set<string>()
    for (const ing of recipe.ingredients) {
        for (const variant of generatePhraseVariants(ing.name)) {
            parts.add(variant)
        }
    }
    return [...parts].join(' ')
}

function buildSearchDoc(recipe: Recipe): SearchRecipeDoc {
    const titleSearchText = buildTitleSearchText(recipe)
    const ingredientSearchText = buildIngredientSearchText(recipe)
    const searchText = [titleSearchText, ingredientSearchText].filter(Boolean).join(' ')

    return {
        recipe,
        titleSearchText,
        ingredientSearchText,
        searchText,
    }
}

function getFuseInstance(recipes: Recipe[]): Fuse<SearchRecipeDoc> {
    warmupKuromojiTitleReadings()
    const kuromojiVersion = getKuromojiTokenizerVersion()

    if (fuseInstance && lastRecipes === recipes && lastKuromojiVersion === kuromojiVersion) {
        return fuseInstance
    }
    lastDocs = recipes.map(buildSearchDoc)
    fuseInstance = new Fuse(lastDocs, fuseOptions)
    lastRecipes = recipes
    lastKuromojiVersion = kuromojiVersion
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
            const id = result.item.recipe.id!
            const score = result.score ?? 1
            const existing = resultMap.get(id)
            if (!existing || score < existing.score) {
                resultMap.set(id, { recipe: result.item.recipe, score })
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
