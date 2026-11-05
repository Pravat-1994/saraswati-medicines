import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface MenuItem {
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
}

/** Lightweight dropdown menu. */
export function Menu({ trigger, items, align = 'right', header, className }: { trigger: (props: { open: boolean; toggle: () => void }) => ReactNode; items: (MenuItem | 'divider')[]; align?: 'left' | 'right'; header?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const visible = items.filter((i) => i === 'divider' || !i.hidden)
  return (
    <div className={cn('relative', className)} ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-40 mt-2 min-w-56 animate-pop-in rounded-xl border border-ink-200/80 bg-white p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {header && <div className="border-b border-ink-100 px-2.5 pt-1.5 pb-2.5 mb-1">{header}</div>}
          {visible.map((item, i) =>
            item === 'divider' ? (
              <div key={`d${i}`} className="my-1 h-px bg-ink-100" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition disabled:opacity-40',
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-ink-700 hover:bg-ink-50 hover:text-ink-950',
                )}
              >
                {item.icon && <span className="text-ink-400">{item.icon}</span>}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
