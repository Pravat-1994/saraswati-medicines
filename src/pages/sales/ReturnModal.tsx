import { useMemo, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { salesService } from '../../services'
import { formatINR, sumMoney } from '../../lib/money'
import { refundForQuantity } from '../../lib/pricing'
import { isExpired } from '../../lib/inventory'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import { useCan } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import type { PaymentMethod, Sale, SaleReturn } from '../../types/domain'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Select, Textarea } from '../../components/ui/Form'
import { Alert, Skeleton } from '../../components/ui/Feedback'

const REASONS = ['Doctor changed prescription', 'Duplicate purchase', 'Wrong medicine / strength dispensed', 'Adverse reaction reported', 'Damaged packaging at sale', 'Other']

export function ReturnModal({ sale, open, onClose, onDone }: { sale: Sale; open: boolean; onClose: () => void; onDone?: (r: SaleReturn) => void }) {
  const can = useCan()
  const settings = useSettings()
  const returnable = useQuery(() => salesService.returnableLines(sale.id), [sale.id, open], { enabled: open, tags: ['sales'] })
  const [qty, setQty] = useState<Record<string, number>>({})
  const [restock, setRestock] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState(REASONS[0])
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState<PaymentMethod>(sale.paymentMethod)
  const [touched, setTouched] = useState(false)

  const max = useMemo(() => new Map((returnable.data ?? []).map((r) => [r.lineId, r.returnable])), [returnable.data])
  const refund = sumMoney(sale.items.map((i) => refundForQuantity(i.lineTotal, i.quantity, qty[i.lineId] ?? 0)))
  const selected = Object.values(qty).some((v) => v > 0)
  const fullReason = reason === 'Other' ? detail.trim() : detail.trim() ? `${reason} — ${detail.trim()}` : reason
  const needsApproval = !can('returns.approve') && !(settings.returnApprovalThreshold > 0 && refund <= settings.returnApprovalThreshold)

  const submit = useMutation(() => salesService.requestReturn({ saleId: sale.id, lines: sale.items.map((i) => ({ lineId: i.lineId, quantity: qty[i.lineId] ?? 0, restock: restock[i.lineId] ?? true })), refundMethod: method, reason: fullReason }), {
    successMessage: (r) => (r.status === 'APPROVED' ? `Return ${r.returnNumber} approved — refund ${formatINR(r.totalRefund)}` : `Return ${r.returnNumber} submitted for approval`),
    onSuccess: (r) => {
      setQty({})
      onDone?.(r)
      onClose()
    },
  })

  const invalidReason = reason === 'Other' && !detail.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submit.pending}
      size="lg"
      icon={<Undo2 className="h-4 w-4" />}
      title={`Return items · ${sale.invoiceNumber}`}
      description={`${sale.customerName} · original payment ${PAYMENT_METHOD_LABEL[sale.paymentMethod]}`}
      footer={
        <>
          <div className="mr-auto text-sm">
            Refund <span className="num font-display text-lg font-bold text-ink-950">{formatINR(refund)}</span>
          </div>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (selected && !invalidReason) void submit.run()
            }}
            loading={submit.pending}
            disabled={!selected}
          >
            {needsApproval ? 'Submit for approval' : 'Process return'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {needsApproval ? (
          <Alert tone="info" title="Approval required">
            Returns above {formatINR(settings.returnApprovalThreshold)} by your role go to a Store Manager or Administrator. Stock and refund are applied once approved.
          </Alert>
        ) : (
          <Alert tone="success">This return will be applied immediately. Restocked units go back to their original batch.</Alert>
        )}
        <div className="overflow-hidden rounded-xl border border-ink-200">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 text-left text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2 text-center">Return qty</th>
                <th className="px-3 py-2 text-center">Restock</th>
                <th className="px-3 py-2 text-right">Refund</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((i) => {
                const m = max.get(i.lineId)
                const expired = isExpired({ expiryDate: i.expiryDate })
                return (
                  <tr key={i.lineId} className="border-t border-ink-100">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ink-900">{i.medicineName}</div>
                      <div className="font-mono text-[11px] text-ink-500">Batch {i.batchNumber}</div>
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      {i.quantity}
                      {i.returnedQuantity > 0 && <div className="text-[11px] text-amber-700">{i.returnedQuantity} returned</div>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {returnable.loading ? (
                        <Skeleton className="mx-auto h-8 w-16" />
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={m ?? 0}
                          disabled={!m}
                          value={qty[i.lineId] ?? ''}
                          placeholder="0"
                          onChange={(e) => setQty((q) => ({ ...q, [i.lineId]: Math.max(0, Math.min(m ?? 0, Math.floor(Number(e.target.value)) || 0)) }))}
                          aria-label={`Return quantity for ${i.medicineName}`}
                          className="num h-8 w-16 rounded-lg border border-ink-200 text-center focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none disabled:bg-ink-50"
                        />
                      )}
                      <div className="mt-0.5 text-[10px] text-ink-400">max {m ?? '…'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        disabled={expired}
                        title={expired ? 'Batch has expired — cannot be restocked' : 'Return units to sellable stock'}
                        checked={!expired && (restock[i.lineId] ?? true)}
                        onChange={(e) => setRestock((r) => ({ ...r, [i.lineId]: e.target.checked }))}
                        aria-label={`Restock ${i.medicineName}`}
                        className="h-4 w-4 accent-brand-600"
                      />
                    </td>
                    <td className="num px-3 py-2.5 text-right font-medium">{formatINR(refundForQuantity(i.lineTotal, i.quantity, qty[i.lineId] ?? 0))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {touched && !selected && <p className="text-xs font-medium text-red-600">Enter a return quantity for at least one item.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reason" required>
            {(id) => <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)} options={REASONS.map((r) => ({ value: r, label: r }))} />}
          </Field>
          <Field label="Refund method" required>
            {(id) => <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={(['CASH', 'UPI', 'CARD', 'OTHER'] as const).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />}
          </Field>
          <Field label="Details" className="sm:col-span-2" error={touched && invalidReason ? 'Describe the reason for this return' : undefined} required={reason === 'Other'}>
            {(id) => <Textarea id={id} rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Additional details for the audit trail" invalid={touched && invalidReason} />}
          </Field>
        </div>
      </div>
    </Modal>
  )
}
