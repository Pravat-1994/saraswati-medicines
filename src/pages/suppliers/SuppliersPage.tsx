import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Building2, IndianRupee, PackageOpen, Pencil, Plus, Truck } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { EmptyState, Skeleton } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/Badge'
import { useQuery } from '../../hooks/useQuery'
import { useTableState } from '../../hooks/useTableState'
import { supplierService, type SupplierFilters } from '../../services/supplierService'
import { useCan } from '../../stores/sessionStore'
import { formatINR, sumMoney } from '../../lib/money'
import { cn } from '../../lib/utils'
import type { SupplierListItem } from '../../types/views'
import { SupplierFormModal } from './SupplierFormModal'

export default function SuppliersPage() {
  const can = useCan()
  const navigate = useNavigate()
  const table = useTableState<SupplierFilters>({ status: 'ALL', withDues: false }, { sortBy: 'name' })
  const list = useQuery(() => supplierService.list(table.query), [table.query], { tags: ['suppliers', 'purchases'] })
  const all = useQuery(() => supplierService.list({ pageSize: 1000 }), [], { tags: ['suppliers', 'purchases'] })
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<SupplierListItem | null>(null)
  const manage = can('suppliers.manage')

  const suppliers = all.data?.items ?? []
  const outstanding = sumMoney(suppliers.map((s) => s.outstanding))
  const openOrders = suppliers.reduce((a, s) => a + s.openOrders, 0)
  const withDues = suppliers.filter((s) => s.outstanding > 0).length

  const columns: Column<SupplierListItem>[] = [
    {
      key: 'name',
      header: 'Supplier',
      sortable: true,
      cell: (s) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium text-ink-900">{s.name}</div>
            <div className="truncate text-xs text-ink-500">
              {s.contactPerson} · <span className="num">{s.phone}</span>
            </div>
          </div>
        </div>
      ),
    },
    { key: 'city', header: 'City', sortable: true, hideBelow: 'md', cell: (s) => s.address.city },
    { key: 'gstin', header: 'GSTIN', hideBelow: 'lg', cell: (s) => <span className="num font-mono text-xs text-ink-600">{s.gstin}</span> },
    { key: 'terms', header: 'Terms', hideBelow: 'xl', cell: (s) => `${s.paymentTermsDays} days` },
    { key: 'purchases', header: 'Total purchases', sortable: true, align: 'right', hideBelow: 'sm', cell: (s) => formatINR(s.totalPurchases) },
    {
      key: 'outstanding',
      header: 'Outstanding',
      sortable: true,
      align: 'right',
      cell: (s) => <span className={cn('font-semibold', s.outstanding > 0 ? 'text-amber-700' : 'text-ink-400')}>{formatINR(s.outstanding)}</span>,
    },
    { key: 'status', header: 'Status', hideBelow: 'md', cell: (s) => (s.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral" dot>Inactive</Badge>) },
    ...(manage
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (s: SupplierListItem) => (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${s.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(s)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ),
          },
        ]
      : []),
  ]

  const filtered = !!table.search || table.filters.status !== 'ALL' || !!table.filters.withDues

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Distributors, their terms, purchase history and outstanding dues."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Suppliers' }]}
        actions={
          manage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Add supplier
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {all.loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Suppliers" value={suppliers.length} footer={`${suppliers.filter((s) => s.isActive).length} active`} icon={<Truck className="h-4 w-4" />} />
            <StatCard
              label="Total outstanding"
              value={formatINR(outstanding)}
              footer={`${withDues} supplier${withDues === 1 ? '' : 's'} with dues`}
              icon={<IndianRupee className="h-4 w-4" />}
              tone="amber"
              onClick={() => table.setFilters((f) => ({ ...f, withDues: true }))}
            />
            <StatCard label="Open purchase orders" value={openOrders} footer="Ordered or partially received" icon={<PackageOpen className="h-4 w-4" />} tone="blue" onClick={() => navigate('/purchases')} />
          </>
        )}
      </div>

      <Card>
        <FilterBar active={filtered} onReset={table.reset}>
          <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search name, contact, GSTIN, city…" />
          <FilterSelect
            label="Status"
            value={table.filters.status === 'ALL' ? '' : (table.filters.status ?? '')}
            onChange={(v) => table.setFilters((f) => ({ ...f, status: (v || 'ALL') as SupplierFilters['status'] }))}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 text-[13px] text-ink-700 hover:border-ink-300">
            <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={!!table.filters.withDues} onChange={(e) => table.setFilters((f) => ({ ...f, withDues: e.target.checked }))} />
            With dues only
          </label>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(s) => s.id}
          loading={list.loading || list.fetching}
          error={list.error}
          onRetry={list.refetch}
          onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
          rowClassName={(s) => (!s.isActive ? 'opacity-60' : undefined)}
          caption="Suppliers"
          server={{
            total: list.data?.total ?? 0,
            page: table.page,
            pageSize: table.pageSize,
            sortBy: table.sortBy,
            sortDir: table.sortDir,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
            onSort: table.toggleSort,
          }}
          empty={
            <EmptyState
              icon={<Truck className="h-5 w-5" />}
              title={filtered ? 'No suppliers match your filters' : 'No suppliers yet'}
              description={filtered ? 'Try a different search or clear the filters.' : 'Add your distributors to start raising purchase orders.'}
              action={
                filtered ? (
                  <Button variant="outline" onClick={table.reset}>
                    Clear filters
                  </Button>
                ) : manage ? (
                  <Button onClick={() => setCreating(true)}>Add supplier</Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      <SupplierFormModal open={creating} onClose={() => setCreating(false)} onSaved={(s) => navigate(`/suppliers/${s.id}`)} />
      <SupplierFormModal open={!!editing} onClose={() => setEditing(null)} supplier={editing ?? undefined} />
    </>
  )
}
