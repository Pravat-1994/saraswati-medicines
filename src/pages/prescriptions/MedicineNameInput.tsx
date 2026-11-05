import { useEffect, useRef, useState } from 'react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { medicineService } from '../../services'
import { cn } from '../../lib/utils'
import { Badge } from '../../components/ui/Badge'

/** Medicine name with catalogue suggestions. Free text is allowed (flagged as not stocked). */
export function MedicineNameInput({ name, medicineId, onChange, invalid, id }: { name: string; medicineId?: string; onChange: (v: { name: string; medicineId?: string }) => void; invalid?: boolean; id?: string }) {
  const [open, setOpen] = useState(false)
  const debounced = useDebounced(name, 150)
  const wrap = useRef<HTMLDivElement>(null)
  const results = useQuery(() => medicineService.list({ search: debounced, pageSize: 8 }), [debounced], { enabled: open && debounced.trim().length > 1, tags: ['medicines'] })

  useEffect(() => {
    const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div className="relative" ref={wrap}>
      <input
        id={id}
        value={name}
        onChange={(e) => {
          onChange({ name: e.target.value, medicineId: undefined })
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search catalogue or type a name"
        aria-invalid={invalid || undefined}
        className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none aria-[invalid=true]:border-red-400"
      />
      <div className="mt-1">
        {name.trim() && (medicineId ? <Badge tone="brand">In catalogue</Badge> : <Badge tone="warning">Not stocked — free text</Badge>)}
      </div>
      {open && (results.data?.items.length ?? 0) > 0 && (
        <ul className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ink-200 bg-white p-1 shadow-pop">
          {results.data!.items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ name: m.name, medicineId: m.id })
                  setOpen(false)
                }}
                className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-ink-50', m.id === medicineId && 'bg-brand-50')}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink-900">{m.name}</span>
                  <span className="block truncate text-[11px] text-ink-500">
                    {m.genericName} · {m.strength} · {m.packSize}
                  </span>
                </span>
                <span className={cn('shrink-0 text-[11px] font-medium', m.stock.sellable > 0 ? 'text-emerald-700' : 'text-red-600')}>{m.stock.sellable > 0 ? `${m.stock.sellable} in stock` : 'Out of stock'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
