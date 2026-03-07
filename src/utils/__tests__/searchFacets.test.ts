import { describe, expect, it } from 'vitest'
import {
  buildRecipeSearchFacetChips,
  createEmptyRecipeSearchFacets,
  createRecipeSearchParams,
  parseRecipeSearchFacetsFromParams,
  toggleRecipeSearchCategory,
  toggleRecipeSearchDevice,
  toggleRecipeSearchFlag,
} from '../searchFacets'

describe('searchFacets', () => {
  it('toggles devices and categories without clearing other facet groups', () => {
    let facets = createEmptyRecipeSearchFacets()
    facets = toggleRecipeSearchDevice(facets, 'hotcook')
    facets = toggleRecipeSearchFlag(facets, 'quick')
    facets = toggleRecipeSearchCategory(facets, '主菜')

    expect(facets).toEqual({
      devices: ['hotcook'],
      categories: ['主菜'],
      quick: true,
      seasonal: false,
    })
  })

  it('parses legacy single filter params', () => {
    const searchParams = new URLSearchParams('filter=device:hotcook')

    expect(parseRecipeSearchFacetsFromParams(searchParams)).toEqual({
      devices: ['hotcook'],
      categories: [],
      quick: false,
      seasonal: false,
    })
  })

  it('serializes and parses combined facet params', () => {
    const original = {
      devices: ['hotcook', 'healsio'] as const,
      categories: ['主菜', '副菜'] as const,
      quick: true,
      seasonal: true,
    }
    const params = createRecipeSearchParams('鶏肉', {
      devices: [...original.devices],
      categories: [...original.categories],
      quick: original.quick,
      seasonal: original.seasonal,
    })

    expect(params.toString()).toBe('q=%E9%B6%8F%E8%82%89&devices=hotcook%2Chealsio&categories=%E4%B8%BB%E8%8F%9C%2C%E5%89%AF%E8%8F%9C&quick=1&seasonal=1')
    expect(parseRecipeSearchFacetsFromParams(params)).toEqual({
      devices: ['hotcook', 'healsio'],
      categories: ['主菜', '副菜'],
      quick: true,
      seasonal: true,
    })
  })

  it('builds removable chips for each active facet', () => {
    const chips = buildRecipeSearchFacetChips({
      devices: ['hotcook'],
      categories: ['主菜'],
      quick: true,
      seasonal: false,
    })

    expect(chips).toEqual([
      { key: 'device:hotcook', label: 'ホットクック', type: 'device' },
      { key: 'category:主菜', label: '主菜', type: 'category' },
      { key: 'quick', label: '時短 30分以内', type: 'quick' },
    ])
  })
})
