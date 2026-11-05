import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wallet } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'
import { useMutation } from '../../hooks/useQuery'
import { supplierService } from '../../services'
import { formatINR, round2 } from '../../lib/money'

const METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer (NEFT/RTGS/IMPS)' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
] as const

export interface RecordPaymentModalProps {
  open: boolean
  onClose: () => void
  supplierId: string
  supplierName: string
  outstanding: number
}

export function RecordPaymentModal(props: RecordPaymentModalProps) {
  if (!props.open) return null
  return <PaymentForm {...props} />
}

function PaymentForm({ onClose, supplierId, supplierName, outstanding }: RecordPaymentModalProps) {
  const schema = z.object({
    amount: z
      .number({ message: 'Enter an amount' })
      .positive('Amount must be greater than zero')
      .max(round2(outstanding), `Cannot exceed outstanding ${formatINR(outstanding)}`),
    method: z.enum(['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH']),
    reference: z.string().trim().max(60),
    note: z.string().trim().max(200),
  }).superRefine((v, ctx) => {
    if (v.method !== 'CASH' && !v.reference) ctx.addIssue({ code: 'custom', path: ['reference'], message: 'Reference (UTR / cheque no.) is required for non-cash payments' })
  })
  type FormValues = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { amount: round2(outstanding), method: 'BANK_TRANSFER', reference: '', note: '' } })

  const pay = useMutation(
    (v: FormValues) => supplierService.recordPayment({ supplierId, amount: round2(v.amount), method: v.method, reference: v.reference || undefined, note: v.note || undefined }),
    {
      successMessage: (r) => `Payment recorded against ${r.length} purchase order${r.length === 1 ? '' : 's'}`,
      onSuccess: onClose,
    },
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!pay.pending}
      icon={<Wallet className="h-4 w-4" />}
      title="Record supplier payment"
      description={supplierName}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pay.pending}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" loading={pay.pending}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="payment-form" noValidate onSubmit={handleSubmit((v) => void pay.run(v))} className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-ink-200/70 bg-ink-50/60 px-4 py-3">
          <span className="text-[13px] text-ink-500">Outstanding balance</span>
          <span className="num font-display text-lg font-bold text-ink-950">{formatINR(outstanding)}</span>
        </div>
        <Field label="Amount (₹)" required error={errors.amount?.message}>
          {(id, d) => (
            <div className="flex gap-2">
              <Input id={id} aria-describedby={d} invalid={!!errors.amount} type="number" step="0.01" min={0} className="flex-1" {...register('amount', { valueAsNumber: true })} />
              <Button variant="outline" onClick={() => setValue('amount', round2(outstanding), { shouldValidate: true })}>
                Full
              </Button>
            </div>
          )}
        </Field>
        <Field label="Payment method" required>
          {(id) => <Select id={id} options={METHODS.map((m) => ({ value: m.value, label: m.label }))} {...register('method')} />}
        </Field>
        <Field label="Reference" error={errors.reference?.message} hint="UTR, UPI transaction id or cheque number">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.reference} {...register('reference')} />}
        </Field>
        <Field label="Note" error={errors.note?.message}>
          {(id) => <Textarea id={id} rows={2} {...register('note')} />}
        </Field>
        <Alert tone="info">The amount is allocated to the oldest outstanding purchase orders first.</Alert>
      </form>
    </Modal>
  )
}
