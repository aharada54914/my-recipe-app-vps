import { useState, useEffect } from 'react'

/**
 * Debounce a value by the specified delay (ms).
 * Returns the debounced value that only updates after the user stops changing it.
 */
export function useDebounce<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])

    return debounced
}
