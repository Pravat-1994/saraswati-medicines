import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wallet } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Form'
import { useMutation } from '../../hooks/useQuery'
import { formatINR, sumMoney } from '../../lib/money'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import { supplierService } from '../../services'

const METHODS = ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'CARD', 'OTHER'] as const

function makeSchema(max: number) {
  return z.object({
    amount: z.number({ message: 'Enter an amount' }).positive('Must be greater than zero').max(max + 0.004, `Cannot exceed ${formatINR(max)}`),
    method: z.enum(METHODS),
    reference: z.string().trim().max(60).optional(),
    note: z.string().trim().max(200).optional(),
  })
}
type FormValues = z.infer<ReturnType<typeof makeSchema>>

function PaymentBody({ supplierId, purchaseOrderId, outstanding, onClose }: { supplierId: string; purchaseOrderId?: string; outstanding: number; onClose: () => void }) {
  const { register, handleSubmit, formState, setValue } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(outstanding)),
    defaultValues: { amount: outstanding, method: 'BANK_TRANSFER', reference: '', note: '' },
  })
  const m = useMutation((v: FormValues) => supplierService.recordPayment({ supplierId, purchaseOrderId, amount: v.amount, method: v.method, reference: v.reference || undefined, note: v.note || undefined }), {
    successMessage: (r) => `Payment of ${formatINR(sumMoney(r.map((p) => p.amount)))} recorded.`,
    onSuccess: onClose,
  })
  const e = formState.errors
  return (
    <form onSubmit={handleSubmit((v) => m.run(v))} noValidate className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-red-50/70 px-4 py-3 text-[13px] text-red-900">
        <span>Outstanding {purchaseOrderId ? 'on this order' : 'with supplier'}</span>
        <span className="num font-semibold">{formatINR(outstanding)}</span>
      </div>
      <Field label="Amount" required error={e.amount?.message} hint={purchaseOrderId ? undefined : 'Allocated to the oldest outstanding orders first.'}>
        {(id) => (
          <Input
            id={id}
            type="number"
            step="0.01"
            leading="₹"
            invalid={!!e.amount}
            trailing={
              <button type="button" className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50" onClick={() => setValue('amount', outstanding, { shouldValidate: true })}>
                Full
              </button>
            }
            {...register('amount', { valueAsNumber: true })}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Method" required>
          {(id) => <Select id={id} options={METHODS.map((v) => ({ value: v, label: PAYMENT_METHOD_LABEL[v] }))} {...register('method')} />}
        </Field>
        <Field label="Reference" hint="UTR / cheque no.">
          {(id) => <Input id={id} {...register('reference')} />}
        </Field>
      </div>
      <Field label="Note">
        {(id) => <Input id={id} {...register('note')} />}
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose} disabled={m.pending}>
          Cancel
        </Button>
        <Button type="submit" loading={m.pending} icon={<Wallet className="h-4 w-4" />}>
          Record payment
        </Button>
      </div>
    </form>
  )
}

export function RecordPaymentModal({ open, onClose, supplierId, purchaseOrderId, outstanding, title = 'Record supplier payment' }: { open: boolean; onClose: () => void; supplierId: string; purchaseOrderId?: string; outstanding: number; title?: string }) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title={title} icon={<Wallet className="h-4 w-4" />}>
      {open && <PaymentBody supplierId={supplierId} purchaseOrderId={purchaseOrderId} outstanding={outstanding} onClose={onClose} />}
    </Modal>
  )
}
