import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createElement } from 'react'
import { useAuth } from './useAuth'
import { syncAll, type SyncResult } from '../utils/syncManager'
import { supabase } from '../lib/supabase'

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const LAST_SYNCED_KEY = 'last_synced_at'

export interface SyncContextValue {
  isSyncing: boolean
  lastSyncedAt: Date | null
  lastResult: SyncResult | null
  syncNow: () => Promise<void>
  error: string | null
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext)
  if (!context) throw new Error('useSync must be used within SyncProvider')
  return context
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem(LAST_SYNCED_KEY)
    return stored ? new Date(stored) : null
  })
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const syncLockRef = useRef(false)

  const syncNow = useCallback(async () => {
    if (!user || !supabase || syncLockRef.current) return

    syncLockRef.current = true
    setIsSyncing(true)
    setError(null)

    try {
      const result = await syncAll(user.id)
      setLastResult(result)

      if (result.errors.length > 0) {
        setError(result.errors[0])
      }

      const now = new Date()
      setLastSyncedAt(now)
      localStorage.setItem(LAST_SYNCED_KEY, now.toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : '同期に失敗しました')
    } finally {
      setIsSyncing(false)
      syncLockRef.current = false
    }
  }, [user])

  // Sync on login
  useEffect(() => {
    if (user) {
      syncNow()
    }
  }, [user, syncNow])

  // Periodic sync (every 5 minutes)
  useEffect(() => {
    if (!user) return

    const timer = setInterval(syncNow, SYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [user, syncNow])

  // Sync when coming back online
  useEffect(() => {
    if (!user) return

    const handleOnline = () => { syncNow() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [user, syncNow])

  return createElement(
    SyncContext.Provider,
    { value: { isSyncing, lastSyncedAt, lastResult, syncNow, error } },
    children,
  )
}
