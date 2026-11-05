import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Render as a right-side drawer instead of a centred dialog. */
  drawer?: boolean
  /** Prevent closing on backdrop click (e.g. while a form is dirty or submitting). */
  dismissible?: boolean
  icon?: ReactNode
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' }

/** Accessible dialog: portal, Esc to close, focus moved in and restored, scroll lock. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', drawer, dismissible = true, icon }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input:not([disabled]), select, textarea, button:not([data-close])')
      ;(el ?? panelRef.current)?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onCloseRef.current()
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, dismissible])

  if (!open) return null

  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex', drawer ? 'justify-end' : 'items-end justify-center p-0 sm:items-center sm:p-4')}>
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={() => dismissible && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col bg-white shadow-pop outline-none',
          drawer
            ? cn('h-full animate-slide-in', widths[size])
            : cn('max-h-[92vh] animate-pop-in rounded-t-2xl sm:max-h-[88vh] sm:rounded-2xl', widths[size]),
        )}
      >
        <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
          {icon && <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-ink-950">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
          </div>
          <button data-close onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3.5 sm:rounded-b-2xl sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  children?: ReactNode
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', loading, children }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!loading}
      icon={tone === 'danger' ? <AlertTriangle className="h-4 w-4 text-red-600" /> : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-600">{message}</div>
      {children && <div className="mt-4">{children}</div>}
    </Modal>
  )
}
