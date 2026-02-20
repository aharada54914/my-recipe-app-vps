/**
 * Global UI state managed by Zustand.
 * Only non-DB state lives here (toasts, loading overlays, etc.)
 * DB-reactive state remains in useLiveQuery hooks.
 */

import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  durationMs?: number
}

interface UIStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

export const useUIStore = create<UIStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    const duration = toast.durationMs ?? 3000
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)
    return id
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
