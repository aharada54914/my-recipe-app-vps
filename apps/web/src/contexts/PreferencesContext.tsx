import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppearanceMode, UserPreferences } from '../db/db'
import { PreferencesContext } from './preferencesContextDef'
import {
  ensurePreferencesRecord,
  getStoredPreferences,
  hasRemotePreferencesSession,
  mergeWithDefaultPreferences,
  resetStoredPreferences,
  resetRemotePreferences,
  syncStoredPreferencesFromRemote,
  updateStoredPreferences,
  updateRemotePreferences,
} from '../repositories/preferencesRepository'
import { runPreferencesStartupTasks } from '../services/preferencesStartup'
import {
  getResolvedThemeFromDocument,
  getSystemPrefersDark,
  resolveTheme,
  syncAppearanceMode,
  type ResolvedTheme,
} from '../lib/theme'

export type { PreferencesContextValue } from './preferencesContextDef'

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [hasRemoteSession, setHasRemoteSession] = useState<boolean>(() => hasRemotePreferencesSession())
  // Return null when loaded-but-empty to distinguish from undefined (still loading)
  const stored = useLiveQuery(async () => {
    const prefs = await getStoredPreferences()
    return prefs ?? null
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncRemoteSession = () => {
      setHasRemoteSession(hasRemotePreferencesSession())
    }

    window.addEventListener('storage', syncRemoteSession)
    const interval = window.setInterval(syncRemoteSession, 1000)

    return () => {
      window.removeEventListener('storage', syncRemoteSession)
      window.clearInterval(interval)
    }
  }, [])

  // Auto-create default preferences if none exist
  useEffect(() => {
    if (stored === undefined) return // still loading
    if (stored === null) {
      void ensurePreferencesRecord()
    }
  }, [stored])

  useEffect(() => {
    if (stored === undefined || stored === null || !stored.id) return
    void runPreferencesStartupTasks(stored)
  }, [stored])

  useEffect(() => {
    if (!hasRemoteSession) return

    void syncStoredPreferencesFromRemote().catch((err: unknown) => {
      console.warn('Failed to sync preferences from server, using local cache instead.', err)
    })
  }, [hasRemoteSession])

  const preferences: UserPreferences = mergeWithDefaultPreferences(stored)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    getResolvedThemeFromDocument(typeof document !== 'undefined' ? document : undefined)
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const applyCurrentTheme = () => {
      const nextResolved = syncAppearanceMode(preferences.appearanceMode, {
        doc: document,
        storage: window.localStorage,
        win: window,
      })
      setResolvedTheme(nextResolved)
    }

    applyCurrentTheme()

    if (preferences.appearanceMode !== 'system' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const nextResolved = resolveTheme('system', {
        systemPrefersDark: getSystemPrefersDark(window),
      })
      setResolvedTheme(nextResolved)
      syncAppearanceMode('system', {
        doc: document,
        storage: window.localStorage,
        win: window,
      })
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [preferences.appearanceMode])

  const updatePreference = useCallback(async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    if (!preferences.id) return
    const updates = {
      [key]: value,
    } as Partial<UserPreferences>

    if (hasRemoteSession) {
      try {
        await updateRemotePreferences(updates)
        return
      } catch (err) {
        console.warn('Failed to persist preference to server, falling back to local storage.', err)
      }
    }

    await updateStoredPreferences(preferences.id, updates)
  }, [hasRemoteSession, preferences.id])

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!preferences.id) return
    if (hasRemoteSession) {
      try {
        await updateRemotePreferences(updates)
        return
      } catch (err) {
        console.warn('Failed to persist preferences to server, falling back to local storage.', err)
      }
    }

    await updateStoredPreferences(preferences.id, updates)
  }, [hasRemoteSession, preferences.id])

  const setAppearanceMode = useCallback(async (mode: AppearanceMode) => {
    if (!preferences.id) return
    if (hasRemoteSession) {
      try {
        await updateRemotePreferences({ appearanceMode: mode })
        return
      } catch (err) {
        console.warn('Failed to persist appearance mode to server, falling back to local storage.', err)
      }
    }

    await updateStoredPreferences(preferences.id, { appearanceMode: mode })
  }, [hasRemoteSession, preferences.id])

  const resetToDefaults = useCallback(async () => {
    if (!preferences.id) return
    if (hasRemoteSession) {
      try {
        await resetRemotePreferences()
        return
      } catch (err) {
        console.warn('Failed to reset preferences on server, falling back to local storage.', err)
      }
    }

    await resetStoredPreferences(preferences.id)
  }, [hasRemoteSession, preferences.id])

  return (
    <PreferencesContext.Provider
      value={{ preferences, resolvedTheme, updatePreference, updatePreferences, setAppearanceMode, resetToDefaults }}
    >
      {children}
    </PreferencesContext.Provider>
  )
}
