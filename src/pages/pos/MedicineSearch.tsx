import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Ban, ScanBarcode, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { medicineService } from '../../services'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { usePosStore } from '../../stores/posStore'
import { Badge, ExpiryBadge, StockBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Feedback'
import type { SaleableMedicine } from '../../types/views'

export interface MedicineSearchHandle {
  focus: () => void
}

function sellableQty(item: SaleableMedicine) {
  return item.batches.filter((b) => b.expiryStatus !== 'EXPIRED').reduce((a, b) => a + b.quantity, 0)
}

/** Counter search: type or scan; Enter adds the best match using FEFO. */
export const MedicineSearch = forwardRef<MedicineSearchHandle>(function MedicineSearch(_props, ref) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounced = useDebounced(term, 120)
  const addMedicine = usePosStore((s) => s.addMedicine)
  const lines = usePosStore((s) => s.lines)
  const results = useQuery(() => medicineService.searchForSale(debounced), [debounced], { enabled: debounced.trim().length > 0, tags: ['inventory'] })

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const items = debounced.trim() ? (results.data ?? []) : []

  const add = (item: SaleableMedicine) => {
    const inCart = lines.filter((l) => l.medicine.id === item.medicine.id).reduce((a, l) => a + l.quantity, 0)
    const available = sellableQty(item) - inCart
    if (!item.medicine.isActive) return toast.error(`${item.medicine.name} is inactive and cannot be sold.`)
    if (available <= 0) {
      const expiredOnly = item.batches.length > 0 && item.batches.every((b) => b.expiryStatus === 'EXPIRED')
      return toast.error(expiredOnly ? `${item.medicine.name}: only expired stock is on hand — it cannot be sold.` : inCart > 0 ? `All available stock of ${item.medicine.name} is already in the cart.` : `${item.medicine.name} is out of stock.`)
    }
    const r = addMedicine(item, 1)
    if (r.added > 0) {
      toast.success(`${item.medicine.name} added`, { duration: 1200 })
      if (item.medicine.prescriptionRequired) toast.info('Prescription medicine — record the Rx reference before billing.', { duration: 2500 })
    }
    setTerm('')
    setOpen(false)
    setActive(0)
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          ref={inputRef}
          value={term}
          autoFocus
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(items.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (items[active]) add(items[active])
            } else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Scan barcode or search by name, generic, SKU…"
          aria-label="Search medicines to add"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls="pos-search-results"
          className="h-14 w-full rounded-2xl border border-ink-200 bg-white pr-28 pl-12 text-[15px] text-ink-900 shadow-card placeholder:text-ink-400 transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
        />
        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
          {results.fetching && <Spinner />}
          <span className="hidden items-center gap-1 rounded-lg bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-500 sm:flex">
            <ScanBarcode className="h-3.5 w-3.5" /> F2
          </span>
        </div>
      </div>

      {open && debounced.trim().length > 0 && (
        <div id="pos-search-results" role="listbox" className="absolute z-30 mt-2 w-full animate-pop-in overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-pop">
          {items.length === 0 && !results.fetching ? (
            <div className="px-4 py-8 text-center text-[13px] text-ink-500">No medicines match “{debounced}”.</div>
          ) : (
            <ul className="scrollbar-thin max-h-[420px] overflow-y-auto p-1.5">
              {items.map((item, i) => {
                const qty = sellableQty(item)
                const next = item.batches.find((b) => b.expiryStatus !== 'EXPIRED')
                const expiredQty = item.batches.filter((b) => b.expiryStatus === 'EXPIRED').reduce((a, b) => a + b.quantity, 0)
                const blocked = qty <= 0 || !item.medicine.isActive
                return (
                  <li key={item.medicine.id} role="option" aria-selected={i === active} aria-disabled={blocked}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => add(item)}
                      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', i === active ? 'bg-brand-50' : 'hover:bg-ink-50', blocked && 'opacity-70')}
                    >
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold', blocked ? 'bg-ink-100 text-ink-400' : 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-100')}>
                        {blocked ? <Ban className="h-4 w-4" /> : item.medicine.dosageForm.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-ink-900">{item.medicine.name}</span>
                          {item.medicine.prescriptionRequired && <Badge tone="violet" className="px-1.5 py-0 text-[10px]">Rx</Badge>}
                          {!item.medicine.isActive && <Badge className="px-1.5 py-0 text-[10px]">Inactive</Badge>}
                        </div>
                        <div className="truncate text-xs text-ink-500">
                          {item.medicine.genericName} · {item.medicine.strength} · {item.medicine.packSize} · <span className="font-mono">{item.medicine.code}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {next ? (
                            <>
                              <span className="text-ink-500">
                                FEFO batch <span className="font-mono font-semibold text-ink-700">{next.batchNumber}</span> · exp {formatDate(next.expiryDate)}
                              </span>
                              {next.expiryStatus !== 'OK' && <ExpiryBadge status={next.expiryStatus} days={next.daysToExpiry} />}
                            </>
                          ) : (
                            <span className="font-medium text-red-600">{expiredQty > 0 ? `${expiredQty} expired unit(s) only — blocked` : 'No sellable stock'}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num font-semibold text-ink-900">{formatINR(next?.sellingPrice ?? item.medicine.sellingPrice)}</div>
                        <div className="mt-1">{qty > 0 ? <span className="num text-xs text-ink-500">{qty} available</span> : <StockBadge status="OUT_OF_STOCK" />}</div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/60 px-4 py-2 text-[11px] text-ink-500">
            <span>↑↓ to navigate · Enter to add · Esc to close</span>
            <span>Batches are allocated First-Expiry-First-Out</span>
          </div>
        </div>
      )}
    </div>
  )
})
