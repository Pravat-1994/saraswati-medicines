import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ClipboardList, IndianRupee, PackageCheck, Plus, ShoppingCart, Truck } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { DateRangeFilter, type DateFilterValue } from '../../components/ui/DateRangeFilter'
import { EmptyState, ProgressBar } from '../../components/ui/Feedback'
import { PaymentStatusBadge, PoStatusBadge } from '../../components/ui/Badge'
import { useQuery } from '../../hooks/useQuery'
import { useTableState } from '../../hooks/useTableState'
import { formatDate, presetRange } from '../../lib/dates'
import { formatINR, formatINRShort, sumMoney } from '../../lib/money'
import { PO_STATUS_LABEL } from '../../lib/purchases'
import { purchaseService, type PurchaseFilters } from '../../services/purchaseService'
import { supplierService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import type { PurchaseOrderListItem } from '../../types/views'

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open (draft / ordered / partial)' },
  ...(['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const).map((s) => ({ value: s, label: PO_STATUS_LABEL[s] })),
]

export default function PurchasesPage() {
  const can = useCan()
  const navigate = useNavigate()
  const [date, setDate] = useState<DateFilterValue | null>(null)
  const t = useTableState<PurchaseFilters>({}, { pageSize: 15 })
  const query = useMemo(() => ({ ...t.query, filters: { ...t.query.filters, range: date?.range } }), [t.query, date])
  const list = useQuery(() => purchaseService.list(query), [query], { tags: ['purchases'] })
  const all = useQuery(() => purchaseService.list({ pageSize: 10000 }), [], { tags: ['purchases'] })
  const suppliers = useQuery(() => supplierService.list({ pageSize: 200 }), [], { tags: ['suppliers'] })

  const kpi = useMemo(() => {
    const items = all.data?.items ?? []
    const open = items.filter((p) => p.status === 'ORDERED' || p.status === 'PARTIALLY_RECEIVED')
    const month = presetRange('MONTH')
    const received = items.filter((p) => (p.status === 'RECEIVED' || p.status === 'PARTIALLY_RECEIVED') && p.orderDate >= month.from)
    return {
      open: open.length,
      drafts: items.filter((p) => p.status === 'DRAFT').length,
      awaiting: sumMoney(open.map((p) => p.grandTotal * (1 - p.receivedPct / 100))),
      outstanding: sumMoney(items.map((p) => p.outstanding)),
      dueSuppliers: new Set(items.filter((p) => p.outstanding > 0).map((p) => p.supplierId)).size,
      receivedMonth: sumMoney(received.map((p) => p.grandTotal * (p.receivedPct / 100))),
      receivedCount: received.length,
    }
  }, [all.data])

  const columns: Column<PurchaseOrderListItem>[] = [
    {
      key: 'poNumber',
      header: 'PO number',
      sortable: true,
      cell: (p) => (
        <span className="block">
          <span className="block font-semibold text-ink-900">{p.poNumber}</span>
          {p.supplierInvoiceNumber && <span className="text-xs text-ink-500">Inv. {p.supplierInvoiceNumber}</span>}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      sortable: true,
      cell: (p) => (
        <Link to={`/suppliers/${p.supplierId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink-800 hover:text-brand-700">
          {p.supplierName}
        </Link>
      ),
    },
    { key: 'date', header: 'Order date', sortable: true, hideBelow: 'md', cell: (p) => <span className="num text-ink-600">{formatDate(p.orderDate)}</span> },
    { key: 'items', header: 'Items', align: 'right', hideBelow: 'lg', cell: (p) => p.itemCount },
    {
      key: 'received',
      header: 'Received',
      hideBelow: 'lg',
      cell: (p) => (
        <div className="flex w-28 items-center gap-2">
          <ProgressBar value={p.receivedPct} tone={p.receivedPct >= 100 ? 'brand' : p.receivedPct > 0 ? 'amber' : 'blue'} />
          <span className="num w-9 text-right text-xs text-ink-500">{p.receivedPct}%</span>
        </div>
      ),
    },
    { key: 'total', header: 'Total', align: 'right', sortable: true, cell: (p) => <span className="font-semibold text-ink-900">{formatINR(p.grandTotal)}</span> },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      hideBelow: 'sm',
      cell: (p) => <span className={p.outstanding > 0 ? 'font-medium text-red-600' : 'text-ink-300'}>{p.outstanding > 0 ? formatINR(p.outstanding) : '—'}</span>,
    },
    { key: 'status', header: 'Status', sortable: true, cell: (p) => <PoStatusBadge status={p.status} /> },
    { key: 'payment', header: 'Payment', hideBelow: 'xl', cell: (p) => (p.status === 'DRAFT' || p.status === 'CANCELLED' ? <span className="text-ink-300">—</span> : <PaymentStatusBadge status={p.paymentStatus} />) },
  ]

  const active = !!(t.search || t.filters.status || t.filters.supplierId || date)

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Purchase orders, goods receipts and supplier payables."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Purchases' }]}
        actions={
          can('purchases.manage') && (
            <Link to="/purchases/new">
              <Button icon={<Plus className="h-4 w-4" />}>New purchase order</Button>
            </Link>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open orders" value={kpi.open} icon={<ClipboardList className="h-4 w-4" />} footer={`${kpi.drafts} draft${kpi.drafts === 1 ? '' : 's'} awaiting review`} onClick={() => t.setFilters((f) => ({ ...f, status: 'OPEN' }))} />
        <StatCard label="Awaiting receipt" value={formatINRShort(kpi.awaiting)} icon={<Truck className="h-4 w-4" />} tone="blue" footer={formatINR(kpi.awaiting)} />
        <StatCard label="Outstanding payables" value={formatINRShort(kpi.outstanding)} icon={<IndianRupee className="h-4 w-4" />} tone="red" footer={`${kpi.dueSuppliers} supplier${kpi.dueSuppliers === 1 ? '' : 's'} with dues`} />
        <StatCard label="Received this month" value={formatINRShort(kpi.receivedMonth)} icon={<PackageCheck className="h-4 w-4" />} tone="violet" footer={`${kpi.receivedCount} order${kpi.receivedCount === 1 ? '' : 's'}`} />
      </div>
      <Card>
        <FilterBar
          onReset={() => {
            t.reset()
            setDate(null)
          }}
          active={active}
        >
          <SearchInput value={t.search} onChange={t.setSearch} placeholder="Search PO, supplier, invoice, medicine…" />
          <FilterSelect label="Status" value={t.filters.status ?? ''} onChange={(v) => t.setFilters((f) => ({ ...f, status: (v || undefined) as PurchaseFilters['status'] }))} options={STATUS_OPTIONS} />
          <FilterSelect
            label="Supplier"
            value={t.filters.supplierId ?? ''}
            onChange={(v) => t.setFilters((f) => ({ ...f, supplierId: v || undefined }))}
            options={(suppliers.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
        </FilterBar>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-3">
          {date ? (
            <DateRangeFilter value={date} onChange={(v) => { setDate(v); t.setPage(1) }} />
          ) : (
            <button className="text-[13px] font-medium text-brand-700 hover:underline" onClick={() => setDate({ preset: 'QUARTER', range: presetRange('QUARTER') })}>
              + Filter by order date
            </button>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(p) => p.id}
          loading={list.fetching}
          error={list.error}
          onRetry={list.refetch}
          onRowClick={(p) => navigate(`/purchases/${p.id}`)}
          empty={
            <EmptyState
              compact
              icon={<ShoppingCart className="h-5 w-5" />}
              title="No purchase orders found"
              description={active ? 'Try clearing filters.' : 'Create your first purchase order to replenish stock.'}
              action={can('purchases.manage') && !active ? <Link to="/purchases/new"><Button size="sm">New purchase order</Button></Link> : undefined}
            />
          }
          server={{ total: list.data?.total ?? 0, page: t.page, pageSize: t.pageSize, sortBy: t.sortBy, sortDir: t.sortDir, onPageChange: t.setPage, onPageSizeChange: t.setPageSize, onSort: t.toggleSort }}
        />
      </Card>
    </>
  )
}
