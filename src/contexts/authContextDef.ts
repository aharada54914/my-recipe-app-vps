import { createContext } from 'react'

export interface GoogleUser {
  sub: string
  email: string
  name: string
  picture?: string
}

export interface AuthContextValue {
  user: GoogleUser | null
  loading: boolean
  providerToken: string | null
  signInWithGoogle: () => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
