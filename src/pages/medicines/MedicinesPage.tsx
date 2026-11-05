import { useNavigate } from 'react-router'
import { Download, Pill, Plus } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useTableState } from '../../hooks/useTableState'
import { medicineService } from '../../services'
import { formatDate } from '../../lib/dates'
import { formatINR, formatNumber } from '../../lib/money'
import { downloadCsv } from '../../lib/export'
import { STOCK_STATUS_LABEL } from '../../lib/inventory'
import { useCan } from '../../stores/sessionStore'
import type { MedicineFilters } from '../../types/api'
import type { MedicineListItem } from '../../types/views'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { Badge, StockBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/Feedback'
import { Tabs } from '../../components/ui/Tabs'
import { daysUntil } from '../../lib/dates'
import { cn } from '../../lib/utils'

type Availability = NonNullable<MedicineFilters['availability']>

export default function MedicinesPage() {
  const navigate = useNavigate()
  const can = useCan()
  const t = useTableState<MedicineFilters>({ availability: 'ALL', expiry: 'ALL' }, { pageSize: 15, sortBy: 'name' })
  const list = useQuery(() => medicineService.list(t.query), [t.query], { tags: ['medicines', 'inventory'] })
  const lookups = useQuery(() => medicineService.lookups(), [], { tags: ['medicines', 'settings'] })
  const counts = useQuery(
    async () => {
      const all = await medicineService.list({ pageSize: 10000 })
      const c = { ALL: all.total, IN_STOCK: 0, LOW_STOCK: 0, OUT_OF_STOCK: 0 }
      all.items.forEach((m) => c[m.stock.status]++)
      return c
    },
    [],
    { tags: ['medicines', 'inventory'] },
  )

  const exportCsv = async () => {
    const all = await medicineService.list({ ...t.query, page: 1, pageSize: 10000 })
    downloadCsv('medicines', all.items, [
      { header: 'Code', value: (m) => m.code },
      { header: 'Name', value: (m) => m.name },
      { header: 'Generic', value: (m) => m.genericName },
      { header: 'Manufacturer', value: (m) => m.manufacturer },
      { header: 'Category', value: (m) => m.category },
      { header: 'Strength', value: (m) => m.strength },
      { header: 'Form', value: (m) => m.dosageForm },
      { header: 'HSN', value: (m) => m.hsnCode },
      { header: 'GST %', value: (m) => m.gstRate },
      { header: 'Purchase price', value: (m) => m.purchasePrice },
      { header: 'Selling price', value: (m) => m.sellingPrice },
      { header: 'Available', value: (m) => m.stock.sellable },
      { header: 'Min stock', value: (m) => m.minStockLevel },
      { header: 'Status', value: (m) => STOCK_STATUS_LABEL[m.stock.status] },
      { header: 'Nearest expiry', value: (m) => m.stock.nearestExpiry ?? '' },
    ])
  }

  const columns: Column<MedicineListItem>[] = [
    {
      key: 'name',
      header: 'Medicine',
      sortable: true,
      cell: (m) => (
        <div className="flex items-center gap-3">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold', m.isActive ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-400')}>
            {m.dosageForm.slice(0, 3).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-ink-900">{m.name}</span>
              {m.prescriptionRequired && <Badge tone="violet" className="px-1.5 py-0 text-[10px]">Rx</Badge>}
              {!m.isActive && <Badge className="px-1.5 py-0 text-[10px]">Inactive</Badge>}
            </div>
            <div className="truncate text-xs text-ink-500">
              {m.genericName} · {m.strength}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Code', sortable: true, hideBelow: 'md', cell: (m) => <span className="font-mono text-xs text-ink-600">{m.code}</span> },
    {
      key: 'manufacturer',
      header: 'Manufacturer',
      sortable: true,
      hideBelow: 'xl',
      cell: (m) => (
        <div>
          <div className="text-ink-800">{m.manufacturer}</div>
          <div className="text-xs text-ink-500">{m.category}</div>
        </div>
      ),
    },
    { key: 'sellingPrice', header: 'MRP', sortable: true, align: 'right', hideBelow: 'sm', cell: (m) => formatINR(m.sellingPrice) },
    {
      key: 'stock',
      header: 'Available',
      sortable: true,
      align: 'right',
      cell: (m) => (
        <div>
          <div className="font-semibold text-ink-900">{formatNumber(m.stock.sellable)}</div>
          <div className="text-[11px] text-ink-400">min {m.minStockLevel}</div>
        </div>
      ),
    },
    {
      key: 'expiry',
      header: 'Nearest expiry',
      sortable: true,
      hideBelow: 'lg',
      cell: (m) => {
        if (!m.stock.nearestExpiry) return <span className="text-ink-400">—</span>
        const days = daysUntil(m.stock.nearestExpiry)
        return (
          <div>
            <div className={cn('text-ink-800', days <= 90 && 'font-medium text-amber-700')}>{formatDate(m.stock.nearestExpiry)}</div>
            {m.stock.expired > 0 && <div className="text-[11px] font-medium text-red-600">{m.stock.expired} expired units</div>}
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', cell: (m) => <StockBadge status={m.stock.status} /> },
  ]

  const c = counts.data
  const availabilityTabs: { key: Availability; label: string; count?: number }[] = [
    { key: 'ALL', label: 'All medicines', count: c?.ALL },
    { key: 'IN_STOCK', label: 'In stock', count: c?.IN_STOCK },
    { key: 'LOW_STOCK', label: 'Low stock', count: c?.LOW_STOCK },
    { key: 'OUT_OF_STOCK', label: 'Out of stock', count: c?.OUT_OF_STOCK },
  ]
  const filtersActive = !!(t.search || t.filters.category || t.filters.manufacturer || (t.filters.expiry && t.filters.expiry !== 'ALL'))

  return (
    <div>
      <PageHeader
        title="Medicines"
        description="Your medicine catalogue with live batch-wise availability, pricing and expiry."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Medicines' }]}
        actions={
          <>
            <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              Export
            </Button>
            {can('medicines.manage') && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/medicines/new')}>
                Add medicine
              </Button>
            )}
          </>
        }
      />
      <Card>
        <Tabs className="px-4 pt-1" items={availabilityTabs} value={t.filters.availability ?? 'ALL'} onChange={(k) => t.setFilters((f) => ({ ...f, availability: k }))} />
        <FilterBar
          active={filtersActive}
          onReset={t.reset}
          actions={<span className="text-xs text-ink-500">{list.data ? `${list.data.total} results` : ''}</span>}
        >
          <SearchInput value={t.search} onChange={t.setSearch} placeholder="Search name, generic, code or barcode" />
          <FilterSelect label="Category" value={t.filters.category ?? ''} onChange={(v) => t.setFilters((f) => ({ ...f, category: v || undefined }))} options={(lookups.data?.categories ?? []).map((x) => ({ value: x, label: x }))} />
          <FilterSelect label="Manufacturer" value={t.filters.manufacturer ?? ''} onChange={(v) => t.setFilters((f) => ({ ...f, manufacturer: v || undefined }))} options={(lookups.data?.manufacturers ?? []).map((x) => ({ value: x, label: x }))} />
          <FilterSelect
            label="Expiry"
            value={t.filters.expiry === 'ALL' ? '' : (t.filters.expiry ?? '')}
            onChange={(v) => t.setFilters((f) => ({ ...f, expiry: (v || 'ALL') as MedicineFilters['expiry'] }))}
            options={[
              { value: 'NEAR_EXPIRY', label: 'Near expiry' },
              { value: 'EXPIRED', label: 'Has expired stock' },
            ]}
          />
        </FilterBar>
        <DataTable
          caption="Medicines"
          columns={columns}
          rows={list.data?.items}
          rowKey={(m) => m.id}
          loading={list.fetching}
          error={list.error}
          onRetry={list.refetch}
          onRowClick={(m) => navigate(`/medicines/${m.id}`)}
          server={{
            total: list.data?.total ?? 0,
            page: t.page,
            pageSize: t.pageSize,
            sortBy: t.sortBy,
            sortDir: t.sortDir,
            onPageChange: t.setPage,
            onPageSizeChange: t.setPageSize,
            onSort: t.toggleSort,
          }}
          empty={
            <EmptyState
              icon={<Pill className="h-5 w-5" />}
              title="No medicines match"
              description="Try a different search term or clear the filters."
              action={filtersActive ? <Button variant="outline" size="sm" onClick={t.reset}>Clear filters</Button> : undefined}
            />
          }
        />
      </Card>
    </div>
  )
}
