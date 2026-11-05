import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRightLeft, Info, SlidersHorizontal } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { Checkbox } from '../../components/ui/Form'
import { Button } from '../../components/ui/Button'
import { ExpiryBadge } from '../../components/ui/Badge'
import { useQuery } from '../../hooks/useQuery'
import { useTableState } from '../../hooks/useTableState'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { inventoryService, type BatchFilters } from '../../services/inventoryService'
import { useCan } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import type { ExpiryStatus } from '../../types/domain'
import type { BatchView } from '../../types/views'
import { AdjustmentModal, TransferModal, type AdjustmentInitial } from './dialogs'

export function BatchesTab({ initialExpiry }: { initialExpiry?: string }) {
  const can = useCan()
  const settings = useSettings()
  const t = useTableState<BatchFilters>({ expiry: (initialExpiry as ExpiryStatus | undefined) ?? undefined }, { pageSize: 15 })
  const q = useQuery(() => inventoryService.batches(t.query), [t.query], { tags: ['inventory'] })
  const [adjust, setAdjust] = useState<AdjustmentInitial | null>(null)
  const [transfer, setTransfer] = useState<{ medicine: { id: string; name: string; code: string }; batchId: string } | null>(null)
  const canTransfer = settings.enableStockTransfers && can('inventory.transfer')

  const columns: Column<BatchView>[] = [
    {
      key: 'medicine',
      header: 'Medicine',
      sortable: true,
      cell: (b) => (
        <Link to={`/medicines/${b.medicineId}`} className="group/link block min-w-40">
          <span className="block font-medium text-ink-900 group-hover/link:text-brand-700">{b.medicineName}</span>
          <span className="text-xs text-ink-500">{b.medicineCode}</span>
        </Link>
      ),
    },
    { key: 'batch', header: 'Batch', sortable: true, cell: (b) => <span className="font-mono text-xs font-medium text-ink-700">{b.batchNumber}</span> },
    { key: 'location', header: 'Location', sortable: true, hideBelow: 'md', cell: (b) => <span className="text-ink-600">{b.location}</span> },
    {
      key: 'expiry',
      header: 'Expiry',
      sortable: true,
      cell: (b) => (
        <div className="flex flex-col items-start gap-1">
          <span className="num text-ink-700">{formatDate(b.expiryDate)}</span>
          <ExpiryBadge status={b.expiryStatus} days={b.daysToExpiry} />
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Available',
      align: 'right',
      sortable: true,
      cell: (b) => <span className={cn('font-semibold', b.expiryStatus === 'EXPIRED' ? 'text-red-600 line-through decoration-red-300' : 'text-ink-900')}>{b.quantity}</span>,
    },
    { key: 'reserved', header: 'Reserved', align: 'right', hideBelow: 'lg', cell: (b) => <span className={b.reserved ? 'text-sky-700' : 'text-ink-300'}>{b.reserved}</span> },
    { key: 'damaged', header: 'Damaged', align: 'right', hideBelow: 'lg', cell: (b) => <span className={b.damaged ? 'text-amber-700' : 'text-ink-300'}>{b.damaged}</span> },
    { key: 'value', header: 'Value', align: 'right', sortable: true, hideBelow: 'sm', cell: (b) => formatINR(b.stockValue) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (b) => (
        <div className="flex justify-end gap-1">
          {can('inventory.adjust') && (
            <Button
              size="xs"
              variant="ghost"
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              onClick={() =>
                setAdjust({
                  medicine: { id: b.medicineId, name: b.medicineName, code: b.medicineCode },
                  batchId: b.id,
                  type: b.expiryStatus === 'EXPIRED' ? 'EXPIRED_WRITE_OFF' : 'DECREASE',
                  quantity: b.expiryStatus === 'EXPIRED' ? b.quantity : undefined,
                })
              }
            >
              {b.expiryStatus === 'EXPIRED' ? 'Write off' : 'Adjust'}
            </Button>
          )}
          {canTransfer && b.quantity > 0 && b.expiryStatus !== 'EXPIRED' && (
            <Button size="xs" variant="ghost" icon={<ArrowRightLeft className="h-3.5 w-3.5" />} onClick={() => setTransfer({ medicine: { id: b.medicineId, name: b.medicineName, code: b.medicineCode }, batchId: b.id })}>
              Transfer
            </Button>
          )}
        </div>
      ),
    },
  ]

  const active = !!(t.search || t.filters.location || t.filters.expiry || t.filters.includeEmpty)

  return (
    <Card>
      <FilterBar onReset={t.reset} active={active}>
        <SearchInput value={t.search} onChange={t.setSearch} placeholder="Search medicine or batch…" />
        <FilterSelect label="Location" value={t.filters.location ?? ''} onChange={(v) => t.setFilters((f) => ({ ...f, location: v || undefined }))} options={settings.locations.map((l) => ({ value: l, label: l }))} />
        <FilterSelect
          label="Expiry"
          value={t.filters.expiry ?? ''}
          onChange={(v) => t.setFilters((f) => ({ ...f, expiry: (v || undefined) as ExpiryStatus | undefined }))}
          options={[
            { value: 'OK', label: 'Good' },
            { value: 'NEAR_EXPIRY', label: `Near expiry (≤ ${settings.nearExpiryDays}d)` },
            { value: 'CRITICAL', label: `Critical (≤ ${settings.criticalExpiryDays}d)` },
            { value: 'EXPIRED', label: 'Expired' },
          ]}
        />
        <Checkbox label="Include empty batches" checked={!!t.filters.includeEmpty} onChange={(e) => t.setFilters((f) => ({ ...f, includeEmpty: e.target.checked || undefined }))} />
      </FilterBar>
      <div className="flex items-center gap-2 border-b border-ink-100 bg-brand-50/40 px-4 py-2 text-xs text-brand-900">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Batches are listed in FEFO order (first expiry, first out) — the point of sale allocates stock in this order by default.
      </div>
      <DataTable
        columns={columns}
        rows={q.data?.items}
        rowKey={(b) => b.id}
        loading={q.fetching}
        error={q.error}
        onRetry={q.refetch}
        rowClassName={(b) => (b.expiryStatus === 'EXPIRED' ? 'bg-red-50/40' : undefined)}
        server={{ total: q.data?.total ?? 0, page: t.page, pageSize: t.pageSize, sortBy: t.sortBy, sortDir: t.sortDir, onPageChange: t.setPage, onPageSizeChange: t.setPageSize, onSort: t.toggleSort }}
      />
      <AdjustmentModal open={!!adjust} onClose={() => setAdjust(null)} initial={adjust ?? undefined} />
      <TransferModal open={!!transfer} onClose={() => setTransfer(null)} initial={transfer ?? undefined} />
    </Card>
  )
}
