// @vitest-environment jsdom

import { act } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BottomNav } from '../BottomNav'

let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  container.remove()
})

describe('BottomNav', () => {
  it('renders labels for all primary tabs', () => {
    const root = createRoot(container)

    act(() => {
      root.render(
        createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(BottomNav)),
      )
    })

    expect(container.querySelector('[data-testid="bottom-nav-home"]')?.textContent).toContain('ホーム')
    expect(container.querySelector('[data-testid="bottom-nav-menu"]')?.textContent).toContain('献立')
    expect(container.querySelector('[data-testid="bottom-nav-gemini"]')?.textContent).toContain('Gemini')
    expect(container.querySelector('[data-testid="bottom-nav-favorites"]')?.textContent).toContain('お気に入り')
    expect(container.querySelector('[data-testid="bottom-nav-history"]')?.textContent).toContain('履歴')

    act(() => {
      root.unmount()
    })
  })

  it('marks the matching route as active', () => {
    const root = createRoot(container)

    act(() => {
      root.render(
        createElement(MemoryRouter, { initialEntries: ['/gemini'] }, createElement(BottomNav)),
      )
    })

    expect(container.querySelector('[data-testid="bottom-nav-gemini"]')?.getAttribute('aria-current')).toBe('page')
    expect(container.querySelector('[data-testid="bottom-nav-home"]')?.getAttribute('aria-current')).toBeNull()

    act(() => {
      root.unmount()
    })
  })
})
