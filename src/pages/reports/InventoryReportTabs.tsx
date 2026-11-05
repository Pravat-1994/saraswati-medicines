import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Boxes, CalendarX2, IndianRupee, PackageX, Warehouse } from 'lucide-react'
import { CardBody, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Badge, ExpiryBadge, StockBadge } from '../../components/ui/Badge'
import { Tabs } from '../../components/ui/Tabs'
import { RankedBars, SERIES, SegmentedBar } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { inventoryService } from '../../services'
import { formatDate } from '../../lib/dates'
import { formatINR, formatNumber, sumMoney } from '../../lib/money'
import type { BatchView, InventoryAlert } from '../../types/views'
import { KpiGrid, ReportActions, ReportCard, TotalsFooter } from './ReportParts'

const medicineLink = (id: string, name: string, sub?: string) => (
  <div>
    <Link to={`/medicines/${id}`} className="font-medium text-ink-900 hover:text-brand-700">
      {name}
    </Link>
    {sub && <div className="text-xs text-ink-500">{sub}</div>}
  </div>
)

export function InventoryValuationTab() {
  const q = useQuery(
    async () => {
      const [overview, batches] = await Promise.all([inventoryService.overview(), inventoryService.batches({ pageSize: 5000 })])
      return { overview, batches: batches.items.filter((b) => b.expiryStatus !== 'EXPIRED' && b.quantity > 0) }
    },
    [],
    { tags: ['inventory', 'reports'] },
  )
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (q.loading || !q.data) return <Skeleton className="h-96 rounded-2xl" />
  const { overview: o, batches } = q.data
  const sorted = [...batches].sort((a, b) => b.stockValue - a.stockValue)
  const columns: Column<BatchView>[] = [
    { key: 'medicine', header: 'Medicine', sortable: true, sortValue: (b) => b.medicineName, cell: (b) => medicineLink(b.medicineId, b.medicineName, `${b.medicineCode} · ${b.category}`) },
    { key: 'batch', header: 'Batch', cell: (b) => <span className="num text-xs">{b.batchNumber}</span> },
    { key: 'location', header: 'Location', cell: (b) => b.location },
    { key: 'expiry', header: 'Expiry', sortable: true, sortValue: (b) => b.expiryDate, cell: (b) => formatDate(b.expiryDate) },
    { key: 'qty', header: 'Qty', align: 'right', sortable: true, sortValue: (b) => b.quantity, cell: (b) => formatNumber(b.quantity) },
    { key: 'cost', header: 'Unit cost', align: 'right', cell: (b) => formatINR(b.purchasePrice) },
    { key: 'value', header: 'Value at cost', align: 'right', sortable: true, sortValue: (b) => b.stockValue, cell: (b) => <span className="font-semibold">{formatINR(b.stockValue)}</span> },
    { key: 'retail', header: 'Value at MRP', align: 'right', cell: (b) => formatINR(b.quantity * b.sellingPrice) },
  ]
  return (
    <div className="space-y-6">
      <KpiGrid>
        <StatCard label="Stock value (cost)" value={formatINR(o.stockValueCost)} icon={<IndianRupee className="h-4 w-4" />} footer="Sellable, unexpired stock" />
        <StatCard label="Stock value (MRP)" value={formatINR(o.stockValueRetail)} icon={<Warehouse className="h-4 w-4" />} tone="blue" footer={`Potential margin ${formatINR(o.stockValueRetail - o.stockValueCost)}`} />
        <StatCard label="Sellable units" value={formatNumber(o.sellableUnits)} icon={<Boxes className="h-4 w-4" />} tone="violet" footer={`${o.skuCount} active SKUs`} />
        <StatCard label="Expired stock value" value={formatINR(o.expiredValue)} icon={<CalendarX2 className="h-4 w-4" />} tone="red" footer={`${formatNumber(o.expiredUnits)} units to write off`} />
      </KpiGrid>
      <div className="grid gap-6 lg:grid-cols-2">
        <ReportCard title="Value by category" description="At cost">
          <CardBody>
            <RankedBars color={SERIES[0]} items={o.byCategory.slice(0, 10).map((c) => ({ key: c.category, label: c.category, value: c.value, sub: `${formatNumber(c.units)} units` }))} />
          </CardBody>
        </ReportCard>
        <ReportCard title="Value by location">
          <CardBody>
            <SegmentedBar parts={o.byLocation.map((l, i) => ({ label: l.location, value: l.value, color: SERIES[i % SERIES.length] }))} />
          </CardBody>
        </ReportCard>
      </div>
      <ReportCard
        title="Batch-wise valuation"
        description={`Snapshot as of today · ${batches.length} batches`}
        actions={
          <ReportActions
            filename="inventory-valuation"
            rows={sorted}
            columns={[
              { header: 'Code', value: (b) => b.medicineCode },
              { header: 'Medicine', value: (b) => b.medicineName },
              { header: 'Category', value: (b) => b.category },
              { header: 'Batch', value: (b) => b.batchNumber },
              { header: 'Location', value: (b) => b.location },
              { header: 'Expiry', value: (b) => b.expiryDate },
              { header: 'Quantity', value: (b) => b.quantity },
              { header: 'Unit cost', value: (b) => b.purchasePrice },
              { header: 'Value at cost', value: (b) => b.stockValue },
              { header: 'MRP', value: (b) => b.sellingPrice },
            ]}
          />
        }
      >
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(b) => b.id}
          pageSize={15}
          dense
          caption="Batch-wise valuation"
          footer={<TotalsFooter columns={columns} values={{ qty: formatNumber(batches.reduce((a, b) => a + b.quantity, 0)), value: formatINR(sumMoney(batches.map((b) => b.stockValue))), retail: formatINR(sumMoney(batches.map((b) => b.quantity * b.sellingPrice))) }} />}
        />
      </ReportCard>
    </div>
  )
}

export function LowStockReportTab() {
  const q = useQuery(() => inventoryService.alerts(), [], { tags: ['inventory', 'reports'] })
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (q.loading || !q.data) return <Skeleton className="h-96 rounded-2xl" />
  const rows = q.data.filter((a) => a.kind === 'LOW_STOCK' || a.kind === 'OUT_OF_STOCK').sort((a, b) => a.quantity - b.quantity)
  const out = rows.filter((r) => r.kind === 'OUT_OF_STOCK').length
  const columns: Column<InventoryAlert>[] = [
    { key: 'medicine', header: 'Medicine', sortable: true, sortValue: (a) => a.medicineName, cell: (a) => medicineLink(a.medicineId, a.medicineName, a.medicineCode) },
    { key: 'status', header: 'Status', cell: (a) => <StockBadge status={a.kind === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'LOW_STOCK'} /> },
    { key: 'qty', header: 'Available', align: 'right', sortable: true, sortValue: (a) => a.quantity, cell: (a) => <span className="font-semibold">{formatNumber(a.quantity)}</span> },
    { key: 'min', header: 'Minimum level', align: 'right', cell: (a) => formatNumber(a.minStockLevel ?? 0) },
    { key: 'gap', header: 'Shortfall', align: 'right', cell: (a) => formatNumber(Math.max(0, (a.minStockLevel ?? 0) - a.quantity)) },
    { key: 'value', header: 'Reorder value (est.)', align: 'right', sortable: true, sortValue: (a) => a.value, cell: (a) => formatINR(a.value) },
  ]
  return (
    <div className="space-y-6">
      <KpiGrid>
        <StatCard label="Below minimum" value={rows.length} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" footer="Uses medicine-specific minimum levels" />
        <StatCard label="Out of stock" value={out} icon={<PackageX className="h-4 w-4" />} tone="red" />
        <StatCard label="Estimated reorder value" value={formatINR(sumMoney(rows.map((r) => r.value)))} icon={<IndianRupee className="h-4 w-4" />} tone="blue" footer="Reorder qty × purchase price" />
      </KpiGrid>
      <ReportCard
        title="Low-stock report"
        actions={
          <ReportActions
            filename="low-stock-report"
            rows={rows}
            columns={[
              { header: 'Code', value: (a) => a.medicineCode },
              { header: 'Medicine', value: (a) => a.medicineName },
              { header: 'Status', value: (a) => (a.kind === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock') },
              { header: 'Available', value: (a) => a.quantity },
              { header: 'Minimum level', value: (a) => a.minStockLevel },
              { header: 'Reorder value', value: (a) => a.value },
            ]}
          />
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          pageSize={15}
          caption="Low-stock report"
          rowClassName={(a) => (a.kind === 'OUT_OF_STOCK' ? 'bg-red-50/30' : undefined)}
          empty={<EmptyState icon={<Boxes className="h-5 w-5" />} title="All medicines are above their minimum levels" description="Nothing to reorder right now." compact />}
        />
      </ReportCard>
    </div>
  )
}

type ExpiryView = 'EXPIRED' | 'NEAR_EXPIRY'

export function ExpiryReportTab() {
  const [view, setView] = useState<ExpiryView>('NEAR_EXPIRY')
  const q = useQuery(() => inventoryService.batches({ pageSize: 5000, filters: { expiry: view } }), [view], { tags: ['inventory', 'reports'] })
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  const rows = (q.data?.items ?? []).filter((b) => b.quantity > 0).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
  const columns: Column<BatchView>[] = [
    { key: 'medicine', header: 'Medicine', sortable: true, sortValue: (b) => b.medicineName, cell: (b) => medicineLink(b.medicineId, b.medicineName, b.medicineCode) },
    { key: 'batch', header: 'Batch', cell: (b) => <span className="num text-xs">{b.batchNumber}</span> },
    { key: 'location', header: 'Location', cell: (b) => <Badge tone="neutral">{b.location}</Badge> },
    { key: 'expiry', header: 'Expiry date', sortable: true, sortValue: (b) => b.expiryDate, cell: (b) => formatDate(b.expiryDate) },
    { key: 'status', header: 'Status', cell: (b) => <ExpiryBadge status={b.expiryStatus} days={b.daysToExpiry} /> },
    { key: 'qty', header: 'Qty', align: 'right', sortable: true, sortValue: (b) => b.quantity, cell: (b) => formatNumber(b.quantity) },
    { key: 'value', header: 'Value at cost', align: 'right', sortable: true, sortValue: (b) => b.stockValue, cell: (b) => <span className="font-semibold">{formatINR(b.stockValue)}</span> },
  ]
  return (
    <ReportCard
      title="Expiry report"
      description={view === 'EXPIRED' ? 'Expired batches still holding stock — cannot be sold' : 'Batches inside the configured near-expiry window'}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Tabs<ExpiryView>
            variant="pill"
            value={view}
            onChange={setView}
            items={[
              { key: 'NEAR_EXPIRY', label: 'Expiring soon' },
              { key: 'EXPIRED', label: 'Expired' },
            ]}
          />
          <ReportActions
            filename={view === 'EXPIRED' ? 'expired-stock-report' : 'near-expiry-report'}
            rows={rows}
            columns={[
              { header: 'Code', value: (b) => b.medicineCode },
              { header: 'Medicine', value: (b) => b.medicineName },
              { header: 'Batch', value: (b) => b.batchNumber },
              { header: 'Location', value: (b) => b.location },
              { header: 'Expiry', value: (b) => b.expiryDate },
              { header: 'Days to expiry', value: (b) => b.daysToExpiry },
              { header: 'Quantity', value: (b) => b.quantity },
              { header: 'Value at cost', value: (b) => b.stockValue },
            ]}
          />
        </div>
      }
    >
      <DataTable
        columns={columns}
        rows={q.data ? rows : undefined}
        loading={q.loading}
        rowKey={(b) => b.id}
        pageSize={15}
        caption="Expiry report"
        empty={<EmptyState icon={<CalendarX2 className="h-5 w-5" />} title={view === 'EXPIRED' ? 'No expired stock on hand' : 'No batches nearing expiry'} compact />}
        footer={rows.length ? <TotalsFooter columns={columns} values={{ qty: formatNumber(rows.reduce((a, b) => a + b.quantity, 0)), value: formatINR(sumMoney(rows.map((b) => b.stockValue))) }} /> : undefined}
      />
    </ReportCard>
  )
}
