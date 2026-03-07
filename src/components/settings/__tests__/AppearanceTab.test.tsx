// @vitest-environment jsdom

import { act } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppearanceTab } from '../AppearanceTab'
import { PreferencesContext, DEFAULT_PREFERENCES, type PreferencesContextValue } from '../../../contexts/preferencesContextDef'

let container: HTMLDivElement

function renderWithPreferences(value: PreferencesContextValue) {
  const root = createRoot(container)
  act(() => {
    root.render(
      createElement(
        PreferencesContext.Provider,
        { value },
        createElement(AppearanceTab),
      ),
    )
  })
  return root
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  container.remove()
})

describe('AppearanceTab', () => {
  it('shows the current resolved theme state', () => {
    const root = renderWithPreferences({
      preferences: { ...DEFAULT_PREFERENCES, id: 1, appearanceMode: 'system' },
      resolvedTheme: 'dark',
      updatePreference: vi.fn(async () => {}),
      updatePreferences: vi.fn(async () => {}),
      setAppearanceMode: vi.fn(async () => {}),
      resetToDefaults: vi.fn(async () => {}),
    })

    expect(container.textContent).toContain('ダークテーマを適用中')
    expect(container.textContent).toContain('システム連動')

    act(() => {
      root.unmount()
    })
  })

  it('calls setAppearanceMode when a mode button is pressed', () => {
    const setAppearanceMode = vi.fn(async () => {})
    const root = renderWithPreferences({
      preferences: { ...DEFAULT_PREFERENCES, id: 1, appearanceMode: 'system' },
      resolvedTheme: 'light',
      updatePreference: vi.fn(async () => {}),
      updatePreferences: vi.fn(async () => {}),
      setAppearanceMode,
      resetToDefaults: vi.fn(async () => {}),
    })

    const lightButton = container.querySelector('[data-testid="appearance-mode-light"]')
    expect(lightButton).not.toBeNull()

    act(() => {
      lightButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(setAppearanceMode).toHaveBeenCalledWith('light')

    act(() => {
      root.unmount()
    })
  })
})
