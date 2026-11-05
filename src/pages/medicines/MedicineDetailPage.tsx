import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Archive, Boxes, CalendarClock, History, IndianRupee, Pencil, Pill, ScanBarcode, ShoppingCart, Thermometer, Trash2, TrendingUp } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { medicineService } from '../../services'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR, formatNumber } from '../../lib/money'
import { marginPct } from '../../lib/pricing'
import { cn } from '../../lib/utils'
import { useCan } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import { MOVEMENT_LABEL } from '../../lib/inventory'
import type { StockMovement } from '../../types/domain'
import type { BatchView } from '../../types/views'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, ExpiryBadge, StockBadge } from '../../components/ui/Badge'
import { Tabs } from '../../components/ui/Tabs'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { ColumnChart, SERIES } from '../../components/charts/Charts'

type TabKey = 'overview' | 'batches' | 'movements'

export default function MedicineDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const settings = useSettings()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) ?? 'overview'
  const [confirm, setConfirm] = useState(false)
  const q = useQuery(() => medicineService.get(id!), [id], { tags: ['medicines', 'inventory', 'sales'] })
  const remove = useMutation((mid: string) => medicineService.remove(mid), {
    successMessage: (r) => (r.deleted ? 'Medicine deleted' : 'Medicine deactivated — history retained'),
    onSuccess: (r) => {
      setConfirm(false)
      if (r.deleted) navigate('/medicines')
    },
  })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const { medicine: m, stock, batches, movements, supplier } = q.data
  const fefoNext = batches.find((b) => b.expiryStatus !== 'EXPIRED' && b.quantity > 0)

  const batchColumns: Column<BatchView>[] = [
    {
      key: 'batch',
      header: 'Batch',
      cell: (b) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-semibold text-ink-900">{b.batchNumber}</span>
          {fefoNext?.id === b.id && <Badge tone="brand">Next to sell (FEFO)</Badge>}
        </div>
      ),
    },
    { key: 'location', header: 'Location', hideBelow: 'md', cell: (b) => b.location },
    { key: 'mfg', header: 'Mfg', hideBelow: 'lg', cell: (b) => formatDate(b.mfgDate) },
    { key: 'expiry', header: 'Expiry', cell: (b) => <div className="flex items-center gap-2">{formatDate(b.expiryDate)} <ExpiryBadge status={b.expiryStatus} days={b.daysToExpiry} /></div> },
    { key: 'cost', header: 'Cost', align: 'right', hideBelow: 'md', cell: (b) => formatINR(b.purchasePrice) },
    { key: 'mrp', header: 'MRP', align: 'right', hideBelow: 'sm', cell: (b) => formatINR(b.sellingPrice) },
    {
      key: 'qty',
      header: 'Available',
      align: 'right',
      cell: (b) => (
        <span className={cn('font-semibold', b.expiryStatus === 'EXPIRED' ? 'text-red-600 line-through decoration-red-300' : 'text-ink-900')}>{formatNumber(b.quantity)}</span>
      ),
    },
    { key: 'reserved', header: 'Reserved', align: 'right', hideBelow: 'lg', cell: (b) => (b.reserved ? formatNumber(b.reserved) : '—') },
    { key: 'damaged', header: 'Damaged', align: 'right', hideBelow: 'lg', cell: (b) => (b.damaged ? <span className="text-red-600">{formatNumber(b.damaged)}</span> : '—') },
  ]

  const movementColumns: Column<StockMovement>[] = [
    { key: 'time', header: 'Date', cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.timestamp)}</span> },
    { key: 'type', header: 'Type', cell: (r) => <Badge tone={r.quantity > 0 ? 'success' : r.type === 'SALE_OUT' ? 'neutral' : 'warning'}>{MOVEMENT_LABEL[r.type]}</Badge> },
    { key: 'batch', header: 'Batch', hideBelow: 'sm', cell: (r) => <span className="font-mono text-xs">{r.batchNumber}</span> },
    {
      key: 'ref',
      header: 'Reference',
      hideBelow: 'md',
      cell: (r) =>
        r.referenceType === 'SALE' ? (
          <Link className="font-medium text-brand-700 hover:underline" to={`/sales/${r.referenceId}`} onClick={(e) => e.stopPropagation()}>
            {r.referenceNumber}
          </Link>
        ) : r.referenceType === 'PURCHASE_RECEIPT' ? (
          <Link className="font-medium text-brand-700 hover:underline" to={`/purchases/${r.referenceId}`}>
            {r.referenceNumber}
          </Link>
        ) : (
          <span className="text-ink-600">{r.referenceNumber ?? r.reason ?? '—'}</span>
        ),
    },
    { key: 'qty', header: 'Qty', align: 'right', cell: (r) => <span className={cn('font-semibold', r.quantity > 0 ? 'text-emerald-700' : 'text-ink-800')}>{r.quantity > 0 ? `+${r.quantity}` : r.quantity}</span> },
    { key: 'bal', header: 'Balance', align: 'right', hideBelow: 'sm', cell: (r) => formatNumber(r.balanceAfter) },
    { key: 'by', header: 'By', hideBelow: 'lg', cell: (r) => <span className="text-ink-600">{r.performedBy}{r.authorizedBy && r.authorizedBy !== r.performedBy ? ` · approved by ${r.authorizedBy}` : ''}</span> },
  ]

  return (
    <div>
      <PageHeader
        title={m.name}
        badge={
          <div className="flex flex-wrap gap-1.5">
            <StockBadge status={stock.status} />
            {m.prescriptionRequired && <Badge tone="violet">Prescription</Badge>}
            {!m.isActive && <Badge>Inactive</Badge>}
          </div>
        }
        description={`${m.genericName} · ${m.strength} · ${m.dosageForm} · ${m.packSize}`}
        breadcrumbs={[{ label: 'Medicines', to: '/medicines' }, { label: m.name }]}
        actions={
          <>
            {can('purchases.manage') && (
              <Button variant="outline" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => navigate(`/purchases/new?medicineId=${m.id}${m.primarySupplierId ? `&supplierId=${m.primarySupplierId}` : ''}`)}>
                Reorder
              </Button>
            )}
            {can('sales.pos') && m.isActive && stock.sellable > 0 && (
              <Button variant="outline" icon={<ScanBarcode className="h-4 w-4" />} onClick={() => navigate(`/pos?add=${m.id}`)}>
                Sell
              </Button>
            )}
            {can('medicines.manage') && (
              <>
                <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(true)} disabled={!m.isActive && batches.length > 0}>
                  {batches.length > 0 || movements.length > 0 ? 'Deactivate' : 'Delete'}
                </Button>
                <Button icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/medicines/${m.id}/edit`)}>
                  Edit
                </Button>
              </>
            )}
          </>
        }
      />

      {stock.expired > 0 && (
        <Alert tone="danger" className="mb-4" icon={<CalendarClock className="h-4 w-4" />} title={`${stock.expired} expired unit(s) on hand`}>
          Expired batches are blocked from sale. Write them off from Inventory → Adjustments.
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Available to sell" value={formatNumber(stock.sellable)} icon={<Boxes className="h-4 w-4" />} footer={`Min ${m.minStockLevel} · ${stock.batchCount} batch${stock.batchCount === 1 ? '' : 'es'}`} />
        <StatCard label="Stock value (cost)" value={formatINR(stock.stockValue)} icon={<IndianRupee className="h-4 w-4" />} tone="blue" footer={stock.reserved ? `${stock.reserved} reserved` : undefined} />
        <StatCard label="Sold (30 days)" value={formatNumber(q.data.unitsSold30d)} icon={<TrendingUp className="h-4 w-4" />} tone="violet" footer={formatINR(q.data.revenue30d)} />
        <StatCard
          label="Nearest expiry"
          value={stock.nearestExpiry ? formatDate(stock.nearestExpiry) : '—'}
          icon={<CalendarClock className="h-4 w-4" />}
          tone={stock.nearExpiry > 0 ? 'amber' : 'ink'}
          footer={stock.nearExpiry > 0 ? `${stock.nearExpiry} units within ${settings.nearExpiryDays} days` : 'No near-expiry stock'}
        />
      </div>

      <Tabs
        className="mb-5"
        value={tab}
        onChange={(k) => setParams({ tab: k }, { replace: true })}
        items={[
          { key: 'overview', label: 'Overview', icon: <Pill className="h-4 w-4" /> },
          { key: 'batches', label: 'Batches', count: batches.length, icon: <Archive className="h-4 w-4" /> },
          { key: 'movements', label: 'Stock movements', count: movements.length, icon: <History className="h-4 w-4" /> },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader title="Product information" />
              <CardBody>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoRow label="Medicine code" value={<span className="font-mono">{m.code}</span>} />
                  <InfoRow label="Barcode" value={m.barcode ? <span className="font-mono">{m.barcode}</span> : '—'} />
                  <InfoRow label="HSN code" value={<span className="font-mono">{m.hsnCode}</span>} />
                  <InfoRow label="Manufacturer" value={m.manufacturer} />
                  <InfoRow label="Category" value={m.category} />
                  <InfoRow label="Dosage form" value={m.dosageForm} />
                  <InfoRow label="Composition" value={m.composition} className="sm:col-span-2 lg:col-span-3" />
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Monthly sales" description="Units sold (net of returns), last 6 months" />
              <CardBody>
                <ColumnChart data={q.data.monthlySales} xKey="month" yKey="units" label="Units sold" money={false} color={SERIES[0]} height={220} />
              </CardBody>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Pricing & tax" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-4">
                  <InfoRow label="Purchase price" value={formatINR(m.purchasePrice)} />
                  <InfoRow label={settings.pricesIncludeGst ? 'MRP (incl. GST)' : 'Selling price'} value={formatINR(m.sellingPrice)} />
                  <InfoRow label="GST rate" value={`${m.gstRate}%`} />
                  <InfoRow label="Margin" value={`${marginPct(m.sellingPrice, m.purchasePrice).toFixed(1)}%`} />
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Stock control" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-4">
                  <InfoRow label="Minimum level" value={m.minStockLevel} />
                  <InfoRow label="Reorder qty" value={m.reorderQuantity} />
                  <InfoRow label="Expired units" value={stock.expired} />
                  <InfoRow label="Damaged units" value={stock.damaged} />
                  <InfoRow
                    label="Primary supplier"
                    className="col-span-2"
                    value={supplier ? <Link to={`/suppliers/${supplier.id}`} className="font-medium text-brand-700 hover:underline">{supplier.name}</Link> : '—'}
                  />
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Storage" icon={<Thermometer className="h-4 w-4" />} />
              <CardBody>
                <p className="text-sm leading-relaxed text-ink-700">{m.storageInstructions}</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'batches' && (
        <Card>
          <CardHeader title="Batch-wise inventory" description="Sorted in FEFO order — the earliest-expiring sellable batch is dispensed first." />
          <DataTable
            columns={batchColumns}
            rows={batches}
            rowKey={(b) => b.id}
            pageSize={0}
            rowClassName={(b) => (b.expiryStatus === 'EXPIRED' ? 'bg-red-50/40' : undefined)}
            empty={<EmptyState compact icon={<Archive className="h-5 w-5" />} title="No batches yet" description="Receive a purchase order or add stock from Inventory to create the first batch." />}
          />
        </Card>
      )}

      {tab === 'movements' && (
        <Card>
          <CardHeader title="Stock movement history" description="Every stock-in and stock-out for this medicine (latest 200)." />
          <DataTable columns={movementColumns} rows={movements} rowKey={(r) => r.id} pageSize={15} dense empty={<EmptyState compact title="No movements recorded" />} />
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.run(m.id)}
        loading={remove.pending}
        title={batches.length > 0 || movements.length > 0 ? `Deactivate ${m.name}?` : `Delete ${m.name}?`}
        confirmLabel={batches.length > 0 || movements.length > 0 ? 'Deactivate' : 'Delete'}
        message={
          batches.length > 0 || movements.length > 0
            ? 'This medicine has stock history, so it will be deactivated instead of deleted. It will no longer appear at the counter, but its batches and audit trail are preserved.'
            : 'This medicine has no history and will be permanently removed from the catalogue.'
        }
      />
    </div>
  )
}
