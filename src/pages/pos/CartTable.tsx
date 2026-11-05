import { Minus, Plus, ShieldAlert, ShoppingBasket, Trash2 } from 'lucide-react'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { usePosStore, type CartLine } from '../../stores/posStore'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import { Badge, ExpiryBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/Feedback'
import type { SaleItem } from '../../types/domain'

function QtyStepper({ line }: { line: CartLine }) {
  const setQuantity = usePosStore((s) => s.setQuantity)
  return (
    <div className="inline-flex items-center rounded-xl border border-ink-200 bg-white shadow-sm">
      <button onClick={() => setQuantity(line.key, line.quantity - 1)} disabled={line.quantity <= 1} className="flex h-8 w-8 items-center justify-center rounded-l-xl text-ink-500 hover:bg-ink-50 disabled:opacity-30" aria-label={`Decrease ${line.medicine.name}`}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        min={1}
        max={line.batch.quantity}
        value={line.quantity}
        onChange={(e) => setQuantity(line.key, Number(e.target.value))}
        onFocus={(e) => e.target.select()}
        aria-label={`Quantity of ${line.medicine.name}`}
        className="num h-8 w-12 border-x border-ink-200 bg-transparent text-center text-sm font-semibold text-ink-900 focus:outline-none"
      />
      <button onClick={() => setQuantity(line.key, line.quantity + 1)} disabled={line.quantity >= line.batch.quantity} className="flex h-8 w-8 items-center justify-center rounded-r-xl text-ink-500 hover:bg-ink-50 disabled:opacity-30" aria-label={`Increase ${line.medicine.name}`}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function CartTable({ priced }: { priced: SaleItem[] }) {
  const { lines, changeBatch, removeLine, setDiscount } = usePosStore()
  const can = useCan()
  const maxDiscount = useSessionStore((s) => s.role?.maxDiscountPct ?? 0)
  const canOverride = can('sales.overrideFefo')

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBasket className="h-5 w-5" />}
        title="Cart is empty"
        description="Scan a barcode or search for a medicine above. Stock is picked from the earliest-expiring batch automatically."
      />
    )
  }

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[680px] text-[13px]">
        <thead>
          <tr className="border-b border-ink-100 text-left text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
            <th className="py-2.5 pr-2 pl-4">Medicine & batch</th>
            <th className="px-2 py-2.5 text-center">Qty</th>
            <th className="px-2 py-2.5 text-right">MRP</th>
            <th className="px-2 py-2.5 text-center">Disc %</th>
            <th className="px-2 py-2.5 text-right">Amount</th>
            <th className="py-2.5 pr-4 pl-2" aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const fefo = line.batches.find((b) => b.expiryStatus !== 'EXPIRED' && b.quantity > 0)
            const p = priced[idx]
            return (
              <tr key={line.key} className="border-b border-ink-100 align-top last:border-0">
                <td className="py-3 pr-2 pl-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-ink-900">{line.medicine.name}</span>
                    {line.medicine.prescriptionRequired && <Badge tone="violet" className="px-1.5 py-0 text-[10px]">Rx</Badge>}
                  </div>
                  <div className="text-xs text-ink-500">
                    {line.medicine.genericName} · {line.medicine.packSize}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Batch for ${line.medicine.name}`}
                      value={line.batch.id}
                      disabled={!canOverride || line.batches.length < 2}
                      onChange={(e) => changeBatch(line.key, e.target.value, fefo?.id)}
                      title={!canOverride ? 'Your role cannot override FEFO batch allocation' : 'Choose batch (overrides FEFO)'}
                      className="h-7 rounded-lg border border-ink-200 bg-ink-50/50 px-2 font-mono text-[11px] text-ink-700 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-80"
                    >
                      {line.batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} · exp {formatDate(b.expiryDate)} · {b.quantity} avl{b.id === fefo?.id ? ' · FEFO' : ''}
                        </option>
                      ))}
                    </select>
                    <ExpiryBadge status={line.batch.expiryStatus} days={line.batch.daysToExpiry} />
                    {line.fefoOverridden && (
                      <Badge tone="accent" icon={<ShieldAlert className="h-3 w-3" />}>
                        FEFO override
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 text-center">
                  <QtyStepper line={line} />
                  <div className={cn('num mt-1 text-[11px]', line.quantity >= line.batch.quantity ? 'font-semibold text-amber-700' : 'text-ink-400')}>
                    of {line.batch.quantity} in batch
                  </div>
                </td>
                <td className="num px-2 py-3 text-right text-ink-700">{formatINR(line.batch.sellingPrice)}</td>
                <td className="px-2 py-3 text-center">
                  <input
                    type="number"
                    min={0}
                    max={maxDiscount}
                    step="0.5"
                    value={line.discountPct || ''}
                    placeholder="0"
                    onChange={(e) => setDiscount(line.key, Number(e.target.value))}
                    aria-label={`Discount for ${line.medicine.name}`}
                    aria-invalid={line.discountPct > maxDiscount || undefined}
                    className="num h-8 w-16 rounded-lg border border-ink-200 bg-white px-2 text-center text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none aria-[invalid=true]:border-red-400 aria-[invalid=true]:text-red-600"
                  />
                </td>
                <td className="px-2 py-3 text-right">
                  <div className="num font-semibold text-ink-900">{p ? formatINR(p.lineTotal) : '—'}</div>
                  {p && p.discountAmount > 0 && <div className="num text-[11px] text-emerald-700">−{formatINR(p.discountAmount)}</div>}
                  {p && <div className="num text-[11px] text-ink-400">GST {p.gstRate}%</div>}
                </td>
                <td className="py-3 pr-4 pl-2 text-right">
                  <button onClick={() => removeLine(line.key)} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${line.medicine.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
