import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Info, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { Alert, EmptyState } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { useTableState } from '../../hooks/useTableState'
import { customerService, type CustomerFilters } from '../../services/customerService'
import { useCan } from '../../stores/sessionStore'
import { formatINR } from '../../lib/money'
import { formatDate, relativeTime } from '../../lib/dates'
import { initials } from '../../lib/utils'
import type { CustomerListItem } from '../../types/views'
import { CustomerFormModal } from './CustomerFormModal'

const SEGMENTS = [
  { value: 'REGULAR', label: 'Regulars (5+ visits)' },
  { value: 'NEW', label: 'New (30 days)' },
  { value: 'INACTIVE', label: 'Inactive (30+ days)' },
]

export default function CustomersPage() {
  const can = useCan()
  const navigate = useNavigate()
  const table = useTableState<CustomerFilters>({ segment: 'ALL' }, { sortBy: 'name' })
  const list = useQuery(() => customerService.list(table.query), [table.query], { tags: ['customers', 'sales'] })
  const [editing, setEditing] = useState<CustomerListItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<CustomerListItem | null>(null)
  const remove = useMutation((id: string) => customerService.remove(id), {
    successMessage: 'Customer deleted',
    onSuccess: () => setDeleting(null),
  })
  const manage = can('customers.manage')

  const columns: Column<CustomerListItem>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortable: true,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-xs font-bold text-brand-800">{initials(c.name)}</span>
          <div className="min-w-0">
            <div className="truncate font-medium text-ink-900">{c.name}</div>
            <div className="truncate text-xs text-ink-500">{c.email ?? c.address ?? '—'}</div>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', cell: (c) => <span className="num text-ink-700">{c.phone}</span>, hideBelow: 'sm' },
    { key: 'spent', header: 'Total spent', sortable: true, align: 'right', cell: (c) => <span className="font-semibold text-ink-900">{formatINR(c.totalSpent)}</span> },
    {
      key: 'visits',
      header: 'Visits',
      sortable: true,
      align: 'right',
      hideBelow: 'md',
      cell: (c) => (
        <span className="inline-flex items-center gap-2">
          {c.visits >= 5 && <Badge tone="brand">Regular</Badge>}
          {c.visits}
        </span>
      ),
    },
    {
      key: 'lastVisit',
      header: 'Last visit',
      sortable: true,
      hideBelow: 'lg',
      cell: (c) => (c.lastVisit ? <span title={formatDate(c.lastVisit)}>{relativeTime(c.lastVisit)}</span> : <span className="text-ink-400">Never</span>),
    },
    ...(manage
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (c: CustomerListItem) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)} className="hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  const filtered = !!table.search || table.filters.segment !== 'ALL'

  return (
    <>
      <PageHeader
        title="Customers"
        description="Customer directory with purchase history. Registration is optional — walk-in sales never require a customer."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Customers' }]}
        actions={
          manage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Add customer
            </Button>
          )
        }
      />
      <Alert tone="info" icon={<Info className="h-4 w-4" />} className="mb-4">
        Customers can be registered here or directly from the Point of Sale. Phone numbers must be unique.
      </Alert>
      <Card>
        <FilterBar active={filtered} onReset={table.reset}>
          <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search name, phone, email…" />
          <FilterSelect
            label="Segment"
            value={table.filters.segment === 'ALL' ? '' : (table.filters.segment ?? '')}
            onChange={(v) => table.setFilters({ segment: (v || 'ALL') as CustomerFilters['segment'] })}
            options={SEGMENTS}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(c) => c.id}
          loading={list.loading || list.fetching}
          error={list.error}
          onRetry={list.refetch}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          caption="Customers"
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
              icon={<Users className="h-5 w-5" />}
              title={filtered ? 'No customers match your filters' : 'No customers yet'}
              description={filtered ? 'Try a different search or segment.' : 'Add regular customers to track their purchase history.'}
              action={
                filtered ? (
                  <Button variant="outline" onClick={table.reset}>
                    Clear filters
                  </Button>
                ) : manage ? (
                  <Button onClick={() => setCreating(true)}>Add customer</Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      <CustomerFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/customers/${c.id}`)} />
      <CustomerFormModal open={!!editing} onClose={() => setEditing(null)} customer={editing ?? undefined} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void remove.run(deleting.id)}
        loading={remove.pending}
        title="Delete customer?"
        confirmLabel="Delete customer"
        message={
          <>
            <strong className="text-ink-900">{deleting?.name}</strong> will be permanently removed. Customers with sales history cannot be deleted so their invoices stay traceable.
          </>
        }
      />
    </>
  )
}
