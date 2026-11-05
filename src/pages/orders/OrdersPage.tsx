import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ExternalLink, FileText, Globe, PackageCheck, Store, Truck } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { onlineOrderService } from '../../services'
import { formatDateTime, relativeTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { ORDER_STATUS_LABEL } from '../../lib/orders'
import type { OrderFilters } from '../../types/api'
import type { OnlineOrder } from '../../types/domain'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, SearchInput } from '../../components/ui/FilterBar'
import { Tabs } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/Feedback'
import { OrderStatusBadge } from './OrderStatusBadge'

type Tab = NonNullable<OrderFilters['status']>

export default function OrdersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'ACTIVE'
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const list = useQuery(() => onlineOrderService.list({ status: tab, search: debounced || undefined }), [tab, debounced], { tags: ['sales', 'inventory'] })
  const counts = useQuery(() => onlineOrderService.counts(), [], { tags: ['sales', 'inventory'] })
  const c = counts.data
  const active = c ? c.PLACED + c.CONFIRMED + c.READY + c.OUT_FOR_DELIVERY : undefined
  const shopUrl = `${window.location.pathname}#/shop`

  const columns: Column<OnlineOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (o) => (
        <div>
          <div className="font-mono text-[13px] font-semibold text-ink-900">{o.orderNumber}</div>
          <div className="text-xs text-ink-500" title={formatDateTime(o.placedAt)}>
            {relativeTime(o.placedAt)}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (o) => (
        <div>
          <div className="text-ink-900">{o.customerName}</div>
          <div className="text-xs text-ink-500">{o.customerPhone}</div>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      hideBelow: 'lg',
      cell: (o) => <span className="line-clamp-2 text-ink-600">{o.items.map((i) => `${i.quantity} × ${i.medicineName}`).join(', ')}</span>,
    },
    {
      key: 'fulfil',
      header: 'Fulfilment',
      hideBelow: 'md',
      cell: (o) => (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-ink-700">
            {o.fulfilment === 'DELIVERY' ? <Truck className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
            {o.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'}
          </span>
          {o.preferredSlot && <span className="text-[11px] text-ink-400">{o.preferredSlot}</span>}
        </div>
      ),
    },
    {
      key: 'rx',
      header: 'Rx',
      hideBelow: 'sm',
      cell: (o) =>
        o.prescriptionRequired ? (
          <Badge tone={o.prescriptionVerified ? 'success' : 'violet'} icon={<FileText className="h-3 w-3" />}>
            {o.prescriptionVerified ? 'Verified' : 'To verify'}
          </Badge>
        ) : (
          <span className="text-ink-300">—</span>
        ),
    },
    { key: 'total', header: 'Est. total', align: 'right', cell: (o) => <span className="font-semibold">{formatINR(o.estimatedTotal)}</span> },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Online orders"
        description="Orders placed by customers on the storefront. Verify prescriptions, reserve stock, then hand over or deliver — completing an order creates the invoice."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Online orders' }]}
        actions={
          <a href={shopUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" icon={<Globe className="h-4 w-4" />} iconRight={<ExternalLink className="h-3.5 w-3.5" />}>
              Open storefront
            </Button>
          </a>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New orders" value={c?.PLACED ?? '…'} tone="amber" icon={<Globe className="h-4 w-4" />} footer="Awaiting confirmation" onClick={() => setParams({ tab: 'PLACED' })} />
        <StatCard label="Being packed" value={c?.CONFIRMED ?? '…'} tone="blue" icon={<PackageCheck className="h-4 w-4" />} footer="Stock reserved" onClick={() => setParams({ tab: 'CONFIRMED' })} />
        <StatCard label="Ready / out for delivery" value={c ? c.READY + c.OUT_FOR_DELIVERY : '…'} tone="violet" icon={<Truck className="h-4 w-4" />} onClick={() => setParams({ tab: 'READY' })} />
        <StatCard label="Completed" value={c?.COMPLETED ?? '…'} icon={<Store className="h-4 w-4" />} onClick={() => setParams({ tab: 'COMPLETED' })} />
      </div>
      <Card>
        <Tabs
          className="px-4 pt-1"
          value={tab}
          onChange={(k) => setParams({ tab: k }, { replace: true })}
          items={[
            { key: 'ACTIVE', label: 'Active', count: active },
            { key: 'PLACED', label: ORDER_STATUS_LABEL.PLACED, count: c?.PLACED },
            { key: 'CONFIRMED', label: ORDER_STATUS_LABEL.CONFIRMED, count: c?.CONFIRMED },
            { key: 'READY', label: 'Ready', count: c?.READY },
            { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', count: c?.OUT_FOR_DELIVERY },
            { key: 'COMPLETED', label: 'Completed' },
            { key: 'CANCELLED', label: 'Cancelled' },
            { key: 'ALL', label: 'All' },
          ]}
        />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Order no., customer, phone or medicine" />
        </FilterBar>
        <DataTable
          caption="Online orders"
          columns={columns}
          rows={list.data}
          rowKey={(o) => o.id}
          loading={list.fetching}
          error={list.error}
          onRetry={list.refetch}
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          rowClassName={(o) => (o.status === 'PLACED' ? 'bg-accent-50/40' : undefined)}
          pageSize={15}
          empty={<EmptyState icon={<Globe className="h-5 w-5" />} title="No orders here" description="New storefront orders appear in the Active tab." />}
        />
      </Card>
    </div>
  )
}
