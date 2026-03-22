import { createContext } from 'react'

export interface GoogleUser {
  sub: string
  email: string
  name: string
  picture?: string
}

export interface GoogleConnectionState {
  hasGoogleAccessToken: boolean
  hasRefreshToken: boolean
  accessTokenExpiresAt?: string
  canRefresh: boolean
  familyCalendarConfigured: boolean
}

export interface AuthContextValue {
  user: GoogleUser | null
  loading: boolean
  isOAuthAvailable: boolean
  providerToken: string | null
  googleConnection: GoogleConnectionState | null
  isQaGoogleMode: boolean
  signInWithGoogle: () => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
