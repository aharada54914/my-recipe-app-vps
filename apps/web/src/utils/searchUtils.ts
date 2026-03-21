import Fuse, { type IFuseOptions } from 'fuse.js'
import type { Recipe } from '../db/db'
import {
  buildSearchDocFields,
  buildSearchDocSeed,
  createSearchTerms,
  type SearchDocSeed,
} from './searchIndexCore'
import { normalizeJaText } from './jaText'
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

const fuseOptions: IFuseOptions<SearchRecipeDoc> = {
  keys: [
    { name: 'titleSearchText', weight: 2.4 },
    { name: 'ingredientSearchText', weight: 1.2 },
    { name: 'searchText', weight: 1 },
  ],
  threshold: 0.4,
  distance: 100,
  ignoreLocation: true,
  includeScore: true,
}

const MAX_QUERY_CACHE_SIZE = 24
type ParsedFuseIndexInput = Parameters<typeof Fuse.parseIndex<SearchRecipeDoc>>[0]

let seedDocs: SearchDocSeed[] | null = null
let seedIndexJson: object | null = null
let seedLoadPromise: Promise<void> | null = null
let searchIndexGeneration = 0

let lastRecipes: Recipe[] | null = null
let lastKuromojiVersion = -1
let lastIndexGeneration = -1
let lastSeededFuse: Fuse<SearchRecipeDoc> | null = null
let lastDynamicFuse: Fuse<SearchRecipeDoc> | null = null
let lastSeededDocs: SearchRecipeDoc[] = []
let lastDynamicDocs: SearchRecipeDoc[] = []

const recentQueryCache = new Map<string, SearchScoredRecipe[]>()
const searchTermCache = new Map<string, string[]>()
const termResultCache = new Map<string, Array<{ recipe: Recipe; score: number }>>()

export interface SearchScoredRecipe {
  recipe: Recipe
  queryScore: number
}

function clearSearchCaches(): void {
  lastRecipes = null
  lastKuromojiVersion = -1
  lastIndexGeneration = -1
  lastSeededFuse = null
  lastDynamicFuse = null
  lastSeededDocs = []
  lastDynamicDocs = []
  recentQueryCache.clear()
  termResultCache.clear()
}

async function loadSeedSearchBundle(): Promise<void> {
  if (seedDocs && seedIndexJson) return
  if (seedLoadPromise) return seedLoadPromise

  const base = import.meta.env.BASE_URL || '/'
  const docsUrl = `${base.replace(/\/?$/, '/')}seed/recipe-search-docs.json`
  const indexUrl = `${base.replace(/\/?$/, '/')}seed/recipe-search-index.json`

  seedLoadPromise = Promise.all([
    fetch(docsUrl, { headers: { Accept: 'application/json' } }),
    fetch(indexUrl, { headers: { Accept: 'application/json' } }),
  ])
    .then(async ([docsResponse, indexResponse]) => {
      if (!docsResponse.ok) {
        throw new Error(`Failed to load recipe search docs (${docsResponse.status})`)
      }
      if (!indexResponse.ok) {
        throw new Error(`Failed to load recipe search index (${indexResponse.status})`)
      }

      seedDocs = await docsResponse.json() as SearchDocSeed[]
      seedIndexJson = await indexResponse.json() as object
      searchIndexGeneration += 1
      clearSearchCaches()
    })
    .catch((error) => {
      console.warn('recipe search seed bundle load failed; falling back to runtime index build', error)
    })
    .finally(() => {
      seedLoadPromise = null
    })

  return seedLoadPromise
}

function buildRuntimeSearchDoc(recipe: Recipe): SearchRecipeDoc {
  return {
    recipe,
    ...buildSearchDocFields(
      recipe.title,
      recipe.ingredients.map((ingredient) => ingredient.name),
      getTitleReadingVariantsByKuromoji(recipe.title),
    ),
  }
}

function buildSeedSearchDocs(recipes: Recipe[]): {
  docs: SearchRecipeDoc[]
  uncoveredRecipes: Recipe[]
  canReusePrebuiltIndex: boolean
} {
  if (!seedDocs || !seedIndexJson) {
    return {
      docs: [],
      uncoveredRecipes: recipes,
      canReusePrebuiltIndex: false,
    }
  }

  const recipeByNumber = new Map<string, Recipe>()
  for (const recipe of recipes) {
    recipeByNumber.set(recipe.recipeNumber, recipe)
  }

  const docs: SearchRecipeDoc[] = []
  const seededRecipeNumbers = new Set<string>()

  for (const seedDoc of seedDocs) {
    const recipe = recipeByNumber.get(seedDoc.recipeNumber)
    if (!recipe) continue
    docs.push({
      recipe,
      titleSearchText: seedDoc.titleSearchText,
      ingredientSearchText: seedDoc.ingredientSearchText,
      searchText: seedDoc.searchText,
    })
    seededRecipeNumbers.add(seedDoc.recipeNumber)
  }

  const uncoveredRecipes = recipes.filter((recipe) => !seededRecipeNumbers.has(recipe.recipeNumber))
  return {
    docs,
    uncoveredRecipes,
    canReusePrebuiltIndex: docs.length === seedDocs.length,
  }
}

function getSearchEngines(recipes: Recipe[]): {
  seededFuse: Fuse<SearchRecipeDoc> | null
  dynamicFuse: Fuse<SearchRecipeDoc> | null
  seededDocs: SearchRecipeDoc[]
  dynamicDocs: SearchRecipeDoc[]
} {
  const kuromojiVersion = getKuromojiTokenizerVersion()
  if (
    lastRecipes === recipes
    && lastKuromojiVersion === kuromojiVersion
    && lastIndexGeneration === searchIndexGeneration
  ) {
    return {
      seededFuse: lastSeededFuse,
      dynamicFuse: lastDynamicFuse,
      seededDocs: lastSeededDocs,
      dynamicDocs: lastDynamicDocs,
    }
  }

  const { docs: seededDocs, uncoveredRecipes, canReusePrebuiltIndex } = buildSeedSearchDocs(recipes)
  const dynamicDocs = uncoveredRecipes.map(buildRuntimeSearchDoc)

  lastSeededFuse = seededDocs.length === 0
    ? null
    : canReusePrebuiltIndex && seedIndexJson
      ? new Fuse(seededDocs, fuseOptions, Fuse.parseIndex<SearchRecipeDoc>(seedIndexJson as ParsedFuseIndexInput))
      : new Fuse(seededDocs, fuseOptions)

  lastDynamicFuse = dynamicDocs.length === 0
    ? null
    : new Fuse(dynamicDocs, fuseOptions)

  lastRecipes = recipes
  lastKuromojiVersion = kuromojiVersion
  lastIndexGeneration = searchIndexGeneration
  lastSeededDocs = seededDocs
  lastDynamicDocs = dynamicDocs
  recentQueryCache.clear()

  return {
    seededFuse: lastSeededFuse,
    dynamicFuse: lastDynamicFuse,
    seededDocs: lastSeededDocs,
    dynamicDocs: lastDynamicDocs,
  }
}

function getCachedSearchTerms(query: string): string[] {
  const cached = searchTermCache.get(query)
  if (cached) return cached
  const terms = createSearchTerms(query)
  searchTermCache.set(query, terms)
  return terms
}

function rememberQueryResult(query: string, result: SearchScoredRecipe[]): void {
  if (recentQueryCache.has(query)) {
    recentQueryCache.delete(query)
  }
  recentQueryCache.set(query, result)
  if (recentQueryCache.size > MAX_QUERY_CACHE_SIZE) {
    const oldestKey = recentQueryCache.keys().next().value
    if (oldestKey) recentQueryCache.delete(oldestKey)
  }
}

function getTermResults(
  term: string,
  normalizedTerm: string,
  searchState: {
    seededFuse: Fuse<SearchRecipeDoc> | null
    dynamicFuse: Fuse<SearchRecipeDoc> | null
    seededDocs: SearchRecipeDoc[]
    dynamicDocs: SearchRecipeDoc[]
  },
): Array<{ recipe: Recipe; score: number }> {
  const cacheKey = normalizedTerm ? `${term}\u0000${normalizedTerm}` : term
  const cached = termResultCache.get(cacheKey)
  if (cached) return cached

  const directMatches = [...searchState.seededDocs, ...searchState.dynamicDocs]
    .filter((doc) => {
      if (doc.searchText.includes(term)) return true
      return normalizedTerm.length > 0 && doc.searchText.includes(normalizedTerm)
    })
    .map((doc) => ({
      recipe: doc.recipe,
      score: directMatchScore(doc, term, normalizedTerm),
    }))

  if (directMatches.length > 0) {
    termResultCache.set(cacheKey, directMatches)
    return directMatches
  }

  const resultMap = new Map<number, { recipe: Recipe; score: number }>()
  const engines = [searchState.seededFuse, searchState.dynamicFuse]

  for (const engine of engines) {
    if (!engine) continue
    const results = engine.search(term)
    for (const result of results) {
      const id = result.item.recipe.id
      if (id == null) continue
      const score = result.score ?? 1
      const existing = resultMap.get(id)
      if (!existing || score < existing.score) {
        resultMap.set(id, { recipe: result.item.recipe, score })
      }
    }
  }

  const merged = [...resultMap.values()]
  termResultCache.set(cacheKey, merged)
  return merged
}

function directMatchScore(doc: SearchRecipeDoc, term: string, normalizedTerm: string): number {
  const titleText = doc.titleSearchText
  const ingredientText = doc.ingredientSearchText
  const recipeTitle = doc.recipe.title

  let score = 0.38
  if (ingredientText.includes(term) || (normalizedTerm && ingredientText.includes(normalizedTerm))) score -= 0.1
  if (titleText.includes(term) || (normalizedTerm && titleText.includes(normalizedTerm))) score -= 0.16
  if (recipeTitle.includes(term)) score -= 0.08

  return Math.max(0.01, score)
}

export function warmupRecipeSearchIndex(recipes?: Recipe[]): void {
  if (typeof window === 'undefined') return
  void loadSeedSearchBundle().then(() => {
    if (!recipes || lastRecipes === recipes) return

    const { uncoveredRecipes } = buildSeedSearchDocs(recipes)
    if (uncoveredRecipes.length === 0) return

    warmupKuromojiTitleReadings()

    const warm = () => {
      getSearchEngines(recipes)
    }

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(warm, { timeout: 500 })
      return
    }

    setTimeout(warm, 0)
  })
}

export function setRecipeSearchSeedBundleForTest(
  docs: SearchDocSeed[],
  index: ParsedFuseIndexInput,
): void {
  seedDocs = docs
  seedIndexJson = index as object
  searchIndexGeneration += 1
  clearSearchCaches()
}

export function resetRecipeSearchSeedBundleForTest(): void {
  seedDocs = null
  seedIndexJson = null
  searchIndexGeneration += 1
  clearSearchCaches()
}

export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  return searchRecipesWithScores(recipes, query).map((item) => item.recipe)
}

export function searchRecipesWithScores(recipes: Recipe[], query: string): SearchScoredRecipe[] {
  if (!query.trim()) return recipes.map((recipe) => ({ recipe, queryScore: 0.5 }))

  const cached = recentQueryCache.get(query)
  if (cached) return cached

  const searchState = getSearchEngines(recipes)
  const expandedTerms = getCachedSearchTerms(query)
  const resultMap = new Map<number, { recipe: Recipe; score: number }>()

  for (const term of expandedTerms) {
    const termResults = getTermResults(term, normalizeJaText(term), searchState)
    for (const result of termResults) {
      const id = result.recipe.id
      if (id == null) continue
      const existing = resultMap.get(id)
      if (!existing || result.score < existing.score) {
        resultMap.set(id, result)
      }
    }
  }

  const scored = [...resultMap.values()]
    .sort((left, right) => left.score - right.score)
    .map((entry) => ({
      recipe: entry.recipe,
      queryScore: Math.max(0, 1 - Math.min(1, entry.score)),
    }))

  rememberQueryResult(query, scored)
  return scored
}

export function getExpandedSearchTermsForDebug(query: string): string[] {
  return createSearchTerms(query)
}

export function getRecentSearchSuggestions(history: string[], focused: boolean): string[] {
  if (!focused) return []
  return history.slice(0, 5)
}

export function buildSearchDocSeedForBuild(recipe: Pick<Recipe, 'recipeNumber' | 'title' | 'ingredients'>): SearchDocSeed {
  return buildSearchDocSeed(recipe)
}
