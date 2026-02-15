import { useEffect, useRef } from 'react'

/**
 * Keep the screen on while the component is mounted.
 * Uses NoSleep.js for iOS compatibility.
 */
export function useWakeLock() {
    const noSleepRef = useRef<import('nosleep.js').default | null>(null)

    useEffect(() => {
        let noSleep: import('nosleep.js').default | null = null

        const enable = async () => {
            try {
                // Try native Wake Lock API first (non-iOS)
                if ('wakeLock' in navigator) {
                    const wakeLock = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<unknown> } }).wakeLock.request('screen')
                    noSleepRef.current = null
                    return () => {
                        (wakeLock as { release: () => void }).release()
                    }
                }

                // Fallback to NoSleep.js (iOS)
                const NoSleep = (await import('nosleep.js')).default
                noSleep = new NoSleep()
                noSleep.enable()
                noSleepRef.current = noSleep
            } catch {
                // Wake Lock not available
            }
        }

        enable()

        return () => {
            if (noSleepRef.current) {
                noSleepRef.current.disable()
                noSleepRef.current = null
            }
        }
    }, [])
}
