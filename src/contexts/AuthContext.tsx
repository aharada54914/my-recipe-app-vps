import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { AuthContext } from './authContextDef'
import type { GoogleUser, AuthContextValue } from './authContextDef'

export type { GoogleUser, AuthContextValue }

const USER_KEY = 'google_user'
const TOKEN_KEY = 'google_access_token'
const TOKEN_EXPIRY_KEY = 'google_token_expiry'
const GOOGLE_CLIENT_ID_KEY = 'google_client_id'

function getPersistedAuthItem(key: string): string | null {
  try {
    const localValue = localStorage.getItem(key)
    if (localValue) return localValue

    const sessionValue = sessionStorage.getItem(key)
    if (sessionValue) {
      localStorage.setItem(key, sessionValue)
      sessionStorage.removeItem(key)
      return sessionValue
    }
  } catch {
    // ignore storage errors
  }

  return null
}

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

function loadStoredToken(): string | null {
  const token = getPersistedAuthItem(TOKEN_KEY)
  const expiry = getPersistedAuthItem(TOKEN_EXPIRY_KEY)
  if (token && expiry && new Date(expiry) > new Date()) return token
  return null
}

function loadStoredUser(): GoogleUser | null {
  try {
    const stored = getPersistedAuthItem(USER_KEY)
    return stored ? (JSON.parse(stored) as GoogleUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(() => loadStoredUser())
  const [loading, setLoading] = useState(false)
  const [providerToken, setProviderToken] = useState<string | null>(() => loadStoredToken())
  // Use state for client ID to allow dynamic updates from settings
  const [clientId, setClientId] = useState<string | undefined>(() => {
    return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || undefined
  })

  // Listen for local storage changes from other tabs/components
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || undefined
      if (stored !== clientId && !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        setClientId(stored)
      }
    }
    window.addEventListener('storage', handleStorage)
    // Also poll occasionally in case of same-window manual changes
    const interval = setInterval(handleStorage, 1000)
    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [clientId])

  const storeToken = useCallback((token: string, expiresIn: number) => {
    const expiry = new Date(Date.now() + expiresIn * 1000).toISOString()
    try {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiry)
    } catch { /* ignore storage errors */ }
    setProviderToken(token)
  }, [])

  if (!clientId) {
    const signInWithGoogle = () => { }

    const signOut = () => {
      setUser(null)
      setProviderToken(null)
      try {
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(TOKEN_EXPIRY_KEY)
      } catch { /* ignore */ }
    }

    return (
      <AuthContext.Provider value={{ user, loading: false, isOAuthAvailable: false, providerToken, signInWithGoogle, signOut }}>
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <OAuthEnabledAuthProvider
      user={user}
      loading={loading}
      providerToken={providerToken}
      setLoading={setLoading}
      setUser={setUser}
      storeToken={storeToken}
      setProviderToken={setProviderToken}
    >
      {children}
    </OAuthEnabledAuthProvider>
  )
}

interface OAuthEnabledAuthProviderProps {
  user: GoogleUser | null
  loading: boolean
  providerToken: string | null
  setLoading: (value: boolean) => void
  setUser: (value: GoogleUser | null) => void
  storeToken: (token: string, expiresIn: number) => void
  setProviderToken: (value: string | null) => void
  children: ReactNode
}

function OAuthEnabledAuthProvider({
  user,
  loading,
  providerToken,
  setLoading,
  setUser,
  storeToken,
  setProviderToken,
  children,
}: OAuthEnabledAuthProviderProps) {
  // Silent refresh: no UI prompt, uses existing Google session cookie
  const silentGoogleLogin = useGoogleLogin({
    scope: SCOPES,
    prompt: 'none',
    onSuccess: (tokenResponse) => {
      storeToken(tokenResponse.access_token, tokenResponse.expires_in)
    },
    onError: () => {
      // Silent refresh failed (Google session expired) — clear auth state so login UI reappears
      setUser(null)
      setProviderToken(null)
      try {
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(TOKEN_EXPIRY_KEY)
      } catch { /* ignore */ }
    },
  })

  const googleLogin = useGoogleLogin({
    scope: SCOPES,
    onSuccess: async (tokenResponse) => {
      storeToken(tokenResponse.access_token, tokenResponse.expires_in)
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        if (res.ok) {
          const userInfo = (await res.json()) as GoogleUser
          setUser(userInfo)
          localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
        }
      } catch { /* ignore fetch errors */ }
      setLoading(false)
    },
    onError: () => {
      setLoading(false)
    },
  })

  const signInWithGoogle = useCallback(() => {
    setLoading(true)
    googleLogin()
  }, [googleLogin, setLoading])

  const signOut = useCallback(() => {
    setUser(null)
    setProviderToken(null)
    try {
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRY_KEY)
    } catch { /* ignore */ }
  }, [setProviderToken, setUser])

  // On mount and whenever token disappears: attempt silent refresh if user is known
  useEffect(() => {
    if (user && !providerToken) {
      silentGoogleLogin()
    }
  }, [user, providerToken, silentGoogleLogin])

  // Schedule silent refresh 5 minutes before token expires
  useEffect(() => {
    if (!providerToken) return
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (!expiry) return
    const msUntilRefresh = new Date(expiry).getTime() - Date.now() - 5 * 60 * 1000
    if (msUntilRefresh <= 0) {
      silentGoogleLogin()
      return
    }
    const timer = setTimeout(silentGoogleLogin, msUntilRefresh)
    return () => clearTimeout(timer)
  }, [providerToken, silentGoogleLogin])

  // iOS PWA: refresh when app comes back to foreground after being backgrounded
  useEffect(() => {
    if (!user) return
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
      if (!expiry || new Date(expiry) <= new Date()) {
        silentGoogleLogin()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user, silentGoogleLogin])

  return (
    <AuthContext.Provider value={{ user, loading, isOAuthAvailable: true, providerToken, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
