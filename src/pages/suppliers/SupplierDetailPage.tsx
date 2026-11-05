import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { BadgeCheck, CalendarClock, FileText, IndianRupee, Mail, MapPin, Pencil, Phone, Plus, ShoppingCart, User, Wallet } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Tabs } from '../../components/ui/Tabs'
import { EmptyState, ErrorState, PageLoader, ProgressBar } from '../../components/ui/Feedback'
import { Badge, PaymentStatusBadge, PoStatusBadge } from '../../components/ui/Badge'
import { RankedBars, SERIES } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { supplierService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import { formatINR, formatNumber } from '../../lib/money'
import { formatDate, formatDateTime } from '../../lib/dates'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import { cn } from '../../lib/utils'
import type { SupplierPayment } from '../../types/domain'
import type { PurchaseOrderListItem } from '../../types/views'
import { SupplierFormModal } from './SupplierFormModal'
import { RecordPaymentModal } from './RecordPaymentModal'

type TabKey = 'orders' | 'payments' | 'medicines'

export default function SupplierDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const tab = (['orders', 'payments', 'medicines'].includes(params.get('tab') ?? '') ? params.get('tab') : 'orders') as TabKey
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)
  const q = useQuery(() => supplierService.get(id), [id], { tags: ['suppliers', 'purchases'] })

  if (q.loading) return <PageLoader />
  if (q.error || !q.data)
    return (
      <Card>
        <ErrorState message={q.error ?? 'Supplier not found.'} onRetry={q.refetch} />
      </Card>
    )

  const d = q.data
  const s = d.supplier
  const paidPct = d.totalPurchases > 0 ? (d.totalPaid / (d.totalPurchases + s.openingBalance)) * 100 : 0

  const poColumns: Column<PurchaseOrderListItem>[] = [
    { key: 'po', header: 'PO number', sortable: true, sortValue: (p) => p.poNumber, cell: (p) => <span className="num font-medium text-brand-700">{p.poNumber}</span> },
    { key: 'date', header: 'Order date', sortable: true, sortValue: (p) => p.orderDate, cell: (p) => formatDate(p.orderDate) },
    { key: 'status', header: 'Status', cell: (p) => <PoStatusBadge status={p.status} /> },
    { key: 'items', header: 'Items', align: 'right', hideBelow: 'md', cell: (p) => p.itemCount },
    { key: 'invoice', header: 'Supplier invoice', hideBelow: 'lg', cell: (p) => p.supplierInvoiceNumber ?? <span className="text-ink-400">—</span> },
    { key: 'total', header: 'Total', align: 'right', sortable: true, sortValue: (p) => p.grandTotal, cell: (p) => formatINR(p.grandTotal) },
    { key: 'payment', header: 'Payment', hideBelow: 'sm', cell: (p) => (p.status === 'DRAFT' || p.status === 'CANCELLED' ? <span className="text-ink-400">—</span> : <PaymentStatusBadge status={p.paymentStatus} />) },
    {
      key: 'outstanding',
      header: 'Due',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.outstanding,
      cell: (p) => <span className={cn('font-semibold', p.outstanding > 0 ? 'text-amber-700' : 'text-ink-400')}>{formatINR(p.outstanding)}</span>,
    },
  ]

  const payColumns: Column<SupplierPayment>[] = [
    { key: 'no', header: 'Payment', cell: (p) => <span className="num font-medium text-ink-900">{p.paymentNumber}</span> },
    { key: 'date', header: 'Date', sortable: true, sortValue: (p) => p.date, cell: (p) => formatDateTime(p.date) },
    {
      key: 'po',
      header: 'Against PO',
      hideBelow: 'md',
      cell: (p) => {
        const po = d.purchaseOrders.find((x) => x.id === p.purchaseOrderId)
        return po ? (
          <Link to={`/purchases/${po.id}`} onClick={(e) => e.stopPropagation()} className="num text-brand-700 hover:underline">
            {po.poNumber}
          </Link>
        ) : (
          <span className="text-ink-400">On account</span>
        )
      },
    },
    { key: 'method', header: 'Method', cell: (p) => <Badge tone="neutral">{PAYMENT_METHOD_LABEL[p.method]}</Badge> },
    { key: 'ref', header: 'Reference', hideBelow: 'lg', cell: (p) => <span className="num text-xs text-ink-600">{p.reference ?? '—'}</span> },
    { key: 'by', header: 'Recorded by', hideBelow: 'xl', cell: (p) => p.recordedBy },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, sortValue: (p) => p.amount, cell: (p) => <span className="font-semibold text-emerald-700">{formatINR(p.amount)}</span> },
  ]

  return (
    <>
      <PageHeader
        title={s.name}
        breadcrumbs={[{ label: 'Suppliers', to: '/suppliers' }, { label: s.name }]}
        badge={s.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral" dot>Inactive</Badge>}
        description={`${s.address.city}, ${s.address.state} · ${s.paymentTermsDays}-day payment terms`}
        actions={
          <>
            {can('suppliers.manage') && (
              <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can('suppliers.payments') && (
              <Button variant="outline" icon={<Wallet className="h-4 w-4" />} disabled={d.outstanding <= 0} onClick={() => setPaying(true)} title={d.outstanding <= 0 ? 'No outstanding dues' : undefined}>
                Record payment
              </Button>
            )}
            {can('purchases.manage') && s.isActive && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/purchases/new?supplierId=${s.id}`)}>
                New purchase order
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total purchases" value={formatINR(d.totalPurchases)} footer={`${d.purchaseOrders.length} purchase orders`} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="Total paid" value={formatINR(d.totalPaid)} footer={`${d.payments.length} payments`} icon={<BadgeCheck className="h-4 w-4" />} tone="blue" />
        <StatCard label="Outstanding" value={formatINR(d.outstanding)} footer={s.openingBalance > 0 ? `Incl. opening ${formatINR(s.openingBalance)}` : 'Across received goods'} icon={<IndianRupee className="h-4 w-4" />} tone={d.outstanding > 0 ? 'amber' : 'brand'} />
        <StatCard
          label="Last order"
          value={d.purchaseOrders.length ? formatDate([...d.purchaseOrders].sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0].orderDate) : '—'}
          icon={<CalendarClock className="h-4 w-4" />}
          tone="violet"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Supplier profile" icon={<FileText className="h-4 w-4" />} />
            <CardBody>
              <dl className="grid gap-4">
                <InfoRow label="Contact person" value={<span className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-ink-400" />{s.contactPerson}</span>} />
                <InfoRow label="Phone" value={<span className="num flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-ink-400" />{s.phone}</span>} />
                <InfoRow label="Email" value={s.email ? <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-ink-400" />{s.email}</span> : '—'} />
                <InfoRow
                  label="Address"
                  value={
                    <span className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                      <span>
                        {s.address.line1}
                        {s.address.line2 && <>, {s.address.line2}</>}
                        <br />
                        {s.address.city}, {s.address.state} – {s.address.pincode}
                      </span>
                    </span>
                  }
                />
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="GSTIN" value={<span className="num font-mono text-xs">{s.gstin}</span>} />
                  <InfoRow label="Drug licence" value={<span className="text-xs">{s.drugLicenseNo ?? '—'}</span>} />
                </div>
                {s.notes && <InfoRow label="Notes" value={<span className="text-[13px] leading-relaxed text-ink-700">{s.notes}</span>} />}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Payment position" />
            <CardBody>
              <div className="mb-2 flex justify-between text-[13px]">
                <span className="text-ink-500">Paid</span>
                <span className="num font-semibold text-ink-900">{Math.min(100, paidPct).toFixed(0)}%</span>
              </div>
              <ProgressBar value={paidPct} tone={d.outstanding > 0 ? 'amber' : 'brand'} />
              <p className="mt-3 text-xs text-ink-500">
                {formatINR(d.totalPaid)} paid of {formatINR(d.totalPurchases + s.openingBalance)} payable.
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <div className="px-4 pt-3">
            <Tabs<TabKey>
              value={tab}
              onChange={(k) => setParams({ tab: k }, { replace: true })}
              items={[
                { key: 'orders', label: 'Purchase orders', count: d.purchaseOrders.length },
                { key: 'payments', label: 'Payments', count: d.payments.length },
                { key: 'medicines', label: 'Medicines supplied', count: d.medicinesSupplied.length },
              ]}
            />
          </div>
          {tab === 'orders' && (
            <DataTable
              columns={poColumns}
              rows={[...d.purchaseOrders].sort((a, b) => b.orderDate.localeCompare(a.orderDate))}
              rowKey={(p) => p.id}
              onRowClick={(p) => navigate(`/purchases/${p.id}`)}
              pageSize={10}
              caption="Purchase orders"
              empty={<EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="No purchase orders yet" description="Purchase orders raised for this supplier will appear here." compact />}
            />
          )}
          {tab === 'payments' && (
            <DataTable
              columns={payColumns}
              rows={d.payments}
              rowKey={(p) => p.id}
              pageSize={10}
              caption="Supplier payments"
              empty={<EmptyState icon={<Wallet className="h-5 w-5" />} title="No payments recorded" description="Payments made to this supplier will appear in this ledger." compact />}
            />
          )}
          {tab === 'medicines' && (
            <CardBody className="pt-5">
              {d.medicinesSupplied.length ? (
                <RankedBars
                  color={SERIES[1]}
                  items={d.medicinesSupplied.slice(0, 15).map((m) => ({ key: m.medicineId, label: m.medicineName, value: m.value, sub: `${formatNumber(m.units)} units` }))}
                />
              ) : (
                <EmptyState title="No goods received yet" description="Medicines appear here once stock is received from this supplier." compact />
              )}
            </CardBody>
          )}
        </Card>
      </div>

      <SupplierFormModal open={editing} onClose={() => setEditing(false)} supplier={s} />
      <RecordPaymentModal open={paying} onClose={() => setPaying(false)} supplierId={s.id} supplierName={s.name} outstanding={d.outstanding} />
    </>
  )
}
