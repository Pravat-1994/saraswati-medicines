import { useEffect, useRef, useState } from 'react'
import { Pill, Search, X } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { medicineService } from '../../services'
import { StockBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Feedback'
import type { MedicineListItem } from '../../types/views'

export interface PickedMedicine {
  id: string
  name: string
  code: string
}

/** Typeahead over medicineService.list — used by adjustment, stock-in and PO forms. */
export function MedicinePicker({
  value,
  onSelect,
  onClear,
  placeholder = 'Search medicine by name, generic, code or barcode…',
  invalid,
  id,
  excludeIds = [],
  clearOnSelect,
  autoFocus,
}: {
  value?: PickedMedicine | null
  onSelect: (m: MedicineListItem) => void
  onClear?: () => void
  placeholder?: string
  invalid?: boolean
  id?: string
  excludeIds?: string[]
  clearOnSelect?: boolean
  autoFocus?: boolean
}) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebounced(term, 200)
  const ref = useRef<HTMLDivElement>(null)

  const results = useQuery(() => medicineService.list({ search: debounced, pageSize: 8, filters: {} }), [debounced], {
    enabled: open && debounced.trim().length > 0,
    tags: ['medicines'],
  })
  const items = (results.data?.items ?? []).filter((m) => m.isActive && !excludeIds.includes(m.id))

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = (m: MedicineListItem) => {
    onSelect(m)
    setOpen(false)
    setTerm('')
    setActive(0)
  }

  if (value && !clearOnSelect) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/50 px-3 text-sm">
        <Pill className="h-4 w-4 shrink-0 text-brand-600" />
        <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{value.name}</span>
        <span className="hidden text-xs text-ink-500 sm:inline">{value.code}</span>
        {onClear && (
          <button type="button" onClick={onClear} className="rounded p-0.5 text-ink-400 hover:bg-white hover:text-ink-700" aria-label="Change medicine">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        id={id}
        autoFocus={autoFocus}
        value={term}
        aria-invalid={invalid || undefined}
        aria-autocomplete="list"
        aria-expanded={open}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(items.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter' && items[active]) {
            e.preventDefault()
            pick(items[active])
          } else if (e.key === 'Escape') setOpen(false)
        }}
        className="h-10 w-full rounded-lg border border-ink-200 bg-white pr-9 pl-9 text-sm text-ink-900 placeholder:text-ink-400 transition hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none aria-[invalid=true]:border-red-400"
      />
      {results.fetching && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2" />}
      {open && debounced.trim().length > 0 && (
        <div role="listbox" className="scrollbar-thin absolute z-30 mt-1.5 max-h-72 w-full animate-pop-in overflow-y-auto rounded-xl border border-ink-200 bg-white p-1.5 shadow-pop">
          {items.length === 0 && !results.fetching ? (
            <p className="px-3 py-4 text-center text-[13px] text-ink-400">No medicines match “{debounced}”.</p>
          ) : (
            items.map((m, i) => (
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                key={m.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(m)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', i === active ? 'bg-brand-50' : 'hover:bg-ink-50')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">{m.name}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {m.genericName} · {m.code} · {formatINR(m.purchasePrice)} cost
                  </span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <StockBadge status={m.stock.status} />
                  <span className="num text-[11px] text-ink-400">{m.stock.sellable} in stock</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
