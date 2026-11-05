import { useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PackageCheck } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { todayISO } from '../../lib/dates'
import { medicineService, purchaseService } from '../../services'
import { PO_STATUS_LABEL } from '../../lib/purchases'
import type { PurchaseOrder } from '../../types/domain'

const lineSchema = z.object({
  poItemId: z.string(),
  medicineName: z.string(),
  pending: z.number(),
  batchNumber: z.string().trim(),
  mfgDate: z.string(),
  expiryDate: z.string(),
  quantity: z.number({ message: 'Required' }).int('Whole units').min(0, '≥ 0'),
  sellingPrice: z.number({ message: 'Required' }).positive('> 0'),
})

const schema = z
  .object({
    supplierInvoiceNumber: z.string().trim().min(1, 'Supplier invoice number is required').max(40),
    lines: z.array(lineSchema),
  })
  .superRefine((v, ctx) => {
    const today = todayISO()
    if (!v.lines.some((l) => l.quantity > 0)) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Enter a received quantity for at least one item.' })
    v.lines.forEach((l, i) => {
      if (l.quantity <= 0) return
      if (l.quantity > l.pending) ctx.addIssue({ code: 'custom', path: ['lines', i, 'quantity'], message: `Max ${l.pending}` })
      if (l.batchNumber.length < 2) ctx.addIssue({ code: 'custom', path: ['lines', i, 'batchNumber'], message: 'Batch no. required' })
      if (!l.mfgDate) ctx.addIssue({ code: 'custom', path: ['lines', i, 'mfgDate'], message: 'Required' })
      else if (l.mfgDate > today) ctx.addIssue({ code: 'custom', path: ['lines', i, 'mfgDate'], message: 'In the future' })
      if (!l.expiryDate) ctx.addIssue({ code: 'custom', path: ['lines', i, 'expiryDate'], message: 'Required' })
      else if (l.expiryDate < today) ctx.addIssue({ code: 'custom', path: ['lines', i, 'expiryDate'], message: 'Already expired' })
      else if (l.mfgDate && l.expiryDate <= l.mfgDate) ctx.addIssue({ code: 'custom', path: ['lines', i, 'expiryDate'], message: 'Must be after mfg date' })
    })
  })
type FormValues = z.infer<typeof schema>

function ReceiveBody({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const meds = useQuery(() => medicineService.list({ pageSize: 2000 }), [], { tags: ['medicines'] })
  const priceOf = useMemo(() => new Map((meds.data?.items ?? []).map((m) => [m.id, m.sellingPrice])), [meds.data])
  const values = useMemo<FormValues>(() => ({
      supplierInvoiceNumber: po.supplierInvoiceNumber ?? '',
      lines: po.items.filter((i) => i.orderedQty + i.freeQty - i.receivedQty > 0).map((i) => ({
        poItemId: i.id,
        medicineName: i.medicineName,
        pending: i.orderedQty + i.freeQty - i.receivedQty,
        batchNumber: '',
        mfgDate: '',
        expiryDate: '',
        quantity: i.orderedQty + i.freeQty - i.receivedQty,
        sellingPrice: priceOf.get(i.medicineId) ?? Math.round(i.purchasePrice * 1.35 * 100) / 100,
      })),
  }), [po, priceOf])
  const { register, control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const lines = useFieldArray({ control, name: 'lines' })
  const m = useMutation(
    (v: FormValues) =>
      purchaseService.receive({
        purchaseOrderId: po.id,
        supplierInvoiceNumber: v.supplierInvoiceNumber,
        lines: v.lines.filter((l) => l.quantity > 0).map((l) => ({ poItemId: l.poItemId, batchNumber: l.batchNumber, mfgDate: l.mfgDate, expiryDate: l.expiryDate, quantity: l.quantity, sellingPrice: l.sellingPrice })),
      }),
    { successMessage: (r) => `Goods received — ${r.poNumber} is now ${PO_STATUS_LABEL[r.status].toLowerCase()}.`, onSuccess: onClose },
  )
  const e = formState.errors

  return (
    <form id="receive-form" onSubmit={handleSubmit((v) => m.run(v))} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier invoice number" required error={e.supplierInvoiceNumber?.message}>
          {(id) => <Input id={id} placeholder="e.g. KPD/4821" invalid={!!e.supplierInvoiceNumber} {...register('supplierInvoiceNumber')} />}
        </Field>
        <Alert tone="info" className="self-end">Set quantity to 0 for items not delivered. Each received line creates (or tops up) a batch.</Alert>
      </div>
      {e.lines?.message && <p className="text-xs font-medium text-red-600">{e.lines.message}</p>}
      {e.lines?.root?.message && <p className="text-xs font-medium text-red-600">{e.lines.root.message}</p>}
      <ul className="space-y-3">
        {lines.fields.map((f, i) => {
          const le = e.lines?.[i]
          return (
            <li key={f.id} className="rounded-xl border border-ink-200/80 p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-ink-900">{f.medicineName}</span>
                <span className="num text-xs text-ink-500">{f.pending} pending</span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Field label="Batch no." error={le?.batchNumber?.message}>
                  {(id) => <Input id={id} inputSize="sm" className="uppercase" invalid={!!le?.batchNumber} {...register(`lines.${i}.batchNumber`)} />}
                </Field>
                <Field label="Mfg date" error={le?.mfgDate?.message}>
                  {(id) => <Input id={id} inputSize="sm" type="date" invalid={!!le?.mfgDate} {...register(`lines.${i}.mfgDate`)} />}
                </Field>
                <Field label="Expiry date" error={le?.expiryDate?.message}>
                  {(id) => <Input id={id} inputSize="sm" type="date" invalid={!!le?.expiryDate} {...register(`lines.${i}.expiryDate`)} />}
                </Field>
                <Field label="Qty received" error={le?.quantity?.message}>
                  {(id) => <Input id={id} inputSize="sm" type="number" min={0} max={f.pending} className="text-right" invalid={!!le?.quantity} {...register(`lines.${i}.quantity`, { valueAsNumber: true })} />}
                </Field>
                <Field label="MRP / unit (₹)" error={le?.sellingPrice?.message}>
                  {(id) => <Input id={id} inputSize="sm" type="number" step="0.01" className="text-right" invalid={!!le?.sellingPrice} {...register(`lines.${i}.sellingPrice`, { valueAsNumber: true })} />}
                </Field>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="outline" onClick={onClose} disabled={m.pending}>
          Cancel
        </Button>
        <Button type="submit" loading={m.pending} icon={<PackageCheck className="h-4 w-4" />}>
          Confirm receipt
        </Button>
      </div>
    </form>
  )
}

export function ReceiveGoodsModal({ po, open, onClose }: { po: PurchaseOrder; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="xl" title={`Receive goods · ${po.poNumber}`} description={`${po.supplierName} — record batch details exactly as printed on the supplier invoice.`} icon={<PackageCheck className="h-4 w-4" />}>
      {open && <ReceiveBody po={po} onClose={onClose} />}
    </Modal>
  )
}
