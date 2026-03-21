import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from '../uiStore'

// Reset store before each test
beforeEach(() => {
  useUIStore.setState({ toasts: [] })
  vi.useFakeTimers()
})

describe('uiStore — addToast', () => {
  it('adds a toast and returns its id', () => {
    const id = useUIStore.getState().addToast({ message: 'こんにちは', type: 'info' })
    expect(typeof id).toBe('string')
    expect(id).toBeTruthy()
    expect(useUIStore.getState().toasts).toHaveLength(1)
    expect(useUIStore.getState().toasts[0].message).toBe('こんにちは')
  })

  it('adds a toast with the given type', () => {
    useUIStore.getState().addToast({ message: '成功', type: 'success' })
    expect(useUIStore.getState().toasts[0].type).toBe('success')
  })

  it('assigns a unique id to each toast', () => {
    const id1 = useUIStore.getState().addToast({ message: 'A', type: 'info' })
    const id2 = useUIStore.getState().addToast({ message: 'B', type: 'info' })
    expect(id1).not.toBe(id2)
  })

  it('auto-dismisses after default 3 seconds', () => {
    useUIStore.getState().addToast({ message: '自動削除', type: 'info' })
    expect(useUIStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(3000)
    expect(useUIStore.getState().toasts).toHaveLength(0)
  })

  it('respects custom durationMs', () => {
    useUIStore.getState().addToast({ message: 'カスタム', type: 'success', durationMs: 1000 })
    vi.advanceTimersByTime(999)
    expect(useUIStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useUIStore.getState().toasts).toHaveLength(0)
  })

  it('can hold multiple toasts simultaneously', () => {
    useUIStore.getState().addToast({ message: 'A', type: 'info' })
    useUIStore.getState().addToast({ message: 'B', type: 'error' })
    expect(useUIStore.getState().toasts).toHaveLength(2)
  })
})

describe('uiStore — removeToast', () => {
  it('removes only the toast with the given id', () => {
    const id = useUIStore.getState().addToast({ message: 'X', type: 'info' })
    useUIStore.getState().addToast({ message: 'Y', type: 'info' })
    useUIStore.getState().removeToast(id)
    const remaining = useUIStore.getState().toasts
    expect(remaining).toHaveLength(1)
    expect(remaining[0].message).toBe('Y')
  })

  it('is a no-op for unknown id', () => {
    useUIStore.getState().addToast({ message: 'Z', type: 'info' })
    useUIStore.getState().removeToast('nonexistent_id')
    expect(useUIStore.getState().toasts).toHaveLength(1)
  })
})
