import { useEffect, useRef, useState } from 'react'
import { Search, UserPlus, UserRound, X } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { customerService } from '../../services'
import { formatINR } from '../../lib/money'
import { initials } from '../../lib/utils'
import { usePosStore } from '../../stores/posStore'
import { useCan } from '../../stores/sessionStore'
import { Button } from '../../components/ui/Button'
import { CustomerFormModal } from '../customers/CustomerFormModal'

/** Optional customer selection — walk-in sales need no registration. */
export function CustomerPicker() {
  const { customer, setCustomer, walkInName, walkInPhone, setField } = usePosStore()
  const can = useCan()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const debounced = useDebounced(term, 150)
  const wrap = useRef<HTMLDivElement>(null)
  const results = useQuery(() => customerService.list({ search: debounced, pageSize: 6, sortBy: 'visits', sortDir: 'desc' }), [debounced], { enabled: open, tags: ['customers'] })

  useEffect(() => {
    const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  if (customer) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{initials(customer.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink-900">{customer.name}</div>
          <div className="truncate text-xs text-ink-500">{customer.phone}</div>
          {customer.notes && <div className="mt-0.5 line-clamp-2 text-[11px] text-brand-800">{customer.notes}</div>}
        </div>
        <button onClick={() => setCustomer(null)} className="rounded-lg p-1.5 text-ink-400 hover:bg-white hover:text-ink-700" aria-label="Remove customer">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2.5" ref={wrap}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Find customer by name or phone"
          aria-label="Find customer"
          className="h-10 w-full rounded-xl border border-ink-200 bg-white pr-3 pl-9 text-[13px] placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
        />
        {open && (
          <div className="absolute z-30 mt-1.5 w-full animate-pop-in overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
            <ul className="max-h-64 overflow-y-auto p-1">
              {(results.data?.items ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setCustomer(c)
                      setTerm('')
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">{initials(c.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink-900">{c.name}</span>
                      <span className="block truncate text-[11px] text-ink-500">
                        {c.phone} · {c.visits} visits · {formatINR(c.totalSpent)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {results.data && results.data.items.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-500">No customers found</li>}
            </ul>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
        <UserRound className="h-4 w-4 text-ink-400" />
        <span className="flex-1">Walk-in customer (no registration needed)</span>
        {can('customers.manage') && (
          <Button size="xs" variant="subtle" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={walkInName} onChange={(e) => setField('walkInName', e.target.value)} placeholder="Name (optional)" aria-label="Walk-in customer name" className="h-9 rounded-lg border border-ink-200 px-3 text-[13px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none" />
        <input value={walkInPhone} onChange={(e) => setField('walkInPhone', e.target.value)} placeholder="Phone (optional)" inputMode="tel" aria-label="Walk-in customer phone" className="h-9 rounded-lg border border-ink-200 px-3 text-[13px] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none" />
      </div>
      <CustomerFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => {
          setCustomer(c)
          setCreating(false)
        }}
      />
    </div>
  )
}
