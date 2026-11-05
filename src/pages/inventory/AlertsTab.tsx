import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertOctagon, CalendarClock, CheckCircle2, PackageX, ShoppingCart, TrendingDown, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { useQuery } from '../../hooks/useQuery'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { inventoryService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import type { AlertKind, InventoryAlert } from '../../types/views'
import { AdjustmentModal, type AdjustmentInitial } from './dialogs'

const GROUPS: { kind: AlertKind; title: string; description: string; icon: ReactNode; tone: string }[] = [
  { kind: 'OUT_OF_STOCK', title: 'Out of stock', description: 'No sellable units — customers are being turned away.', icon: <PackageX className="h-4 w-4" />, tone: 'bg-red-50 text-red-600' },
  { kind: 'LOW_STOCK', title: 'Low stock', description: 'At or below the medicine’s minimum stock level.', icon: <TrendingDown className="h-4 w-4" />, tone: 'bg-amber-50 text-amber-700' },
  { kind: 'EXPIRED', title: 'Expired batches', description: 'Blocked from sale. Write off or return to supplier.', icon: <AlertOctagon className="h-4 w-4" />, tone: 'bg-red-50 text-red-600' },
  { kind: 'NEAR_EXPIRY', title: 'Near expiry', description: 'Prioritise these batches (FEFO) or arrange supplier returns.', icon: <CalendarClock className="h-4 w-4" />, tone: 'bg-accent-50 text-accent-700' },
]

export function AlertsTab() {
  const can = useCan()
  const settings = useSettings()
  const q = useQuery(() => inventoryService.alerts(), [], { tags: ['inventory', 'settings'] })
  const [writeOff, setWriteOff] = useState<AdjustmentInitial | null>(null)

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data)
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <Skeleton key={g.kind} className="h-64 rounded-2xl" />
        ))}
      </div>
    )
  if (q.data.length === 0)
    return (
      <Card>
        <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="All clear" description="No stock or expiry alerts right now. Alerts follow each medicine’s minimum stock level and the expiry windows in Settings." />
      </Card>
    )

  const action = (a: InventoryAlert) => {
    if (a.kind === 'OUT_OF_STOCK' || a.kind === 'LOW_STOCK')
      return can('purchases.manage') ? (
        <Link to={`/purchases/new?medicineId=${a.medicineId}`}>
          <Button size="xs" variant="subtle" icon={<ShoppingCart className="h-3.5 w-3.5" />}>
            Create PO
          </Button>
        </Link>
      ) : null
    if (a.kind === 'EXPIRED' && can('inventory.adjust'))
      return (
        <Button
          size="xs"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() => setWriteOff({ medicine: { id: a.medicineId, name: a.medicineName, code: a.medicineCode }, batchId: a.batchId, type: 'EXPIRED_WRITE_OFF', quantity: a.quantity })}
        >
          Write off
        </Button>
      )
    return null
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {GROUPS.map((g) => {
        const items = q.data!.filter((a) => a.kind === g.kind)
        return (
          <Card key={g.kind} className="flex flex-col">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {g.title} <Badge tone={items.length ? (g.kind === 'NEAR_EXPIRY' ? 'accent' : g.kind === 'LOW_STOCK' ? 'warning' : 'danger') : 'neutral'}>{items.length}</Badge>
                </span>
              }
              description={g.kind === 'NEAR_EXPIRY' ? `Expiring within ${settings.nearExpiryDays} days.` : g.description}
              icon={<span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', g.tone)}>{g.icon}</span>}
            />
            {items.length === 0 ? (
              <EmptyState compact icon={<CheckCircle2 className="h-5 w-5" />} title="Nothing here" />
            ) : (
              <ul className="scrollbar-thin max-h-96 divide-y divide-ink-100 overflow-y-auto border-t border-ink-100">
                {items.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50/60">
                    <div className="min-w-0 flex-1">
                      <Link to={`/medicines/${a.medicineId}`} className="block truncate text-[13.5px] font-medium text-ink-900 hover:text-brand-700">
                        {a.medicineName}
                      </Link>
                      <p className="truncate text-xs text-ink-500">
                        {(a.kind === 'OUT_OF_STOCK' || a.kind === 'LOW_STOCK') && (
                          <>
                            <span className="num font-semibold text-ink-700">{a.quantity}</span> left · min {a.minStockLevel} · reorder ≈ {formatINR(a.value)}
                          </>
                        )}
                        {a.kind === 'EXPIRED' && (
                          <>
                            Batch <span className="font-mono">{a.batchNumber}</span> · expired {formatDate(a.expiryDate)} · {a.quantity} units ({formatINR(a.value)})
                          </>
                        )}
                        {a.kind === 'NEAR_EXPIRY' && (
                          <>
                            Batch <span className="font-mono">{a.batchNumber}</span> · {a.daysToExpiry} days left · {a.quantity} units ({formatINR(a.value)})
                          </>
                        )}
                      </p>
                    </div>
                    {a.severity === 'critical' && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="Critical" />}
                    {action(a)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}
      <AdjustmentModal open={!!writeOff} onClose={() => setWriteOff(null)} initial={writeOff ?? undefined} />
    </div>
  )
}
