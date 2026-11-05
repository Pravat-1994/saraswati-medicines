import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface TabItem<K extends string> {
  key: K
  label: ReactNode
  count?: number
  icon?: ReactNode
}

/** Accessible tab list (arrow-key navigation). Pair with conditional rendering of panels. */
export function Tabs<K extends string>({ items, value, onChange, className, variant = 'underline' }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; className?: string; variant?: 'underline' | 'pill' }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    refs.current[next]?.focus()
    onChange(items[next].key)
  }
  return (
    <div
      role="tablist"
      className={cn(
        'scrollbar-thin flex gap-1 overflow-x-auto',
        variant === 'underline' ? 'border-b border-ink-200/80' : 'w-fit rounded-xl bg-ink-100/80 p-1',
        className,
      )}
    >
      {items.map((t, i) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 text-[13px] font-medium whitespace-nowrap transition-colors',
              variant === 'underline'
                ? cn('-mb-px border-b-2 px-3 py-2.5', active ? 'border-brand-600 text-brand-800' : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800')
                : cn('rounded-lg px-3 py-1.5', active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'),
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-[11px] font-semibold', active ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
