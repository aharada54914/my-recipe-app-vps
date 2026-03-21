import type { AppearanceMode } from '../db/db'

export type ResolvedTheme = 'light' | 'dark'

export const APPEARANCE_STORAGE_KEY = 'appearance_mode_v1'
export const THEME_COLOR_META_SELECTOR = 'meta[name="theme-color"]'

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#F5EFE6',
  dark: '#191613',
}

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function resolveTheme(
  mode: AppearanceMode,
  options: { systemPrefersDark?: boolean } = {},
): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode
  return options.systemPrefersDark ? 'dark' : 'light'
}

export function getStoredAppearanceMode(storage?: Storage): AppearanceMode | null {
  if (!storage) return null

  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY)
    return isAppearanceMode(raw) ? raw : null
  } catch {
    return null
  }
}

export function persistAppearanceMode(mode: AppearanceMode, storage?: Storage): void {
  if (!storage) return

  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, mode)
  } catch {
    // ignore storage errors
  }
}

export function getSystemPrefersDark(win?: Window): boolean {
  if (!win?.matchMedia) return false
  return win.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getResolvedThemeFromDocument(doc?: Document): ResolvedTheme {
  const raw = doc?.documentElement.dataset.theme
  return raw === 'dark' ? 'dark' : 'light'
}

export function applyResolvedTheme(theme: ResolvedTheme, doc?: Document): void {
  if (!doc) return

  doc.documentElement.dataset.theme = theme
  doc.documentElement.style.colorScheme = theme

  const themeColorMeta = doc.querySelector<HTMLMetaElement>(THEME_COLOR_META_SELECTOR)
  themeColorMeta?.setAttribute('content', THEME_COLORS[theme])
}

export function syncAppearanceMode(
  mode: AppearanceMode,
  options: {
    doc?: Document
    storage?: Storage
    win?: Window
  } = {},
): ResolvedTheme {
  const { doc, storage, win } = options
  persistAppearanceMode(mode, storage)
  const resolved = resolveTheme(mode, {
    systemPrefersDark: getSystemPrefersDark(win),
  })
  applyResolvedTheme(resolved, doc)
  return resolved
}
