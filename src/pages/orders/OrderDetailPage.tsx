import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Ban, CheckCircle2, FileCheck2, FileText, MapPin, PackageCheck, Phone, ReceiptText, Store, Truck, User } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { onlineOrderService } from '../../services'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { ORDER_STATUS_LABEL, PAYMENT_PREFERENCE_LABEL } from '../../lib/orders'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import { useCan } from '../../stores/sessionStore'
import type { OnlineOrder, PaymentMethod } from '../../types/domain'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { OrderStatusBadge } from './OrderStatusBadge'

const defaultMethod = (o: OnlineOrder): PaymentMethod => (o.paymentPreference === 'UPI_ON_DELIVERY' ? 'UPI' : 'CASH')

export default function OrderDetailPage() {
  const { id } = useParams()
  const can = useCan()
  const q = useQuery(() => onlineOrderService.get(id!), [id], { tags: ['sales', 'inventory'] })
  const [dialog, setDialog] = useState<'complete' | 'cancel' | 'verify' | null>(null)
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [tendered, setTendered] = useState('')
  const close = () => setDialog(null)
  const openDialog = (d: 'cancel' | 'verify') => {
    setReason('')
    setDialog(d)
  }

  const verify = useMutation((note: string) => onlineOrderService.verifyPrescription(id!, note || undefined), { successMessage: 'Prescription verified', onSuccess: close })
  const confirm = useMutation(() => onlineOrderService.confirm(id!), { successMessage: 'Order confirmed — stock reserved' })
  const advance = useMutation((s: 'READY' | 'OUT_FOR_DELIVERY') => onlineOrderService.advance(id!, s), { successMessage: (o) => `Marked as ${ORDER_STATUS_LABEL[o.status].toLowerCase()}` })
  const complete = useMutation(
    () => onlineOrderService.complete({ orderId: id!, paymentMethod: method, paymentReference: reference || undefined, amountTendered: method === 'CASH' && tendered ? Number(tendered) : undefined }),
    { successMessage: (o) => `Order completed — invoice ${o.invoiceNumber}`, onSuccess: close },
  )
  const cancel = useMutation(() => onlineOrderService.cancel(id!, reason), { successMessage: 'Order cancelled — reserved stock released', onSuccess: close })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const { order: o, availability, customer } = q.data
  const open = !['COMPLETED', 'CANCELLED'].includes(o.status)
  const reserved = o.items.some((i) => i.allocations.length > 0)
  const rxPending = o.prescriptionRequired && !o.prescriptionVerified
  const shortages = o.status === 'PLACED' ? o.items.filter((i) => (availability[i.medicineId] ?? 0) < i.quantity) : []
  const manage = can('orders.manage')

  return (
    <div>
      <PageHeader
        title={o.orderNumber}
        badge={<OrderStatusBadge status={o.status} />}
        description={`Placed ${formatDateTime(o.placedAt)} by ${o.customerName} · ${o.fulfilment === 'DELIVERY' ? 'Home delivery' : 'Store pickup'}`}
        breadcrumbs={[{ label: 'Online orders', to: '/orders' }, { label: o.orderNumber }]}
        actions={
          <>
            {manage && open && (
              <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => openDialog('cancel')}>
                Cancel order
              </Button>
            )}
            {o.prescriptionRequired && !o.prescriptionVerified && open && can('orders.verifyRx') && (
              <Button variant="outline" icon={<FileCheck2 className="h-4 w-4" />} onClick={() => openDialog('verify')}>
                Verify prescription
              </Button>
            )}
            {manage && o.status === 'PLACED' && (
              <Button icon={<PackageCheck className="h-4 w-4" />} disabled={rxPending || shortages.length > 0} loading={confirm.pending} onClick={() => confirm.run()}>
                Confirm & reserve stock
              </Button>
            )}
            {manage && o.status === 'CONFIRMED' && (
              <Button variant="outline" icon={o.fulfilment === 'DELIVERY' ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />} loading={advance.pending} onClick={() => advance.run(o.fulfilment === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY')}>
                {o.fulfilment === 'DELIVERY' ? 'Out for delivery' : 'Ready for pickup'}
              </Button>
            )}
            {manage && ['CONFIRMED', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status) && (
              <Button
                icon={<CheckCircle2 className="h-4 w-4" />}
                onClick={() => {
                  setMethod(defaultMethod(o))
                  setReference('')
                  setTendered('')
                  setDialog('complete')
                }}
              >
                Complete & invoice
              </Button>
            )}
            {o.saleId && (
              <Link to={`/sales/${o.saleId}`}>
                <Button icon={<ReceiptText className="h-4 w-4" />}>View invoice {o.invoiceNumber}</Button>
              </Link>
            )}
          </>
        }
      />

      {rxPending && open && (
        <Alert tone="info" className="mb-4" icon={<FileText className="h-4 w-4" />} title="Prescription needs verification">
          A pharmacist must check the prescription before this order can be confirmed.
        </Alert>
      )}
      {shortages.length > 0 && (
        <Alert tone="warning" className="mb-4" title="Not enough stock to confirm">
          {shortages.map((s) => `${s.medicineName} (${availability[s.medicineId] ?? 0} of ${s.quantity} available)`).join(', ')}. Call the customer to change the order, or cancel it.
        </Alert>
      )}
      {o.status === 'CANCELLED' && (
        <Alert tone="danger" className="mb-4" title="Cancelled">
          {o.cancelReason}
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Items" description={o.status === 'COMPLETED' ? 'Dispensed from these batches and billed on the invoice.' : reserved ? 'Stock reserved from these batches (FEFO). Reserved units cannot be sold at the counter.' : o.status === 'PLACED' ? 'Stock is reserved when you confirm the order.' : undefined} />
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-y border-ink-100 bg-ink-50/80 text-left text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                    <th className="px-5 py-2">Medicine</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">{o.status === 'COMPLETED' ? 'Batches' : reserved ? 'Reserved batches' : 'In stock now'}</th>
                    <th className="px-3 py-2 text-right">MRP</th>
                    <th className="px-5 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.lineId} className="border-b border-ink-100 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/medicines/${i.medicineId}`} className="font-medium text-ink-900 hover:text-brand-700">
                            {i.medicineName}
                          </Link>
                          {i.prescriptionRequired && <Badge tone="violet" className="px-1.5 py-0 text-[10px]">Rx</Badge>}
                        </div>
                        <div className="text-xs text-ink-500">{i.packSize}</div>
                      </td>
                      <td className="num px-3 py-3 text-right font-semibold">{i.quantity}</td>
                      <td className="px-3 py-3">
                        {i.allocations.length > 0 ? (
                          <div className="space-y-0.5">
                            {i.allocations.map((a) => (
                              <div key={a.batchId} className="font-mono text-xs text-ink-700">
                                {a.batchNumber} × {a.quantity} <span className="font-sans text-ink-400">· exp {formatDate(a.expiryDate)}</span>
                              </div>
                            ))}
                          </div>
                        ) : open ? (
                          <span className={(availability[i.medicineId] ?? 0) >= i.quantity ? 'text-emerald-700' : 'font-semibold text-red-600'}>{availability[i.medicineId] ?? 0} available</span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="num px-3 py-3 text-right">{formatINR(i.unitPrice)}</td>
                      <td className="num px-5 py-3 text-right font-semibold">{formatINR(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ink-200">
                    <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold">Estimated total</td>
                    <td className="num px-5 py-3 text-right text-base font-bold">{formatINR(o.estimatedTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-ink-200 pl-5">
                {[...o.timeline].reverse().map((e, idx) => (
                  <li key={`${e.at}-${idx}`} className="relative">
                    <span className="absolute top-1 -left-[26px] h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
                    <div className="text-[13px] font-medium text-ink-900">{e.status === 'RX_VERIFIED' ? 'Prescription verified' : e.status === 'NOTE' ? 'Note' : ORDER_STATUS_LABEL[e.status]}</div>
                    <div className="text-xs text-ink-500">
                      {formatDateTime(e.at)} · {e.by}
                      {e.note ? ` — ${e.note}` : ''}
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Customer" icon={<User className="h-4 w-4" />} />
            <CardBody className="space-y-3 text-[13px]">
              <div>
                <div className="font-semibold text-ink-900">{customer ? <Link to={`/customers/${customer.id}`} className="hover:text-brand-700">{o.customerName}</Link> : o.customerName}</div>
                {!customer && <div className="text-xs text-ink-500">New customer — saved to the directory when the order is completed.</div>}
              </div>
              <a href={`tel:${o.customerPhone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-brand-700 hover:underline">
                <Phone className="h-4 w-4" /> {o.customerPhone}
              </a>
              {o.customerEmail && <div className="text-ink-600">{o.customerEmail}</div>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={o.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'} icon={o.fulfilment === 'DELIVERY' ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />} />
            <CardBody>
              <dl className="grid gap-3">
                {o.deliveryAddress && <InfoRow label="Address" value={<span className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />{o.deliveryAddress}</span>} />}
                <InfoRow label="Preferred time" value={o.preferredSlot} />
                <InfoRow label="Payment" value={PAYMENT_PREFERENCE_LABEL[o.paymentPreference]} />
                {o.customerNote && <InfoRow label="Customer note" value={o.customerNote} />}
              </dl>
            </CardBody>
          </Card>
          {o.prescriptionRequired && (
            <Card>
              <CardHeader title="Prescription" icon={<FileText className="h-4 w-4" />} action={<Badge tone={o.prescriptionVerified ? 'success' : 'violet'}>{o.prescriptionVerified ? 'Verified' : 'Not verified'}</Badge>} />
              <CardBody>
                <dl className="grid gap-3">
                  <InfoRow label="Prescription no." value={o.prescriptionRef} />
                  <InfoRow label="Doctor" value={o.doctorName} />
                  <InfoRow label="Attachment" value={o.prescriptionFileName ? `${o.prescriptionFileName} (stored in Decisions once integrated)` : undefined} />
                  {o.prescriptionVerifiedBy && <InfoRow label="Verified by" value={o.prescriptionVerifiedBy} />}
                </dl>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={dialog === 'verify'}
        onClose={close}
        size="sm"
        title="Verify prescription"
        description="Confirm the prescription is valid for the Rx medicines in this order."
        footer={
          <>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button loading={verify.pending} onClick={() => verify.run(reason)}>Mark as verified</Button>
          </>
        }
      >
        <Field label="Note (optional)">{(fid) => <Textarea id={fid} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Checked original at the counter" />}</Field>
      </Modal>

      <Modal
        open={dialog === 'cancel'}
        onClose={close}
        size="sm"
        title={`Cancel ${o.orderNumber}?`}
        description={reserved ? 'Reserved stock will be released back to available stock.' : undefined}
        footer={
          <>
            <Button variant="outline" onClick={close}>Keep order</Button>
            <Button variant="danger" disabled={!reason.trim()} loading={cancel.pending} onClick={() => cancel.run()}>Cancel order</Button>
          </>
        }
      >
        <Field label="Reason" required hint="Shown to the customer when they track the order">
          {(fid) => <Textarea id={fid} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer requested cancellation" />}
        </Field>
      </Modal>

      <Modal
        open={dialog === 'complete'}
        onClose={close}
        dismissible={!complete.pending}
        size="sm"
        title="Complete order & create invoice"
        description={`Hand over to ${o.customerName}. The reserved stock becomes a sale.`}
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={complete.pending}>Cancel</Button>
            <Button loading={complete.pending} onClick={() => complete.run()}>Complete · {formatINR(o.estimatedTotal)}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Payment received by">
            {(fid) => <Select id={fid} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={(['CASH', 'UPI', 'CARD', 'OTHER'] as const).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />}
          </Field>
          {method === 'CASH' ? (
            <Field label="Cash received (optional)" hint="Must cover the invoice total">
              {(fid) => <Input id={fid} type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} leading="₹" />}
            </Field>
          ) : (
            <Field label="Payment reference (optional)">{(fid) => <Input id={fid} value={reference} onChange={(e) => setReference(e.target.value)} />}</Field>
          )}
          <p className="text-xs text-ink-500">The invoice is priced from the reserved batches using the store’s GST settings; it can differ slightly from the estimate if batch prices differ.</p>
        </div>
      </Modal>
    </div>
  )
}
