import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './authContextDef'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  providerToken: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  const [providerToken, setProviderToken] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return

    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setProviderToken(session?.provider_token ?? null)
      setLoading(false)
    })

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        // provider_token is only available on initial sign-in callback
        if (session?.provider_token) {
          setProviderToken(session.provider_token)
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/',
        scopes: CALENDAR_SCOPES,
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setProviderToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, providerToken, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
