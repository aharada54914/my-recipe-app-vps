import { describe, expect, it } from 'vitest'
import { resolveRecipeImportStrategy } from '../supportedRecipeSites'

describe('resolveRecipeImportStrategy', () => {
  it('uses gemini-first for foodistnote', () => {
    expect(resolveRecipeImportStrategy('foodistnote.recipe-blog.jp')).toBe('gemini-first')
  })

  it('uses jsonld-first for bazurecipe', () => {
    expect(resolveRecipeImportStrategy('bazurecipe.com')).toBe('jsonld-first')
  })

  it('defaults to jsonld-first for unknown hosts', () => {
    expect(resolveRecipeImportStrategy('unknown.example.com')).toBe('jsonld-first')
  })
})
