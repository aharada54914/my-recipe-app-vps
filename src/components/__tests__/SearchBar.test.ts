import { describe, expect, it } from 'vitest'
import { getRecentSearchSuggestions } from '../../utils/searchUtils'

describe('getRecentSearchSuggestions', () => {
  it('returns empty array when input is not focused', () => {
    const history = ['カレー', 'ハンバーグ']

    expect(getRecentSearchSuggestions(history, false)).toEqual([])
  })

  it('returns the latest 5 search histories when input is focused', () => {
    const history = ['カレー', 'ハンバーグ', '親子丼', '麻婆豆腐', '餃子', 'オムライス']

    expect(getRecentSearchSuggestions(history, true)).toEqual([
      'カレー',
      'ハンバーグ',
      '親子丼',
      '麻婆豆腐',
      '餃子',
    ])
  })
})
