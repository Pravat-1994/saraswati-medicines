import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Select, type SelectOption } from './Form'

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-ink-200 bg-white pr-8 pl-9 text-[13px] text-ink-900 placeholder:text-ink-400 transition hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:text-ink-700" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({ label, value, onChange, options, allLabel = 'All', className }: { label: string; value: string; onChange: (v: string) => void; options: SelectOption[]; allLabel?: string; className?: string }) {
  return (
    <Select
      aria-label={label}
      selectSize="sm"
      className={cn('w-full sm:w-auto sm:min-w-40', className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[{ value: '', label: `${label}: ${allLabel}` }, ...options]}
    />
  )
}

/** Toolbar row above a table: search + filters on the left, actions on the right. */
export function FilterBar({ children, actions, onReset, active, className }: { children: ReactNode; actions?: ReactNode; onReset?: () => void; active?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 border-b border-ink-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between', className)}>
      <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">
        {children}
        {onReset && active && (
          <button onClick={onReset} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800">
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
