import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { AuthContext } from './authContextDef'
import type { GoogleUser, AuthContextValue } from './authContextDef'
import {
  clearToken,
  exchangeGoogleSession,
  fetchCurrentUser,
  getToken as getSessionToken,
  refreshToken,
} from '../lib/apiClient'
import {
  getQaGoogleModeEventName,
  getQaGoogleMockToken,
  getQaGoogleMockUser,
  isQaGoogleModeEnabled,
  setQaGoogleModeEnabled,
} from '../lib/qaGoogleMode'

export type { GoogleUser, AuthContextValue }

const USER_KEY = 'google_user'
const TOKEN_KEY = 'google_access_token'
const TOKEN_EXPIRY_KEY = 'google_token_expiry'
const GOOGLE_CLIENT_ID_KEY = 'google_client_id'

function clearGoogleAuthStorage() {
  try {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  } catch {
    // ignore storage errors
  }
}

function clearAuthStorage() {
  clearGoogleAuthStorage()
  clearToken()
}

function persistGoogleUser(user: GoogleUser | null) {
  try {
    if (!user) {
      localStorage.removeItem(USER_KEY)
      return
    }

    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // ignore storage errors
  }
}

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

function toGoogleUser(input: {
  sub: string
  email: string
  name: string | null
  picture?: string
}): GoogleUser {
  return {
    sub: input.sub,
    email: input.email,
    name: input.name ?? input.email,
    picture: input.picture,
  }
}

function mergeStoredPicture(nextUser: GoogleUser, previousUser: GoogleUser | null): GoogleUser {
  return {
    ...nextUser,
    picture: nextUser.picture ?? previousUser?.picture,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [qaEnabled, setQaEnabled] = useState(() => isQaGoogleModeEnabled())
  const [user, setUser] = useState<GoogleUser | null>(() => loadStoredUser())
  const [loading, setLoading] = useState(false)
  const [providerToken, setProviderToken] = useState<string | null>(() => loadStoredToken())
  const [clientId, setClientId] = useState<string | undefined>(() => {
    return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || undefined
  })

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || undefined
      if (stored !== clientId && !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        setClientId(stored)
      }
    }
    window.addEventListener('storage', handleStorage)
    const interval = setInterval(handleStorage, 1000)
    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [clientId])

  useEffect(() => {
    const syncQaMode = () => {
      setQaEnabled(isQaGoogleModeEnabled())
    }

    const eventName = getQaGoogleModeEventName()
    window.addEventListener('storage', syncQaMode)
    window.addEventListener(eventName, syncQaMode)
    return () => {
      window.removeEventListener('storage', syncQaMode)
      window.removeEventListener(eventName, syncQaMode)
    }
  }, [])

  const storeProviderToken = useCallback((token: string, expiresIn: number) => {
    const expiry = new Date(Date.now() + expiresIn * 1000).toISOString()
    try {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiry)
    } catch {
      // ignore storage errors
    }
    setProviderToken(token)
  }, [])

  if (qaEnabled) {
    const signInWithGoogle = () => {
      setQaGoogleModeEnabled(true)
      setUser(getQaGoogleMockUser())
      setProviderToken(getQaGoogleMockToken())
    }

    const signOut = () => {
      setQaGoogleModeEnabled(false)
      setUser(null)
      setProviderToken(null)
      clearAuthStorage()
    }

    return (
      <AuthContext.Provider value={{
        user: getQaGoogleMockUser(),
        loading: false,
        isOAuthAvailable: true,
        providerToken: getQaGoogleMockToken(),
        isQaGoogleMode: true,
        signInWithGoogle,
        signOut,
      }}>
        {children}
      </AuthContext.Provider>
    )
  }

  if (!clientId) {
    const signInWithGoogle = () => { }

    const signOut = () => {
      setUser(null)
      setProviderToken(null)
      clearAuthStorage()
    }

    return (
      <AuthContext.Provider value={{
        user,
        loading: false,
        isOAuthAvailable: false,
        providerToken,
        isQaGoogleMode: false,
        signInWithGoogle,
        signOut,
      }}>
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
      storeProviderToken={storeProviderToken}
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
  storeProviderToken: (token: string, expiresIn: number) => void
  setProviderToken: (value: string | null) => void
  children: ReactNode
}

function OAuthEnabledAuthProvider({
  user,
  loading,
  providerToken,
  setLoading,
  setUser,
  storeProviderToken,
  setProviderToken,
  children,
}: OAuthEnabledAuthProviderProps) {
  const updateUser = useCallback((nextUser: GoogleUser | null) => {
    setUser(nextUser)
    persistGoogleUser(nextUser)
  }, [setUser])

  const clearSession = useCallback(() => {
    updateUser(null)
    setProviderToken(null)
    clearAuthStorage()
  }, [setProviderToken, updateUser])

  const syncServerSession = useCallback(async (
    accessToken: string,
    expiresIn?: number,
  ): Promise<GoogleUser> => {
    const response = await exchangeGoogleSession({ accessToken, expiresIn })
    const nextUser = mergeStoredPicture(toGoogleUser(response.user), loadStoredUser())
    updateUser(nextUser)

    if (response.providerToken && expiresIn) {
      storeProviderToken(response.providerToken, expiresIn)
    }

    return nextUser
  }, [storeProviderToken, updateUser])

  const silentGoogleLogin = useGoogleLogin({
    scope: SCOPES,
    prompt: 'none',
    onSuccess: async (tokenResponse) => {
      try {
        storeProviderToken(tokenResponse.access_token, tokenResponse.expires_in)
        await syncServerSession(tokenResponse.access_token, tokenResponse.expires_in)
      } catch {
        clearSession()
      }
    },
    onError: () => {
      clearSession()
    },
  })

  const googleLogin = useGoogleLogin({
    scope: SCOPES,
    onSuccess: async (tokenResponse) => {
      try {
        storeProviderToken(tokenResponse.access_token, tokenResponse.expires_in)
        await syncServerSession(tokenResponse.access_token, tokenResponse.expires_in)
      } catch {
        clearSession()
      } finally {
        setLoading(false)
      }
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
    clearSession()
  }, [clearSession])

  useEffect(() => {
    let cancelled = false

    const hydrateFromServer = async () => {
      const sessionToken = getSessionToken()
      if (!sessionToken) return

      setLoading(true)
      try {
        const refreshedToken = await refreshToken()
        if (!refreshedToken) {
          if (!cancelled) clearSession()
          return
        }

        const currentUser = await fetchCurrentUser()
        if (!cancelled && currentUser) {
          const nextUser = mergeStoredPicture(toGoogleUser(currentUser), loadStoredUser())
          updateUser(nextUser)
        }
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void hydrateFromServer()

    return () => {
      cancelled = true
    }
  }, [clearSession, setLoading, updateUser])

  useEffect(() => {
    if (!user || !providerToken || getSessionToken()) return

    let cancelled = false

    const backfillServerSession = async () => {
      setLoading(true)
      try {
        await syncServerSession(providerToken)
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void backfillServerSession()

    return () => {
      cancelled = true
    }
  }, [clearSession, providerToken, setLoading, syncServerSession, user])

  useEffect(() => {
    if (user && !providerToken) {
      silentGoogleLogin()
    }
  }, [user, providerToken, silentGoogleLogin])

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

  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return

      if (getSessionToken()) {
        void refreshToken()
      }

      const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
      if (!expiry || new Date(expiry) <= new Date()) {
        silentGoogleLogin()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [silentGoogleLogin, user])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isOAuthAvailable: true,
      providerToken,
      isQaGoogleMode: false,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
