import Fuse from 'fuse.js'
import { expandSynonyms } from '../data/synonyms'
import type { Recipe } from '../db/db'

// Worker message types
interface SearchRequest {
    type: 'search'
    recipes: Recipe[]
    query: string
}

interface SearchResponse {
    type: 'result'
    recipeIds: number[]
}

const FUSE_OPTIONS = {
    keys: [
        { name: 'title', weight: 2.0 },
        { name: 'ingredients.name', weight: 1.0 },
    ],
    threshold: 0.3,
    distance: 100,
    minMatchCharLength: 1,
    includeScore: false,
}

self.onmessage = (e: MessageEvent<SearchRequest>) => {
    const { type, recipes, query } = e.data
    if (type !== 'search') return

    const expandedTerms = expandSynonyms(query)
    const fuse = new Fuse(recipes, FUSE_OPTIONS)

    // Search with each expanded term, then merge results
    const idScores = new Map<number, number>()
    for (const term of expandedTerms) {
        const results = fuse.search(term)
        for (const result of results) {
            const id = result.item.id!
            const existing = idScores.get(id) ?? Infinity
            idScores.set(id, Math.min(existing, result.score ?? 1))
        }
    }

    // Sort by best score
    const sorted = [...idScores.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id)

    const response: SearchResponse = { type: 'result', recipeIds: sorted }
    self.postMessage(response)
}
