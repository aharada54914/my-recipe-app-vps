import { useUIStore } from '../stores/uiStore'
import { X } from 'lucide-react'

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2 px-4" style={{ maxWidth: '360px', width: '100%' }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm ${
            toast.type === 'success'
              ? 'bg-green-500/90 text-white'
              : toast.type === 'error'
                ? 'bg-red-500/90 text-white'
                : 'bg-bg-card/95 text-text-primary'
          }`}
        >
          <span className="flex-1 text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
