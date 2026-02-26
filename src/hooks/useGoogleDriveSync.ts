import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  createElement,
  type ReactNode,
} from 'react'
import { useAuth } from './useAuth'
import { backupToGoogleDrive, restoreFromGoogleDrive, type PreferencesRestoreStrategy } from '../lib/googleDrive'
import { useUIStore } from '../stores/uiStore'

const BACKUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const LAST_BACKUP_KEY = 'last_backup_at'

export interface DriveBackupContextValue {
  isBackingUp: boolean
  isRestoring: boolean
  lastBackupAt: Date | null
  backupNow: () => Promise<void>
  restoreNow: (strategy?: PreferencesRestoreStrategy) => Promise<void>
  error: string | null
}

const DriveBackupContext = createContext<DriveBackupContextValue | null>(null)

export function useGoogleDriveSync(): DriveBackupContextValue {
  const ctx = useContext(DriveBackupContext)
  if (!ctx) throw new Error('useGoogleDriveSync must be used within DriveBackupProvider')
  return ctx
}

export function DriveBackupProvider({ children }: { children: ReactNode }) {
  const { providerToken, user } = useAuth()
  const addToast = useUIStore((s) => s.addToast)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(() => {
    try {
      const stored = localStorage.getItem(LAST_BACKUP_KEY)
      return stored ? new Date(stored) : null
    } catch {
      return null
    }
  })
  const [error, setError] = useState<string | null>(null)
  const lockRef = useRef(false)
  const hasRestoredRef = useRef(false)

  const backupNow = useCallback(async () => {
    if (!providerToken || lockRef.current) return
    lockRef.current = true
    setIsBackingUp(true)
    setError(null)
    try {
      await backupToGoogleDrive(providerToken)
      const now = new Date()
      setLastBackupAt(now)
      localStorage.setItem(LAST_BACKUP_KEY, now.toISOString())
      addToast({ message: 'Google Driveにバックアップしました', type: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'バックアップに失敗しました'
      setError(msg)
      addToast({ message: `バックアップ失敗: ${msg}`, type: 'error' })
    } finally {
      setIsBackingUp(false)
      lockRef.current = false
    }
  }, [providerToken, addToast])

  const restoreNow = useCallback(async (strategy: PreferencesRestoreStrategy = 'prefer-newer') => {
    if (!providerToken || lockRef.current) return
    lockRef.current = true
    setIsRestoring(true)
    setError(null)
    try {
      const restored = await restoreFromGoogleDrive(providerToken, { preferencesStrategy: strategy })
      if (restored) {
        addToast({ message: 'Google Driveからデータを復元しました', type: 'success', durationMs: 4000 })
      } else {
        addToast({ message: '復元できるバックアップが見つかりませんでした', type: 'error' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '復元に失敗しました'
      setError(msg)
      addToast({ message: `復元失敗: ${msg}`, type: 'error' })
    } finally {
      setIsRestoring(false)
      lockRef.current = false
    }
  }, [providerToken, addToast])

  // Restore on first login
  useEffect(() => {
    if (!providerToken || !user || hasRestoredRef.current) return
    hasRestoredRef.current = true
    setIsRestoring(true)
    setError(null)
    restoreFromGoogleDrive(providerToken, { preferencesStrategy: 'prefer-newer' })
      .then((restored) => {
        setIsRestoring(false)
        if (restored) {
          addToast({ message: 'Google Driveからデータを復元しました', type: 'success', durationMs: 4000 })
        }
      })
      .catch((err) => {
        setIsRestoring(false)
        const msg = err instanceof Error ? err.message : '復元に失敗しました'
        setError(msg)
      addToast({ message: `復元失敗: ${msg}`, type: 'error' })
      })
  }, [providerToken, user, addToast])

  // Periodic backup
  useEffect(() => {
    if (!providerToken) return
    const timer = setInterval(backupNow, BACKUP_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [providerToken, backupNow])

  // Backup when coming back online
  useEffect(() => {
    if (!providerToken) return
    const handleOnline = () => { backupNow() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [providerToken, backupNow])

  // Backup before page unload
  useEffect(() => {
    if (!providerToken) return
    const handleUnload = () => {
      if (providerToken) {
        backupToGoogleDrive(providerToken).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [providerToken])

  return createElement(
    DriveBackupContext.Provider,
    { value: { isBackingUp, isRestoring, lastBackupAt, backupNow, restoreNow, error } },
    children,
  )
}
