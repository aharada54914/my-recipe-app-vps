import type { ComponentPropsWithoutRef, ReactNode } from 'react'

interface StatusNoticeProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  tone: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
  className?: string
}

const TONE_STYLES: Record<StatusNoticeProps['tone'], string> = {
  info: 'status-notice--info',
  success: 'status-notice--success',
  warning: 'status-notice--warning',
  error: 'status-notice--error',
}

export function StatusNotice({
  tone,
  title,
  message,
  actionLabel,
  onAction,
  icon,
  className = '',
  ...rest
}: StatusNoticeProps) {
  return (
    <div className={`status-notice ${TONE_STYLES[tone]} ${className}`.trim()} {...rest}>
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">{message}</p>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-bg-card px-3 py-2 text-sm font-semibold text-text-primary shadow-sm ring-1 ring-border-soft transition-colors hover:bg-bg-card-hover"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
