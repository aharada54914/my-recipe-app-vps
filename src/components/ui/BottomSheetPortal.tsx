import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface BottomSheetPortalProps {
  children: ReactNode
  onClose: () => void
  panelClassName?: string
  panelStyle?: CSSProperties
  frameClassName?: string
  testId?: string
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function BottomSheetPortal({
  children,
  onClose,
  panelClassName,
  panelStyle,
  frameClassName,
  testId,
}: BottomSheetPortalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'contain'

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior = previousOverscroll
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div className="ui-bottom-sheet-scrim" onClick={onClose} />
      <div className={joinClassNames('ui-bottom-sheet-frame', frameClassName)} onClick={onClose}>
        <div
          data-testid={testId}
          className={joinClassNames('ui-bottom-sheet', panelClassName)}
          style={panelStyle}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}
