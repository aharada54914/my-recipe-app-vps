// @vitest-environment jsdom

import { act } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CalendarEventRecord,
  Favorite,
  Recipe,
  ViewHistory,
  WeeklyMenu,
} from '../../db/db'
import { useRecipeSearchModel } from '../useRecipeSearchModel'
import { createEmptyRecipeSearchFacets } from '../../utils/searchFacets'

let container: HTMLDivElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  vi.useRealTimers()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  container.remove()
})

function makeRecipe(
  id: number,
  title: string,
  ingredientName: string,
): Recipe {
  return {
    id,
    title,
    recipeNumber: `R-${id}`,
    device: 'hotcook',
    category: '主菜',
    baseServings: 2,
    totalWeightG: 400,
    ingredients: [{ name: ingredientName, quantity: 200, unit: 'g', category: 'main' }],
    steps: [{ name: '調理', durationMinutes: 20 }],
    totalTimeMinutes: 20,
  }
}

function Probe(props: {
  input: {
    recipes: Recipe[]
    stockItems: Array<{ name: string }>
    viewHistory: ViewHistory[]
    favorites: Favorite[]
    weeklyMenus: WeeklyMenu[]
    calendarEvents: CalendarEventRecord[]
    searchQuery: string
    facets: ReturnType<typeof createEmptyRecipeSearchFacets>
    now?: Date
  }
  onResult: (recipeIds: number[]) => void
}) {
  const model = useRecipeSearchModel(props.input)
  props.onResult(model.results.map((entry) => entry.recipe.id!).filter((id): id is number => id != null))
  return null
}

describe('useRecipeSearchModel', () => {
  it('passes input.now through to the static search context', () => {
    const root = createRoot(container)
    const recipes = [
      makeRecipe(1, 'お気に入りの煮物', 'ごぼう'),
      makeRecipe(2, '在庫ぴったり炒め', 'にんじん'),
    ]
    const latestResult: { ids: number[] } = { ids: [] }

    act(() => {
      root.render(createElement(Probe, {
        input: {
          recipes,
          stockItems: [{ name: 'にんじん' }],
          viewHistory: [],
          favorites: [{ id: 1, recipeId: 1, addedAt: new Date('2026-03-02T10:00:00Z') }],
          weeklyMenus: [],
          calendarEvents: [],
          searchQuery: '',
          facets: createEmptyRecipeSearchFacets(),
          now: new Date('2026-03-03T00:00:00Z'),
        },
        onResult: (ids) => {
          latestResult.ids = ids
        },
      }))
    })

    expect(latestResult.ids[0]).toBe(1)

    act(() => {
      root.unmount()
    })
  })
})
