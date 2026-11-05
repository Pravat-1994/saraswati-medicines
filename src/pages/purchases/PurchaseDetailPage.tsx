import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Ban, Building2, CalendarDays, FileText, PackageCheck, Pencil, Phone, Printer, Send, Trash2, Wallet } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Alert, EmptyState, ErrorState, PageLoader, ProgressBar } from '../../components/ui/Feedback'
import { PaymentStatusBadge, PoStatusBadge } from '../../components/ui/Badge'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { poOutstanding, poReceivedValue } from '../../lib/purchases'
import { printPage } from '../../lib/export'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import { purchaseService, supplierService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import type { PurchaseOrderItem } from '../../types/domain'
import { ReceiveGoodsModal } from './ReceiveGoodsModal'
import { RecordPaymentModal } from './RecordPaymentModal'

export default function PurchaseDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const q = useQuery(() => purchaseService.get(id), [id], { tags: ['purchases'] })
  const supplier = useQuery(() => supplierService.get(q.data!.supplierId), [q.data?.supplierId], { enabled: !!q.data, tags: ['suppliers', 'purchases'] })
  const [receiving, setReceiving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | 'place' | null>(null)

  const place = useMutation(() => purchaseService.setStatus(id, 'ORDERED'), { successMessage: 'Purchase order placed.', onSuccess: () => setConfirm(null) })
  const cancel = useMutation(() => purchaseService.setStatus(id, 'CANCELLED'), { successMessage: 'Purchase order cancelled.', onSuccess: () => setConfirm(null) })
  const remove = useMutation(() => purchaseService.remove(id), { successMessage: 'Draft deleted.', onSuccess: () => navigate('/purchases') })

  const crumbs = [{ label: 'Purchases', to: '/purchases' }, { label: q.data?.poNumber ?? 'Order' }]
  if (q.error) return (<><PageHeader title="Purchase order" breadcrumbs={crumbs} /><Card><ErrorState message={q.error} onRetry={q.refetch} /></Card></>)
  if (!q.data) return <PageLoader />
  const po = q.data
  const outstanding = poOutstanding(po)
  const payable = poReceivedValue(po)
  const editable = po.receipts.length === 0 && (po.status === 'DRAFT' || po.status === 'ORDERED')
  const receivable = po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED'
  const payments = (supplier.data?.payments ?? []).filter((p) => p.purchaseOrderId === po.id)
  const ordered = po.items.reduce((a, i) => a + i.orderedQty, 0)
  const received = po.items.reduce((a, i) => a + Math.min(i.receivedQty, i.orderedQty), 0)
  const receivedPct = ordered ? Math.round((received / ordered) * 100) : 0

  const columns: Column<PurchaseOrderItem>[] = [
    {
      key: 'medicine',
      header: 'Medicine',
      cell: (i) => (
        <Link to={`/medicines/${i.medicineId}`} className="font-medium text-ink-900 hover:text-brand-700">
          {i.medicineName}
        </Link>
      ),
    },
    { key: 'ordered', header: 'Ordered', align: 'right', cell: (i) => <>{i.orderedQty}{i.freeQty > 0 && <span className="text-xs text-emerald-700"> +{i.freeQty} free</span>}</> },
    { key: 'received', header: 'Received', align: 'right', cell: (i) => <span className={i.receivedQty >= i.orderedQty ? 'font-semibold text-emerald-700' : ''}>{i.receivedQty}</span> },
    { key: 'pending', header: 'Pending', align: 'right', hideBelow: 'sm', cell: (i) => { const p = Math.max(0, i.orderedQty + i.freeQty - i.receivedQty); return <span className={p ? 'font-medium text-amber-700' : 'text-ink-300'}>{p}</span> } },
    { key: 'price', header: 'Rate', align: 'right', hideBelow: 'md', cell: (i) => formatINR(i.purchasePrice) },
    { key: 'disc', header: 'Disc', align: 'right', hideBelow: 'lg', cell: (i) => (i.discountPct ? `${i.discountPct}%` : '—') },
    { key: 'taxable', header: 'Taxable', align: 'right', hideBelow: 'lg', cell: (i) => formatINR(i.taxableAmount) },
    { key: 'gst', header: 'GST', align: 'right', hideBelow: 'md', cell: (i) => <span className="text-ink-600">{formatINR(i.gstAmount)} <span className="text-[11px] text-ink-400">({i.gstRate}%)</span></span> },
    { key: 'total', header: 'Total', align: 'right', cell: (i) => <span className="font-semibold">{formatINR(i.lineTotal)}</span> },
  ]

  return (
    <>
      <PageHeader
        title={po.poNumber}
        breadcrumbs={crumbs}
        badge={
          <span className="flex gap-2">
            <PoStatusBadge status={po.status} />
            {po.status !== 'DRAFT' && po.status !== 'CANCELLED' && <PaymentStatusBadge status={po.paymentStatus} />}
          </span>
        }
        description={`Ordered ${formatDate(po.orderDate)}${po.expectedDate ? ` · expected ${formatDate(po.expectedDate)}` : ''} · created by ${po.createdBy}`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="ghost" icon={<Printer className="h-4 w-4" />} onClick={printPage}>
              Print
            </Button>
            {po.status === 'DRAFT' && can('purchases.manage') && (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm('delete')}>
                Delete draft
              </Button>
            )}
            {editable && po.status !== 'DRAFT' && can('purchases.manage') && (
              <Button variant="outline" icon={<Ban className="h-4 w-4" />} onClick={() => setConfirm('cancel')}>
                Cancel order
              </Button>
            )}
            {editable && can('purchases.manage') && (
              <Link to={`/purchases/${po.id}/edit`}>
                <Button variant="outline" icon={<Pencil className="h-4 w-4" />}>
                  Edit
                </Button>
              </Link>
            )}
            {po.status === 'DRAFT' && can('purchases.manage') && (
              <Button icon={<Send className="h-4 w-4" />} onClick={() => setConfirm('place')}>
                Place order
              </Button>
            )}
            {outstanding > 0 && can('suppliers.payments') && (
              <Button variant="outline" icon={<Wallet className="h-4 w-4" />} onClick={() => setPaying(true)}>
                Record payment
              </Button>
            )}
            {receivable && can('purchases.receive') && (
              <Button icon={<PackageCheck className="h-4 w-4" />} onClick={() => setReceiving(true)}>
                Receive goods
              </Button>
            )}
          </div>
        }
      />

      {po.status === 'CANCELLED' && <Alert tone="danger" className="mb-6" title="This purchase order was cancelled">No goods will be received against it.</Alert>}
      {po.status === 'DRAFT' && <Alert tone="info" className="mb-6" title="Draft — not yet sent to the supplier">Review quantities and prices, then place the order.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Items"
              description={`${po.items.length} medicines · ${received} of ${ordered} units received`}
              action={
                <div className="flex w-40 items-center gap-2">
                  <ProgressBar value={receivedPct} tone={receivedPct >= 100 ? 'brand' : 'amber'} />
                  <span className="num text-xs text-ink-500">{receivedPct}%</span>
                </div>
              }
            />
            <DataTable columns={columns} rows={po.items} rowKey={(i) => i.id} pageSize={0} dense />
            <div className="ml-auto w-full max-w-sm space-y-2 border-t border-ink-100 px-5 py-4 text-[13px]">
              {(
                [
                  ['Subtotal', po.subtotal],
                  ['Trade discount', -po.discountTotal],
                  ['GST', po.gstTotal],
                  ...po.charges.map((c) => [c.label, c.amount] as [string, number]),
                ] as [string, number][]
              ).map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-ink-500">{l}</span>
                  <span className="num font-medium text-ink-900">{formatINR(v)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-ink-200 pt-2 text-sm">
                <span className="font-semibold text-ink-900">Grand total</span>
                <span className="num font-bold text-ink-950">{formatINR(po.grandTotal)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Goods receipts" description="Batches recorded against this order (GRN)" icon={<PackageCheck className="h-4 w-4" />} />
            {po.receipts.length === 0 ? (
              <EmptyState compact title="Nothing received yet" description={receivable ? 'Use “Receive goods” when the delivery arrives.' : undefined} />
            ) : (
              <div className="space-y-4 px-5 pb-5">
                {[...po.receipts].reverse().map((r) => (
                  <div key={r.id} className="rounded-xl border border-ink-200/80">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-ink-50/60 px-4 py-2.5 text-[13px]">
                      <span className="font-semibold text-ink-900">{r.receiptNumber}</span>
                      <span className="text-ink-500">
                        {formatDateTime(r.date)} · Inv. {r.supplierInvoiceNumber} · {r.receivedBy}
                      </span>
                    </div>
                    <ul className="divide-y divide-ink-100">
                      {r.lines.map((l) => (
                        <li key={l.batchId + l.poItemId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[13px]">
                          <span className="font-medium text-ink-800">{po.items.find((i) => i.id === l.poItemId)?.medicineName}</span>
                          <span className="flex flex-wrap gap-x-4 text-ink-500">
                            <span className="font-mono text-xs">{l.batchNumber}</span>
                            <span>Exp {formatDate(l.expiryDate)}</span>
                            <span className="num font-semibold text-ink-900">+{l.quantity}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Supplier" icon={<Building2 className="h-4 w-4" />} />
            <CardBody className="space-y-3">
              <Link to={`/suppliers/${po.supplierId}`} className="block font-display text-[15px] font-semibold text-ink-900 hover:text-brand-700">
                {po.supplierName}
              </Link>
              {supplier.data && (
                <dl className="grid gap-3">
                  <InfoRow label="Contact" value={<span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-ink-400" />{supplier.data.supplier.contactPerson} · {supplier.data.supplier.phone}</span>} />
                  <InfoRow label="GSTIN" value={<span className="font-mono text-xs">{supplier.data.supplier.gstin}</span>} />
                  <InfoRow label="Payment terms" value={`${supplier.data.supplier.paymentTermsDays} days`} />
                </dl>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Payment" icon={<Wallet className="h-4 w-4" />} />
            <CardBody className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-500">Payable (received goods)</span>
                <span className="num font-medium">{formatINR(payable)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Paid</span>
                <span className="num font-medium text-emerald-700">{formatINR(po.amountPaid)}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-ink-200 pt-3 text-sm">
                <span className="font-semibold">Outstanding</span>
                <span className={`num font-bold ${outstanding > 0 ? 'text-red-600' : 'text-ink-900'}`}>{formatINR(outstanding)}</span>
              </div>
              {payments.length > 0 && (
                <ul className="mt-2 space-y-2 border-t border-ink-100 pt-3">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block font-medium text-ink-800">{p.paymentNumber}</span>
                        <span className="text-xs text-ink-500">
                          {formatDate(p.date)} · {PAYMENT_METHOD_LABEL[p.method]}
                          {p.reference ? ` · ${p.reference}` : ''}
                        </span>
                      </span>
                      <span className="num font-semibold">{formatINR(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {outstanding > 0 && can('suppliers.payments') && (
                <Button variant="subtle" className="mt-2 w-full" icon={<Wallet className="h-4 w-4" />} onClick={() => setPaying(true)}>
                  Record payment
                </Button>
              )}
            </CardBody>
          </Card>
          {po.notes && (
            <Card>
              <CardHeader title="Notes" icon={<FileText className="h-4 w-4" />} />
              <CardBody className="text-[13px] leading-relaxed whitespace-pre-line text-ink-600">{po.notes}</CardBody>
            </Card>
          )}
          <Card padded className="text-xs text-ink-500">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5" /> Created {formatDateTime(po.createdAt)}
            </span>
          </Card>
        </div>
      </div>

      <ReceiveGoodsModal po={po} open={receiving} onClose={() => setReceiving(false)} />
      <RecordPaymentModal open={paying} onClose={() => setPaying(false)} supplierId={po.supplierId} purchaseOrderId={po.id} outstanding={outstanding} title={`Record payment · ${po.poNumber}`} />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void cancel.run()}
        loading={cancel.pending}
        title="Cancel this purchase order?"
        confirmLabel="Cancel order"
        message={`${po.poNumber} to ${po.supplierName} will be marked as cancelled. This cannot be undone.`}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void remove.run()}
        loading={remove.pending}
        title="Delete draft?"
        confirmLabel="Delete draft"
        message="The draft purchase order will be permanently removed."
      />
      <ConfirmDialog
        open={confirm === 'place'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void place.run()}
        loading={place.pending}
        tone="primary"
        title="Place this order?"
        confirmLabel="Place order"
        message={`The order (${formatINR(po.grandTotal)}) will be marked as sent to ${po.supplierName}.`}
      />
    </>
  )
}
