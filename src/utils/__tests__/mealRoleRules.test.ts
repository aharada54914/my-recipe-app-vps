import { describe, expect, it } from 'vitest'
import { filterRecipesByRole, isRecipeAllowedForRole } from '../mealRoleRules'

describe('mealRoleRules', () => {
  const fixtures = [
    { title: '肉じゃが', category: '主菜' as const },
    { title: '親子丼', category: '一品料理' as const },
    { title: 'ほうれん草のおひたし', category: '副菜' as const },
    { title: '味噌汁', category: 'スープ' as const },
    { title: 'プリン', category: 'スイーツ' as const },
  ]

  it('allows only 主菜/一品料理 for main role', () => {
    expect(isRecipeAllowedForRole(fixtures[0], 'main')).toBe(true)
    expect(isRecipeAllowedForRole(fixtures[1], 'main')).toBe(true)
    expect(isRecipeAllowedForRole(fixtures[2], 'main')).toBe(false)
    expect(isRecipeAllowedForRole(fixtures[4], 'main')).toBe(false)
  })

  it('allows only 副菜/スープ for side role', () => {
    expect(isRecipeAllowedForRole(fixtures[2], 'side')).toBe(true)
    expect(isRecipeAllowedForRole(fixtures[3], 'side')).toBe(true)
    expect(isRecipeAllowedForRole(fixtures[0], 'side')).toBe(false)
    expect(isRecipeAllowedForRole(fixtures[4], 'side')).toBe(false)
  })

  it('filters recipes by requested role', () => {
    const mains = filterRecipesByRole(fixtures, 'main')
    const sides = filterRecipesByRole(fixtures, 'side')

    expect(mains.map((r) => r.category)).toEqual(['主菜', '一品料理'])
    expect(sides.map((r) => r.category)).toEqual(['副菜', 'スープ'])
  })
})
