import { describe, it, expect } from 'vitest'
import {
  parseCSV,
  parseIngredientLine,
  estimateCookingSteps,
  detectCSVType,
  parseRawSteps,
} from '../csvParser'

describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const result = parseCSV('a,b,c\n1,2,3')
    expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('handles quoted fields with commas', () => {
    const result = parseCSV('"hello, world",b\n1,2')
    expect(result[0][0]).toBe('hello, world')
  })

  it('handles escaped quotes', () => {
    const result = parseCSV('"say ""hello""",b')
    expect(result[0][0]).toBe('say "hello"')
  })

  it('handles multiline fields', () => {
    const result = parseCSV('"line1\nline2",b')
    expect(result[0][0]).toBe('line1\nline2')
  })

  it('handles empty lines', () => {
    const result = parseCSV('a,b\n\nc,d')
    expect(result).toHaveLength(3)
    expect(result[1]).toEqual([''])
  })

  it('handles CRLF line endings', () => {
    const result = parseCSV('a,b\r\nc,d')
    expect(result).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('parseIngredientLine', () => {
  it('parses ingredient with quantity', () => {
    const result = parseIngredientLine('鶏もも肉: 300g')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('鶏もも肉')
    expect(result!.quantity).toBe(300)
    expect(result!.unit).toBe('g')
  })

  it('parses 適量', () => {
    const result = parseIngredientLine('塩: 適量')
    expect(result!.quantity).toBe(0)
    expect(result!.unit).toBe('適量')
  })

  it('parses fractions', () => {
    const result = parseIngredientLine('砂糖: 大さじ1/2')
    expect(result!.quantity).toBe(0.5)
    expect(result!.unit).toBe('大さじ')
  })

  it('categorizes seasoning as sub', () => {
    const result = parseIngredientLine('醤油: 大さじ2')
    expect(result!.category).toBe('sub')
  })

  it('categorizes main ingredients as main', () => {
    const result = parseIngredientLine('鶏もも肉: 300g')
    expect(result!.category).toBe('main')
  })

  it('returns null for empty string', () => {
    expect(parseIngredientLine('')).toBeNull()
  })

  it('returns null for lines without colon', () => {
    expect(parseIngredientLine('no colon here')).toBeNull()
  })

  it('handles 少々', () => {
    const result = parseIngredientLine('こしょう: 少々')
    expect(result!.quantity).toBe(0)
    expect(result!.unit).toBe('適量')
  })
})

describe('estimateCookingSteps', () => {
  it('creates 3 steps for hotcook', () => {
    const steps = estimateCookingSteps('hotcook', '45分', 5)
    expect(steps).toHaveLength(3)
    expect(steps[0].name).toBe('下ごしらえ')
    expect(steps[1].name).toBe('ホットクック調理')
    expect(steps[1].isDeviceStep).toBe(true)
    expect(steps[2].name).toBe('盛り付け')
  })

  it('creates 3 steps for healsio', () => {
    const steps = estimateCookingSteps('healsio', '30分', 3)
    expect(steps[1].name).toBe('ヘルシオ調理')
    expect(steps[1].isDeviceStep).toBe(true)
  })

  it('creates 3 steps for manual', () => {
    const steps = estimateCookingSteps('manual', '20分', 4)
    expect(steps[1].name).toBe('調理')
    expect(steps[1].isDeviceStep).toBe(false)
  })

  it('clamps prep time between 5 and 20 minutes', () => {
    const fewIngredients = estimateCookingSteps('hotcook', '60分', 1)
    expect(fewIngredients[0].durationMinutes).toBe(5)

    const manyIngredients = estimateCookingSteps('hotcook', '60分', 20)
    expect(manyIngredients[0].durationMinutes).toBe(20)
  })
})

describe('detectCSVType', () => {
  it('detects hotcook CSV by メニュー番号', () => {
    expect(detectCSVType('メニュー名,メニュー番号,分量')).toBe('hotcook')
  })

  it('detects healsio CSV by 塩分', () => {
    expect(detectCSVType('メニュー名,分量,カロリー,塩分')).toBe('healsio')
  })

  it('returns null for unknown format', () => {
    expect(detectCSVType('unknown,header,format')).toBeNull()
  })
})

describe('parseRawSteps', () => {
  it('splits by newline and strips numbers', () => {
    const result = parseRawSteps('1 材料を切る\n2 煮る\n3 盛り付ける')
    expect(result).toEqual(['材料を切る', '煮る', '盛り付ける'])
  })

  it('returns empty array for empty string', () => {
    expect(parseRawSteps('')).toEqual([])
  })

  it('filters out empty lines', () => {
    const result = parseRawSteps('切る\n\n煮る')
    expect(result).toEqual(['切る', '煮る'])
  })
})
