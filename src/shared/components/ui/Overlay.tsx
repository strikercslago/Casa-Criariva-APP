import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '@/shared/components/ui/IconButton'
import { cn } from '@/shared/utils/cn'

type OverlayProps = {
  isOpen: boolean
  title: string
  children: ReactNode
  onClose: () => void
  side?: 'center' | 'right' | 'wide'
}

const openOverlays: HTMLElement[] = []
let originalOverflow = ''

export function Overlay({ isOpen, title, children, onClose, side = 'center' }: OverlayProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const panel = panelRef.current
    if (!isOpen || !panel) return
    const previousFocus = document.activeElement as HTMLElement | null
    if (openOverlays.length === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openOverlays.push(panel)
    panel.focus()
    function handleKey(event: KeyboardEvent) {
      if (openOverlays[openOverlays.length - 1] !== panel) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key === 'Tab') {
        const elements = Array.from(panel!.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter((element) => element.getClientRects().length > 0)
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (!first) { event.preventDefault(); panel!.focus(); return }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
          event.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      openOverlays.splice(openOverlays.indexOf(panel), 1)
      if (openOverlays.length === 0) document.body.style.overflow = originalOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/35 p-3" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className={cn(
          'overlay-panel fixed bg-surface shadow-elevated outline-none',
          side === 'right' &&
            'bottom-0 right-0 top-0 w-full max-w-md overflow-y-auto border-l border-border',
          side === 'wide' &&
            'bottom-0 left-0 right-0 top-0 overflow-y-auto sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md sm:border sm:border-border',
          side === 'center' &&
            'left-1/2 top-1/2 w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-md border border-border',
        )}
        role="dialog"
        ref={panelRef}
        tabIndex={-1}
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <IconButton label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </header>
        <div className="p-4">{children}</div>
      </section>
    </div>
  )
}
