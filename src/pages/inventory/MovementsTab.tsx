import { useState } from 'react'
import { Link } from 'react-router'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { DateRangeFilter, type DateFilterValue } from '../../components/ui/DateRangeFilter'
import { dateFilter } from '../../lib/dates'
import { Button } from '../../components/ui/Button'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { useQuery } from '../../hooks/useQuery'
import { useTableState } from '../../hooks/useTableState'
import { formatDateTime } from '../../lib/dates'
import { downloadCsv } from '../../lib/export'
import { cn } from '../../lib/utils'
import { MOVEMENT_LABEL } from '../../lib/inventory'
import { inventoryService } from '../../services'
import type { MovementFilters } from '../../types/api'
import type { MovementType, StockMovement } from '../../types/domain'

const MOVEMENT_TONE: Record<MovementType, BadgeTone> = {
  OPENING: 'neutral',
  PURCHASE_IN: 'brand',
  SALE_OUT: 'info',
  RETURN_IN: 'violet',
  ADJUSTMENT_IN: 'success',
  ADJUSTMENT_OUT: 'warning',
  DAMAGED: 'accent',
  EXPIRED_WRITE_OFF: 'danger',
  TRANSFER_OUT: 'neutral',
  TRANSFER_IN: 'neutral',
}

type Row = StockMovement & { medicineName: string }

function refLink(m: Row) {
  if (!m.referenceNumber) return <span className="text-ink-400">{m.reason ?? '—'}</span>
  const to = m.referenceType === 'SALE' ? `/sales/${m.referenceId}` : m.referenceType === 'PURCHASE_RECEIPT' ? `/purchases/${m.referenceId}` : undefined
  return to ? (
    <Link to={to} className="font-medium text-brand-700 hover:underline">
      {m.referenceNumber}
    </Link>
  ) : (
    <span className="text-ink-700">{m.referenceNumber}</span>
  )
}

export function MovementsTab() {
  const [date, setDate] = useState<DateFilterValue>(dateFilter('MONTH'))
  const t = useTableState<MovementFilters>({ type: undefined }, { pageSize: 25 })
  const query = { ...t.query, filters: { ...t.query.filters, range: date.range } }
  const q = useQuery(() => inventoryService.movements(query), [t.query, date.range.from, date.range.to], { tags: ['inventory'] })

  const exportCsv = async () => {
    const all = await inventoryService.movements({ ...query, page: 1, pageSize: 100000 })
    const ok = downloadCsv(`stock-movements-${date.range.from}-to-${date.range.to}`, all.items, [
      { header: 'Date', value: (m) => formatDateTime(m.timestamp) },
      { header: 'Medicine', value: (m) => m.medicineName },
      { header: 'Batch', value: (m) => m.batchNumber },
      { header: 'Type', value: (m) => MOVEMENT_LABEL[m.type] },
      { header: 'Quantity', value: (m) => m.quantity },
      { header: 'Balance after', value: (m) => m.balanceAfter },
      { header: 'Reference', value: (m) => m.referenceNumber },
      { header: 'Reason', value: (m) => m.reason },
      { header: 'Performed by', value: (m) => m.performedBy },
      { header: 'Authorised by', value: (m) => m.authorizedBy },
    ])
    if (ok) toast.success(`Exported ${all.items.length} movements.`)
    else toast.error('Downloads are blocked in this environment.')
  }

  const columns: Column<Row>[] = [
    { key: 'timestamp', header: 'Date & time', sortable: true, cell: (m) => <span className="num whitespace-nowrap text-ink-600">{formatDateTime(m.timestamp)}</span> },
    {
      key: 'medicine',
      header: 'Medicine / batch',
      sortable: true,
      cell: (m) => (
        <Link to={`/medicines/${m.medicineId}`} className="block min-w-36 hover:text-brand-700">
          <span className="block font-medium text-ink-900">{m.medicineName}</span>
          <span className="font-mono text-[11px] text-ink-500">{m.batchNumber}</span>
        </Link>
      ),
    },
    { key: 'type', header: 'Type', sortable: true, cell: (m) => <Badge tone={MOVEMENT_TONE[m.type]}>{MOVEMENT_LABEL[m.type]}</Badge> },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      sortable: true,
      cell: (m) => <span className={cn('font-semibold', m.quantity > 0 ? 'text-emerald-700' : 'text-red-600')}>{m.quantity > 0 ? `+${m.quantity}` : `−${Math.abs(m.quantity)}`}</span>,
    },
    { key: 'balance', header: 'Balance', align: 'right', hideBelow: 'sm', cell: (m) => m.balanceAfter },
    { key: 'ref', header: 'Reference', hideBelow: 'md', cell: refLink },
    {
      key: 'user',
      header: 'By',
      hideBelow: 'lg',
      cell: (m) => (
        <span className="block text-ink-700">
          {m.performedBy}
          {m.authorizedBy && m.authorizedBy !== m.performedBy && <span className="block text-[11px] text-ink-400">Authorised: {m.authorizedBy}</span>}
        </span>
      ),
    },
  ]

  return (
    <Card>
      <FilterBar
        onReset={t.reset}
        active={!!(t.search || t.filters.type)}
        actions={
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void exportCsv()} disabled={!q.data?.total}>
            Export CSV
          </Button>
        }
      >
        <SearchInput value={t.search} onChange={t.setSearch} placeholder="Search medicine, batch, reference…" />
        <FilterSelect
          label="Type"
          value={t.filters.type ?? ''}
          onChange={(v) => t.setFilters((f) => ({ ...f, type: v || undefined }))}
          options={Object.entries(MOVEMENT_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </FilterBar>
      <div className="border-b border-ink-100 px-4 py-3">
        <DateRangeFilter value={date} onChange={(v) => { setDate(v); t.setPage(1) }} />
      </div>
      <DataTable
        dense
        columns={columns}
        rows={q.data?.items}
        rowKey={(m) => m.id}
        loading={q.fetching}
        error={q.error}
        onRetry={q.refetch}
        server={{ total: q.data?.total ?? 0, page: t.page, pageSize: t.pageSize, sortBy: t.sortBy, sortDir: t.sortDir, onPageChange: t.setPage, onPageSizeChange: t.setPageSize, onSort: t.toggleSort }}
      />
    </Card>
  )
}
