import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { AuthContext } from './authContextDef'
import type { GoogleUser, AuthContextValue } from './authContextDef'

export type { GoogleUser, AuthContextValue }

const USER_KEY = 'google_user'
const TOKEN_KEY = 'google_access_token'
const TOKEN_EXPIRY_KEY = 'google_token_expiry'
const GOOGLE_CLIENT_ID_KEY = 'google_client_id'

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

function loadStoredToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY)
    if (token && expiry && new Date(expiry) > new Date()) return token
    return null
  } catch {
    return null
  }
}

function loadStoredUser(): GoogleUser | null {
  try {
    // H3: Use sessionStorage for user info (clears on tab close, more secure)
    const stored = sessionStorage.getItem(USER_KEY)
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
      sessionStorage.setItem(TOKEN_KEY, token)
      sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiry)
    } catch { /* ignore storage errors */ }
    setProviderToken(token)
  }, [])

  if (!clientId) {
    const signInWithGoogle = () => { }

    const signOut = () => {
      setUser(null)
      setProviderToken(null)
      try {
        sessionStorage.removeItem(USER_KEY)
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
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
  const googleLogin = useGoogleLogin({
    scope: SCOPES,
    // Note: Since useGoogleLogin does not take clientId directly here in all react-oauth/google versions (it takes it from GoogleOAuthProvider wrapper usually),
    // we make sure to wrap the app with GoogleOAuthProvider properly in main.tsx or App.tsx using this exported ClientId if needed, 
    // but the underlying googleLogin relies on the nearest context. 
    // This file assumes the outer tree provides it correctly. We will pass it to AuthContext if we needed to initialize it manually.

    onSuccess: async (tokenResponse) => {
      storeToken(tokenResponse.access_token, tokenResponse.expires_in)
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        if (res.ok) {
          const userInfo = (await res.json()) as GoogleUser
          setUser(userInfo)
          sessionStorage.setItem(USER_KEY, JSON.stringify(userInfo))
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
      sessionStorage.removeItem(USER_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
    } catch { /* ignore */ }
  }, [setProviderToken, setUser])

  return (
    <AuthContext.Provider value={{ user, loading, isOAuthAvailable: true, providerToken, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
