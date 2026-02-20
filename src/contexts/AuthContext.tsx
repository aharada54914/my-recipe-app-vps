import { useState, useCallback, type ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { AuthContext } from './authContextDef'
import type { GoogleUser, AuthContextValue } from './authContextDef'

export type { GoogleUser, AuthContextValue }

const USER_KEY = 'google_user'
const TOKEN_KEY = 'google_access_token'
const TOKEN_EXPIRY_KEY = 'google_token_expiry'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

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
    const stored = localStorage.getItem(USER_KEY)
    return stored ? (JSON.parse(stored) as GoogleUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(() => loadStoredUser())
  const [loading, setLoading] = useState(false)
  const [providerToken, setProviderToken] = useState<string | null>(() => loadStoredToken())

  const storeToken = useCallback((token: string, expiresIn: number) => {
    const expiry = new Date(Date.now() + expiresIn * 1000).toISOString()
    try {
      sessionStorage.setItem(TOKEN_KEY, token)
      sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiry)
    } catch { /* ignore storage errors */ }
    setProviderToken(token)
  }, [])

  if (!GOOGLE_CLIENT_ID) {
    const signInWithGoogle = () => {}

    const signOut = () => {
      setUser(null)
      setProviderToken(null)
      try {
        localStorage.removeItem(USER_KEY)
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
