import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { CornerDownLeft, Pill, ReceiptText, Search, User } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { customerService, medicineService, salesService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import { useUiStore } from '../../stores/uiStore'
import { StockBadge } from '../ui/Badge'
import { Spinner } from '../ui/Feedback'

interface Result {
  id: string
  kind: 'medicine' | 'customer' | 'invoice'
  title: string
  subtitle: string
  to: string
  extra?: React.ReactNode
}

/** Global search (Ctrl/⌘ + K) across medicines, customers and invoices. */
export function CommandPalette() {
  const { commandOpen, setCommandOpen } = useUiStore()
  const [term, setTerm] = useState('')
  const [index, setIndex] = useState(0)
  const debounced = useDebounced(term, 180)
  const navigate = useNavigate()
  const can = useCan()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(!useUiStore.getState().commandOpen)
      }
      if (e.key === 'Escape') setCommandOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setCommandOpen])

  const results = useQuery<Result[]>(
    async () => {
      const q = debounced.trim()
      if (q.length < 2) return []
      const [meds, customers, sales] = await Promise.all([
        can('medicines.view') ? medicineService.searchForSale(q) : Promise.resolve([]),
        can('customers.view') ? customerService.list({ search: q, pageSize: 4 }).then((r) => r.items) : Promise.resolve([]),
        can('sales.view') ? salesService.list({ search: q, pageSize: 4 }).then((r) => r.items) : Promise.resolve([]),
      ])
      return [
        ...meds.slice(0, 6).map<Result>((m) => ({
          id: m.medicine.id,
          kind: 'medicine',
          title: m.medicine.name,
          subtitle: `${m.medicine.genericName} · ${m.medicine.code} · ${formatINR(m.medicine.sellingPrice)}`,
          to: `/medicines/${m.medicine.id}`,
          extra: <StockBadge status={m.stock.status} />,
        })),
        ...customers.map<Result>((c) => ({ id: c.id, kind: 'customer', title: c.name, subtitle: `${c.phone} · ${c.visits} visits`, to: `/customers/${c.id}` })),
        ...sales.map<Result>((s) => ({ id: s.id, kind: 'invoice', title: s.invoiceNumber, subtitle: `${s.customerName} · ${formatINR(s.grandTotal)}`, to: `/sales/${s.id}` })),
      ]
    },
    [debounced, commandOpen],
    { enabled: commandOpen },
  )

  if (!commandOpen) return null
  const items = results.data ?? []
  const go = (r: Result) => {
    setCommandOpen(false)
    setTerm('')
    navigate(r.to)
  }
  const Icon = { medicine: Pill, customer: User, invoice: ReceiptText }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={() => setCommandOpen(false)} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Global search" className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-ink-100 px-4">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            autoFocus
            value={term}
            onChange={(e) => {
              setTerm(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(items.length - 1, i + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(0, i - 1))
              }
              if (e.key === 'Enter' && items[index]) go(items[index])
            }}
            placeholder="Search by medicine, generic name, barcode, customer or invoice…"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            aria-label="Search"
          />
          {results.fetching && <Spinner />}
        </div>
        <div className="scrollbar-thin max-h-[50vh] overflow-y-auto p-2">
          {debounced.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-[13px] text-ink-400">Type at least 2 characters to search.</p>
          ) : items.length === 0 && !results.fetching ? (
            <p className="px-3 py-8 text-center text-[13px] text-ink-400">No matches for “{debounced}”.</p>
          ) : (
            items.map((r, i) => {
              const I = Icon[r.kind]
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(r)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', i === index ? 'bg-brand-50' : 'hover:bg-ink-50')}
                >
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', i === index ? 'bg-white text-brand-700 shadow-sm' : 'bg-ink-100 text-ink-500')}>
                    <I className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink-900">{r.title}</span>
                    <span className="block truncate text-xs text-ink-500">{r.subtitle}</span>
                  </span>
                  {r.extra}
                  {i === index && <CornerDownLeft className="h-3.5 w-3.5 text-ink-400" />}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
