import type { Recipe } from '../db/db'
import { expandSynonyms, synonymMap } from '../data/synonyms'
import { readingMap } from '../data/readings'
import { normalizeJaText } from './jaText'
import { tokenizeJa } from './tokenizeJa'

export interface SearchDocFields {
  titleSearchText: string
  ingredientSearchText: string
  searchText: string
}

export interface SearchDocSeed extends SearchDocFields {
  recipeNumber: string
}

function expandReadingsByCanonical(term: string): string[] {
  const normalized = normalizeJaText(term)
  if (!normalized) return []

  const result = new Set<string>()
  for (const [canonical, readings] of Object.entries(readingMap)) {
    const canonicalNorm = normalizeJaText(canonical)
    if (canonicalNorm === normalized) {
      result.add(canonical)
      for (const reading of readings) result.add(reading)
    }
  }
  return [...result]
}

function lexiconAliases(term: string): string[] {
  const out = new Set<string>([term])
  for (const synonym of expandSynonyms(term)) out.add(synonym)
  for (const reading of expandReadingsByCanonical(term)) out.add(reading)
  return [...out]
}

export function generatePhraseVariants(text: string): string[] {
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

  if (tokenAliases.length > 0) {
    const aliasLists = tokenAliases.map(({ aliases }) =>
      aliases.map((alias) => normalizeJaText(alias)).filter(Boolean),
    )
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

function shouldUseToken(token: string): boolean {
  if (token.length < 2) return false
  if (/^[ぁ-ん]+$/.test(token)) return token.length >= 4
  return true
}

function findCanonicalByReading(term: string): string[] {
  const normalized = normalizeJaText(term)
  if (!normalized) return []

  const matches: string[] = []
  for (const [canonical, readings] of Object.entries(readingMap)) {
    const hasMatch = readings.some((reading) => normalizeJaText(reading) === normalized)
    if (hasMatch) matches.push(canonical)
  }
  return matches
}

export function createSearchTerms(query: string): string[] {
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

export function buildSearchDocFields(
  title: string,
  ingredientNames: string[],
  extraTitleVariants: string[] = [],
): SearchDocFields {
  const titleVariants = new Set(generatePhraseVariants(title))
  for (const variant of extraTitleVariants) {
    if (variant.trim()) titleVariants.add(variant)
  }

  const ingredientVariants = new Set<string>()
  for (const ingredientName of ingredientNames) {
    for (const variant of generatePhraseVariants(ingredientName)) {
      ingredientVariants.add(variant)
    }
  }

  const titleSearchText = [...titleVariants].join(' ')
  const ingredientSearchText = [...ingredientVariants].join(' ')
  return {
    titleSearchText,
    ingredientSearchText,
    searchText: [titleSearchText, ingredientSearchText].filter(Boolean).join(' '),
  }
}

export function buildSearchDocSeed(
  recipe: Pick<Recipe, 'recipeNumber' | 'title' | 'ingredients'>,
  extraTitleVariants: string[] = [],
): SearchDocSeed {
  return {
    recipeNumber: recipe.recipeNumber,
    ...buildSearchDocFields(
      recipe.title,
      recipe.ingredients.map((ingredient) => ingredient.name),
      extraTitleVariants,
    ),
  }
}
