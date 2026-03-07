// @vitest-environment jsdom

import { act } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchBar } from '../SearchBar'
import { getRecentSearchSuggestions } from '../../utils/searchUtils'

let container: HTMLDivElement

beforeEach(() => {
  vi.useFakeTimers()
  // Silence React 19 act environment warnings for manual root rendering.
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
})

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
    container.remove()
  })

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

describe('SearchBar IME-safe behavior', () => {
  it('does not commit partial values during composition and commits final value on compositionend', () => {
    const handleChange = vi.fn()
    const root = createRoot(container)

    act(() => {
      root.render(createElement(SearchBar, { value: '', onChange: handleChange }))
    })

    const input = container.querySelector('input')
    expect(input).not.toBeNull()

    act(() => {
      input!.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      input!.value = 'ぴ'
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      vi.advanceTimersByTime(200)
    })

    expect(handleChange).not.toHaveBeenCalled()

    act(() => {
      input!.value = 'ぴー'
      input!.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    })

    expect(handleChange).toHaveBeenCalledWith('ぴー')

    act(() => {
      root.unmount()
    })
  })

  it('hides recent suggestions while the user has a non-empty draft', () => {
    const root = createRoot(container)

    act(() => {
      root.render(createElement(SearchBar, {
        value: 'て',
        onChange: vi.fn(),
        history: ['カレー', 'ハンバーグ'],
      }))
    })

    const input = container.querySelector('input')
    expect(input).not.toBeNull()

    act(() => {
      input!.focus()
    })

    expect(container.textContent).not.toContain('カレー')
    expect(container.textContent).not.toContain('ハンバーグ')

    act(() => {
      root.unmount()
    })
  })

  it('commits the final draft on blur for URL-safe sync flows', () => {
    const handleChange = vi.fn()
    const handleBlurCommit = vi.fn()
    const root = createRoot(container)

    act(() => {
      root.render(createElement(SearchBar, {
        value: '',
        onChange: handleChange,
        onBlurCommit: handleBlurCommit,
      }))
    })

    const input = container.querySelector('input')
    expect(input).not.toBeNull()

    act(() => {
      input!.focus()
      input!.value = 'てばもと'
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      input!.dispatchEvent(new Event('change', { bubbles: true }))
      vi.advanceTimersByTime(200)
      input!.blur()
      vi.advanceTimersByTime(150)
    })

    expect(handleChange).toHaveBeenCalledWith('てばもと')
    expect(handleBlurCommit).toHaveBeenCalledWith('てばもと')

    act(() => {
      root.unmount()
    })
  })
})
