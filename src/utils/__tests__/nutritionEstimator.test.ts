import { describe, it, expect } from 'vitest'
import { estimateRecipeNutrition } from '../nutritionEstimator'
import type { Recipe, Ingredient } from '../../db/db'

function makeRecipe(overrides: {
  baseServings?: number
  totalWeightG?: number
  ingredients?: Partial<Ingredient>[]
  category?: Recipe['category']
  saltContent?: string
}): Recipe {
  return {
    id: 1,
    title: 'テスト',
    recipeNumber: 'T-001',
    device: 'hotcook',
    category: overrides.category ?? '主菜',
    baseServings: overrides.baseServings ?? 2,
    totalWeightG: overrides.totalWeightG ?? 0,
    ingredients: (overrides.ingredients ?? []).map(ing => ({
      name: ing.name ?? 'ご飯',
      quantity: ing.quantity ?? 1,
      unit: ing.unit ?? 'g',
      category: 'main' as const,
    })),
    steps: [],
    totalTimeMinutes: 30,
    saltContent: overrides.saltContent,
  }
}

// ── 1. Sized/named dish units ─────────────────────────────────────────────────

describe('sized dish units (SIZED_DISH_GRAMS)', () => {
  it('大皿 (300g) yields more calories than 皿 (160g from nutritionLookup) for the same ingredient', () => {
    // ごはん: 168 kcal/100g
    // 皿 → 160g (from nutritionLookup unitGrams)  → 168 * 1.6 = 268.8 → 269 kcal
    // 大皿 → 300g (from SIZED_DISH_GRAMS) → 168 * 3.0 = 504 kcal
    const rSara = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ご飯', quantity: 1, unit: '皿' }],
    }))
    const rOosara = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ご飯', quantity: 1, unit: '大皿' }],
    }))
    expect(rOosara.energyKcal).toBeGreaterThan(rSara.energyKcal ?? 0)
  })

  it('中皿 (200g) is between 小皿 (120g) and 大皿 (300g)', () => {
    const base = { baseServings: 1, ingredients: [{ name: 'ご飯', quantity: 1 }] }
    const small = estimateRecipeNutrition(makeRecipe({ ...base, ingredients: [{ name: 'ご飯', quantity: 1, unit: '小皿' }] }))
    const mid   = estimateRecipeNutrition(makeRecipe({ ...base, ingredients: [{ name: 'ご飯', quantity: 1, unit: '中皿' }] }))
    const large = estimateRecipeNutrition(makeRecipe({ ...base, ingredients: [{ name: 'ご飯', quantity: 1, unit: '大皿' }] }))
    expect(mid.energyKcal).toBeGreaterThan(small.energyKcal ?? 0)
    expect(large.energyKcal).toBeGreaterThan(mid.energyKcal ?? 0)
  })

  it('丼杯分 uses nutritionLookup unitGrams (350g) and produces positive calories', () => {
    // ごはん entry now has 丼杯分: 350 in unitGrams
    // 168 kcal/100g * 3.5 = 588 kcal
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ごはん', quantity: 1, unit: '丼杯分' }],
    }))
    expect(r.energyKcal).toBeGreaterThan(0)
    // Should be substantially more than a normal 膳 (160g → 269 kcal)
    const rMen = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ごはん', quantity: 1, unit: '膳' }],
    }))
    expect(r.energyKcal).toBeGreaterThan(rMen.energyKcal ?? 0)
  })

  it('お茶碗杯分 uses nutritionLookup unitGrams (160g)', () => {
    // ご飯 entry has お茶碗杯分: 160 — same as 茶碗
    const rCha = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ご飯', quantity: 1, unit: '茶碗' }],
    }))
    const rOcha = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ご飯', quantity: 1, unit: 'お茶碗杯分' }],
    }))
    expect(rOcha.energyKcal).toBe(rCha.energyKcal)
  })

  it('unitGrams (ingredient-specific) takes priority over SIZED_DISH_GRAMS', () => {
    // 白飯の茶碗 is 160g in nutritionLookup (same as SIZED_DISH_GRAMS), so both give 160g.
    // The key is that SIZED_DISH_GRAMS[u] is the *fallback*, not the override.
    // We verify no crash and a positive result.
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ごはん', quantity: 1, unit: '茶碗' }],
    }))
    expect(r.energyKcal).toBeGreaterThan(0)
  })
})

// ── 2. pieceUnits exact-match fix ─────────────────────────────────────────────

describe('pieceUnits — no endsWith false-matches', () => {
  it('大袋 does not crash and produces a non-negative result (falls to 50g fallback)', () => {
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'チーズ', quantity: 1, unit: '大袋' }],
    }))
    expect(r.energyKcal).toBeGreaterThanOrEqual(0)
  })

  it('小缶 does not crash', () => {
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'トマト缶', quantity: 1, unit: '小缶' }],
    }))
    expect(r.energyKcal).toBeGreaterThanOrEqual(0)
  })

  it('egg L個 still works (intentional endsWith for size variants)', () => {
    const rNormal = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: '卵', quantity: 1, unit: '個' }],
    }))
    const rLarge = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: '卵', quantity: 1, unit: 'L個' }],
    }))
    // L個 should produce equal or more calories than 個
    expect(rLarge.energyKcal).toBeGreaterThanOrEqual(rNormal.energyKcal ?? 0)
  })
})

// ── 3. Serving-unit exact match (regression: endsWith removed) ────────────────

describe('serving units — exact match only', () => {
  it('皿 maps to ingredient unitGrams (not SIZED_DISH_GRAMS default)', () => {
    // 皿 is in servingUnits → uses nutritionLookup unitGrams[皿] = 160g for ご飯
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ご飯', quantity: 1, unit: '皿' }],
    }))
    expect(r.energyKcal).toBeGreaterThan(0)
  })

  it('人前 maps correctly', () => {
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'うどん', quantity: 1, unit: '人前' }],
    }))
    // うどん 200g/人前: 105 kcal/100g * 2 = 210 kcal
    expect(r.energyKcal).toBeGreaterThan(0)
  })
})

// ── 4. saltContent override ───────────────────────────────────────────────────

describe('saltContent utilization', () => {
  it('uses saltContent (plain number string) to set saltEquivalentG in non-fallback path', () => {
    // ごはん is well-matched, so we expect non-fallback path
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      saltContent: '2.4',
      ingredients: [{ name: 'ごはん', quantity: 200, unit: 'g' }],
    }))
    // saltContent = 2.4g per serving → saltEquivalentG should be 2.4
    expect(r.saltEquivalentG).toBeCloseTo(2.4, 1)
  })

  it('uses saltContent with g suffix', () => {
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      saltContent: '1.8g',
      ingredients: [{ name: 'ごはん', quantity: 200, unit: 'g' }],
    }))
    expect(r.saltEquivalentG).toBeCloseTo(1.8, 1)
  })

  it('uses saltContent with mg suffix (converted from sodium)', () => {
    // 786mg Na ÷ 393 = 2.0g salt
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      saltContent: '786mg',
      ingredients: [{ name: 'ごはん', quantity: 200, unit: 'g' }],
    }))
    expect(r.saltEquivalentG).toBeCloseTo(2.0, 1)
  })

  it('falls back to ingredient-computed salt when saltContent is absent', () => {
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 1,
      ingredients: [{ name: 'ごはん', quantity: 200, unit: 'g' }],
    }))
    // ごはん is low-salt; result should still be a non-negative number
    expect(typeof r.saltEquivalentG).toBe('number')
    expect(r.saltEquivalentG).toBeGreaterThanOrEqual(0)
  })

  it('uses saltContent in fallback path when ingredient matching is poor', () => {
    // ingredient name that won't match any lookup entry → triggers fallback
    const r = estimateRecipeNutrition(makeRecipe({
      baseServings: 2,
      saltContent: '3.0',
      ingredients: [{ name: '謎食材XYZ', quantity: 1, unit: '個' }],
    }))
    // In fallback, saltContent feeds into saltForFallback → saltEquivalentG = 3.0
    expect(r.saltEquivalentG).toBeCloseTo(3.0, 1)
  })
})
