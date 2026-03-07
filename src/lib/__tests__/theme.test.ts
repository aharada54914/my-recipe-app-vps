// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyResolvedTheme,
  getStoredAppearanceMode,
  resolveTheme,
  syncAppearanceMode,
  THEME_COLORS,
  type ResolvedTheme,
} from '../theme'

describe('theme utilities', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    localStorage.clear()
    document.head.innerHTML = '<meta name="theme-color" content="#000000">'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves system appearance using the current system preference', () => {
    expect(resolveTheme('system', { systemPrefersDark: false })).toBe('light')
    expect(resolveTheme('system', { systemPrefersDark: true })).toBe('dark')
    expect(resolveTheme('light', { systemPrefersDark: true })).toBe('light')
  })

  it('returns only valid persisted appearance modes', () => {
    localStorage.setItem('appearance_mode_v1', 'dark')
    expect(getStoredAppearanceMode(localStorage)).toBe('dark')

    localStorage.setItem('appearance_mode_v1', 'invalid')
    expect(getStoredAppearanceMode(localStorage)).toBeNull()
  })

  it('applies the resolved theme to the document and theme-color meta tag', () => {
    applyResolvedTheme('dark', document)

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(THEME_COLORS.dark)
  })

  it('syncs appearance mode to storage and resolves against matchMedia', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    const win = { localStorage, matchMedia } as unknown as Window

    const resolved = syncAppearanceMode('system', {
      doc: document,
      storage: localStorage,
      win,
    })

    expect(resolved).toBe('dark')
    expect(localStorage.getItem('appearance_mode_v1')).toBe('system')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it.each<ResolvedTheme>(['light', 'dark'])('writes theme-color for %s theme', (theme) => {
    applyResolvedTheme(theme, document)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(THEME_COLORS[theme])
  })
})
