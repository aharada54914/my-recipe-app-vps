import { useEffect, useRef } from 'react'

/**
 * Keep the screen on while the component is mounted.
 * Uses NoSleep.js for iOS compatibility.
 */
export function useWakeLock() {
  const noSleepRef = useRef<import('nosleep.js').default | null>(null)
  const wakeLockRef = useRef<{
    release: () => Promise<void> | void
    addEventListener?: (type: 'release', listener: () => void) => void
  } | null>(null)
  const noSleepEnabledRef = useRef(false)

  useEffect(() => {
    let disposed = false

    const releaseWakeLock = async () => {
      if (!wakeLockRef.current) return
      try {
        await wakeLockRef.current.release()
      } catch {
        // ignore release errors
      } finally {
        wakeLockRef.current = null
      }
    }

    const enableNoSleep = async () => {
      if (disposed || noSleepEnabledRef.current) return
      try {
        const NoSleep = (await import('nosleep.js')).default
        const noSleep = new NoSleep()
        noSleep.enable()
        noSleepRef.current = noSleep
        noSleepEnabledRef.current = true
      } catch {
        // NoSleep may fail without user gesture
      }
    }

    const requestWakeLock = async () => {
      if (disposed || document.visibilityState !== 'visible') return

      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> | void; addEventListener?: (type: 'release', listener: () => void) => void }> }
        }
        if (!nav.wakeLock) {
          await enableNoSleep()
          return
        }

        await releaseWakeLock()
        const wl = await nav.wakeLock.request('screen')
        wakeLockRef.current = wl
        wl.addEventListener?.('release', () => {
          // Re-acquire when system releases the lock (screen off, tab hidden, etc.)
          void requestWakeLock()
        })
      } catch {
        // Native API unavailable or blocked -> try iOS fallback
        await enableNoSleep()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
      }
    }

    const handleUserGesture = () => {
      void requestWakeLock()
      void enableNoSleep()
    }

    void requestWakeLock()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    window.addEventListener('pointerdown', handleUserGesture, { passive: true })
    window.addEventListener('touchstart', handleUserGesture, { passive: true })

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      window.removeEventListener('pointerdown', handleUserGesture)
      window.removeEventListener('touchstart', handleUserGesture)
      void releaseWakeLock()
      if (noSleepRef.current) {
        noSleepRef.current.disable()
        noSleepRef.current = null
      }
      noSleepEnabledRef.current = false
    }
  }, [])
}
