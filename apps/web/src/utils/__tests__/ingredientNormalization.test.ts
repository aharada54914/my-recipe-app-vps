import { describe, expect, it } from 'vitest'
import { normalizeIngredientName } from '../ingredientNormalization'

describe('normalizeIngredientName', () => {
  it('normalizes known synonyms used in recipe CSVs', () => {
    expect(normalizeIngredientName('ささ身')).toBe('鶏ささみ')
    expect(normalizeIngredientName('市販のカレールウ')).toBe('カレールウ')
    expect(normalizeIngredientName('好みのドレッシング')).toBe('ドレッシング')
    expect(normalizeIngredientName('梅肉')).toBe('梅干し')
    expect(normalizeIngredientName('ハーブミックス')).toBe('パセリ')
    expect(normalizeIngredientName('SHOWAまんまるおおきなホットケーキのもと')).toBe('ホットケーキミックス')
    expect(normalizeIngredientName('きぬさや')).toBe('さやいんげん')
    expect(normalizeIngredientName('好みのハーブ')).toBe('パセリ')
    expect(normalizeIngredientName('中華めん')).toBe('中華麺')
    expect(normalizeIngredientName('赤')).toBe('パプリカ')
    expect(normalizeIngredientName('黄')).toBe('パプリカ')
    expect(normalizeIngredientName('緑')).toBe('ピーマン')
  })

  it('removes wrappers and polite prefixes', () => {
    expect(normalizeIngredientName('お好みの きのこ（お好きな種類）')).toBe('マッシュルーム')
  })
})
