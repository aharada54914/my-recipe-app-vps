import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { AuthContext } from './authContextDef'
import type { GoogleConnectionState, GoogleUser, AuthContextValue } from './authContextDef'
import {
  clearToken,
  exchangeGoogleCode,
  exchangeGoogleSession,
  fetchCurrentUserSession,
  fetchProviderToken,
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

function clearProviderTokenStorage() {
  try {
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
  const [googleConnection, setGoogleConnection] = useState<GoogleConnectionState | null>(null)
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
        googleConnection: {
          hasGoogleAccessToken: true,
          hasRefreshToken: false,
          canRefresh: true,
          familyCalendarConfigured: true,
        },
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
        googleConnection,
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
      googleConnection={googleConnection}
      setLoading={setLoading}
      setUser={setUser}
      storeProviderToken={storeProviderToken}
      setProviderToken={setProviderToken}
      setGoogleConnection={setGoogleConnection}
    >
      {children}
    </OAuthEnabledAuthProvider>
  )
}

interface OAuthEnabledAuthProviderProps {
  user: GoogleUser | null
  loading: boolean
  providerToken: string | null
  googleConnection: GoogleConnectionState | null
  setLoading: (value: boolean) => void
  setUser: (value: GoogleUser | null) => void
  storeProviderToken: (token: string, expiresIn: number) => void
  setProviderToken: (value: string | null) => void
  setGoogleConnection: (value: GoogleConnectionState | null) => void
  children: ReactNode
}

function OAuthEnabledAuthProvider({
  user,
  loading,
  providerToken,
  googleConnection,
  setLoading,
  setUser,
  storeProviderToken,
  setProviderToken,
  setGoogleConnection,
  children,
}: OAuthEnabledAuthProviderProps) {
  const updateUser = useCallback((nextUser: GoogleUser | null) => {
    setUser(nextUser)
    persistGoogleUser(nextUser)
  }, [setUser])

  const clearSession = useCallback(() => {
    updateUser(null)
    setProviderToken(null)
    setGoogleConnection(null)
    clearAuthStorage()
  }, [setGoogleConnection, setProviderToken, updateUser])

  const clearProviderToken = useCallback(() => {
    clearProviderTokenStorage()
    setProviderToken(null)
  }, [setProviderToken])

  const syncServerSessionFromAccessToken = useCallback(async (
    accessToken: string,
    expiresIn?: number,
  ): Promise<GoogleUser> => {
    const response = await exchangeGoogleSession({ accessToken, expiresIn })
    const nextUser = mergeStoredPicture(toGoogleUser(response.user), loadStoredUser())
    updateUser(nextUser)
    setGoogleConnection(response.googleConnection ?? null)

    if (response.providerToken && expiresIn) {
      storeProviderToken(response.providerToken, expiresIn)
    }

    return nextUser
  }, [setGoogleConnection, storeProviderToken, updateUser])

  const syncServerSessionFromCode = useCallback(async (code: string): Promise<GoogleUser> => {
    const response = await exchangeGoogleCode(code)
    const nextUser = mergeStoredPicture(toGoogleUser(response.user), loadStoredUser())
    updateUser(nextUser)
    setGoogleConnection(response.googleConnection ?? null)

    if (response.providerToken && response.providerTokenExpiry) {
      const seconds = Math.max(1, Math.floor((new Date(response.providerTokenExpiry).getTime() - Date.now()) / 1000))
      storeProviderToken(response.providerToken, seconds)
    }

    return nextUser
  }, [setGoogleConnection, storeProviderToken, updateUser])

  const hydrateProviderTokenFromServer = useCallback(async () => {
    const response = await fetchProviderToken()
    setGoogleConnection(response.googleConnection ?? null)
    if (response.providerToken && response.providerTokenExpiry) {
      const seconds = Math.max(1, Math.floor((new Date(response.providerTokenExpiry).getTime() - Date.now()) / 1000))
      storeProviderToken(response.providerToken, seconds)
    }
  }, [setGoogleConnection, storeProviderToken])

  const silentGoogleLogin = useGoogleLogin({
    scope: SCOPES,
    prompt: 'none',
    onSuccess: async (tokenResponse) => {
      try {
        storeProviderToken(tokenResponse.access_token, tokenResponse.expires_in)
        await syncServerSessionFromAccessToken(tokenResponse.access_token, tokenResponse.expires_in)
      } catch {
        clearProviderToken()
      }
    },
    onError: () => {
      clearProviderToken()
    },
  })

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    select_account: true,
    scope: SCOPES,
    onSuccess: async (codeResponse) => {
      try {
        await syncServerSessionFromCode(codeResponse.code)
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

        const currentSession = await fetchCurrentUserSession()
        if (!cancelled && currentSession) {
          setGoogleConnection(currentSession.googleConnection)
          const nextUser = mergeStoredPicture(toGoogleUser(currentSession.user), loadStoredUser())
          updateUser(nextUser)

          const expiry = getPersistedAuthItem(TOKEN_EXPIRY_KEY)
          const needsProviderToken = !expiry || new Date(expiry).getTime() - Date.now() <= 5 * 60 * 1000
          if (needsProviderToken && currentSession.googleConnection?.hasGoogleAccessToken) {
            try {
              await hydrateProviderTokenFromServer()
            } catch {
              if (!currentSession.googleConnection.hasRefreshToken) {
                silentGoogleLogin()
              }
            }
          }
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
  }, [clearSession, hydrateProviderTokenFromServer, setGoogleConnection, setLoading, silentGoogleLogin, updateUser])

  useEffect(() => {
    if (!user || !providerToken || getSessionToken()) return

    let cancelled = false

    const backfillServerSession = async () => {
      setLoading(true)
      try {
        await syncServerSessionFromAccessToken(providerToken)
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
  }, [clearSession, providerToken, setLoading, syncServerSessionFromAccessToken, user])

  useEffect(() => {
    if (user && !providerToken && !googleConnection?.hasRefreshToken) {
      silentGoogleLogin()
    }
  }, [googleConnection?.hasRefreshToken, providerToken, silentGoogleLogin, user])

  useEffect(() => {
    if (!providerToken) return
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (!expiry) return
    const msUntilRefresh = new Date(expiry).getTime() - Date.now() - 5 * 60 * 1000
    if (msUntilRefresh <= 0) {
      if (googleConnection?.hasRefreshToken) {
        void hydrateProviderTokenFromServer().catch(() => {
          silentGoogleLogin()
        })
      } else {
        silentGoogleLogin()
      }
      return
    }
    const timer = setTimeout(() => {
      if (googleConnection?.hasRefreshToken) {
        void hydrateProviderTokenFromServer().catch(() => {
          silentGoogleLogin()
        })
      } else {
        silentGoogleLogin()
      }
    }, msUntilRefresh)
    return () => clearTimeout(timer)
  }, [googleConnection?.hasRefreshToken, hydrateProviderTokenFromServer, providerToken, silentGoogleLogin])

  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return

      if (getSessionToken()) {
        void refreshToken()
      }

      const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
      if (!expiry || new Date(expiry) <= new Date()) {
        if (googleConnection?.hasRefreshToken) {
          void hydrateProviderTokenFromServer().catch(() => {
            if (!googleConnection.hasRefreshToken) {
              silentGoogleLogin()
            }
          })
        } else {
          silentGoogleLogin()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [googleConnection, hydrateProviderTokenFromServer, silentGoogleLogin, user])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isOAuthAvailable: true,
      providerToken,
      googleConnection,
      isQaGoogleMode: false,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
