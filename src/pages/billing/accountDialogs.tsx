import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { HandCoins, Percent, Plus } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { clinicSettingsService, patientBillingService } from '../../services'
import { CHARGE_CATEGORY_LABEL } from '../../lib/clinic'
import { formatINR, round2 } from '../../lib/money'
import { useSessionStore } from '../../stores/sessionStore'
import type { ChargeCategory, PatientPayment } from '../../types/clinic'
import type { AccountView } from '../../types/clinicApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'
import { PATIENT_PAYMENT_METHOD_LABEL, PAYMENT_KIND_LABEL } from './labels'

const CATEGORIES = Object.keys(CHARGE_CATEGORY_LABEL) as ChargeCategory[]

const chargeSchema = z.object({
  code: z.string(),
  category: z.enum(['ADMISSION', 'ROOM', 'BED', 'CONSULTATION', 'TREATMENT', 'MEDICINE', 'SERVICE']),
  description: z.string().trim().min(2, 'Describe the charge').max(160),
  quantity: z.number({ message: 'Enter a quantity' }).positive('Must be more than zero').max(1000),
  rate: z.number({ message: 'Enter a rate' }).min(0, 'Cannot be negative').max(1_000_000),
  taxRate: z.number({ message: 'Enter a tax rate' }).min(0).max(28, 'Max 28%'),
})
type ChargeForm = z.infer<typeof chargeSchema>

export function AddChargeDialog({ account, onClose }: { account: AccountView; onClose: () => void }) {
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const catalog = settings.data?.serviceCatalog ?? []
  const { register, handleSubmit, setValue, control, formState } = useForm<ChargeForm>({ resolver: zodResolver(chargeSchema), defaultValues: { code: '', category: 'SERVICE', description: '', quantity: 1, rate: 0, taxRate: 0 } })
  const [q, r, t] = useWatch({ control, name: ['quantity', 'rate', 'taxRate'] })
  const amount = Number.isFinite(q * r) ? round2(q * r) : 0
  const tax = Number.isFinite(t) ? round2((amount * t) / 100) : 0
  const save = useMutation((v: ChargeForm) => patientBillingService.addCharge(account.id, { category: v.category, description: v.description, quantity: v.quantity, rate: v.rate, taxRate: v.taxRate }), { successMessage: 'Charge added', onSuccess: onClose })
  const e = formState.errors
  const num = { valueAsNumber: true } as const
  return (
    <Modal
      open
      onClose={onClose}
      title="Add charge"
      description={`${account.accountNo} · ${account.patientName}`}
      icon={<Plus className="h-4 w-4" />}
      dismissible={!save.pending}
      footer={
        <>
          <div className="mr-auto text-sm">
            Total <span className="num font-semibold text-ink-950">{formatINR(amount + tax)}</span>
          </div>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit((v) => save.run(v))} loading={save.pending}>
            Add charge
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit((v) => save.run(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="From tariff" className="sm:col-span-2" hint="Pick a service from the clinic tariff, or enter a custom charge">
          {(id) => (
            <Select
              id={id}
              options={[{ value: '', label: 'Custom charge' }, ...catalog.map((c) => ({ value: c.code, label: `${c.name} — ${formatINR(c.rate)}` }))]}
              {...register('code', {
                onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => {
                  const c = catalog.find((x) => x.code === ev.target.value)
                  if (!c) return
                  setValue('category', c.category)
                  setValue('description', c.name, { shouldValidate: true })
                  setValue('rate', c.rate, { shouldValidate: true })
                  setValue('taxRate', c.taxRate)
                },
              })}
            />
          )}
        </Field>
        <Field label="Category" required>
          {(id) => <Select id={id} options={CATEGORIES.map((c) => ({ value: c, label: CHARGE_CATEGORY_LABEL[c] }))} {...register('category')} />}
        </Field>
        <Field label="Description" required error={e.description?.message}>
          {(id) => <Input id={id} invalid={!!e.description} {...register('description')} />}
        </Field>
        <Field label="Quantity" required error={e.quantity?.message}>
          {(id) => <Input id={id} type="number" min={0} step="1" invalid={!!e.quantity} {...register('quantity', num)} />}
        </Field>
        <Field label="Rate (₹)" required error={e.rate?.message}>
          {(id) => <Input id={id} type="number" min={0} step="0.01" leading="₹" invalid={!!e.rate} {...register('rate', num)} />}
        </Field>
        <Field label="Tax (%)" error={e.taxRate?.message} hint="Most clinical services are GST-exempt — confirm with your accountant">
          {(id) => <Input id={id} type="number" min={0} max={28} step="0.5" invalid={!!e.taxRate} {...register('taxRate', num)} />}
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

export function DiscountDialog({ account, onClose }: { account: AccountView; onClose: () => void }) {
  const maxPct = useSessionStore((s) => s.role?.maxDiscountPct ?? 0)
  const gross = round2(account.totals.charges + account.totals.tax)
  const [amount, setAmount] = useState(String(account.discount || ''))
  const [error, setError] = useState<string>()
  const save = useMutation((v: number) => patientBillingService.setDiscount(account.id, v), { successMessage: 'Discount applied', onSuccess: onClose })
  const submit = () => {
    const v = Number(amount || 0)
    if (!Number.isFinite(v) || v < 0) return setError('Enter a valid amount')
    if (v > gross) return setError('Discount cannot exceed the bill amount')
    setError(undefined)
    void save.run(round2(v))
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Apply discount"
      icon={<Percent className="h-4 w-4" />}
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.pending}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Discount amount (₹)" error={error} hint={`Bill before discount ${formatINR(gross)} · your role may discount up to ${maxPct}%`}>
          {(id) => <Input id={id} type="number" min={0} step="0.01" leading="₹" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!error} />}
        </Field>
        {gross > 0 && Number(amount) > 0 && <p className="text-xs text-ink-500">That is {((Number(amount) / gross) * 100).toFixed(1)}% of the bill.</p>}
      </div>
    </Modal>
  )
}

const payKinds: PatientPayment['kind'][] = ['ADVANCE', 'PARTIAL', 'FINAL', 'REFUND']
const payMethods: PatientPayment['method'][] = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'INSURANCE', 'OTHER']

export function PaymentDialog({ account, onClose }: { account: AccountView; onClose: () => void }) {
  const bal = account.totals.balance
  const [kind, setKind] = useState<PatientPayment['kind']>(bal < -0.005 ? 'REFUND' : account.status === 'OPEN' && account.admissionId ? 'ADVANCE' : 'FINAL')
  const [amount, setAmount] = useState(bal > 0 ? bal.toFixed(2) : bal < 0 ? (-bal).toFixed(2) : '')
  const [method, setMethod] = useState<PatientPayment['method']>('UPI')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string>()
  const save = useMutation((amt: number) => patientBillingService.recordPayment(account.id, { amount: amt, kind, method, reference: reference.trim() || undefined }), {
    successMessage: kind === 'REFUND' ? 'Refund recorded' : 'Payment recorded',
    onSuccess: onClose,
  })
  const submit = () => {
    const v = Number(amount)
    if (!Number.isFinite(v) || v <= 0) return setError('Enter an amount greater than zero')
    if (kind === 'REFUND' && v > -bal + 0.005) return setError(`Refund cannot exceed the excess paid (${formatINR(Math.max(0, -bal))})`)
    if ((kind === 'PARTIAL' || kind === 'FINAL') && v > bal + 0.005) return setError(`Exceeds the balance of ${formatINR(Math.max(0, bal))} — record extra as an advance`)
    if (method !== 'CASH' && !reference.trim()) return setError('Enter a transaction / claim reference for non-cash payments')
    setError(undefined)
    void save.run(round2(v))
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Record payment"
      description={`Balance ${formatINR(bal)}`}
      icon={<HandCoins className="h-4 w-4" />}
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.pending}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type">{(id) => <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as PatientPayment['kind'])} options={payKinds.map((k) => ({ value: k, label: PAYMENT_KIND_LABEL[k] }))} />}</Field>
        <Field label="Amount (₹)" required error={error}>
          {(id) => <Input id={id} type="number" min={0} step="0.01" leading="₹" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={!!error} />}
        </Field>
        <Field label="Method">{(id) => <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PatientPayment['method'])} options={payMethods.map((m) => ({ value: m, label: PATIENT_PAYMENT_METHOD_LABEL[m] }))} />}</Field>
        <Field label="Reference" hint={method === 'INSURANCE' ? 'Insurer / TPA claim number' : 'UTR, card approval code or cheque no.'}>
          {(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} />}
        </Field>
        {kind === 'ADVANCE' && <Alert tone="info">Advances are adjusted against the final bill.</Alert>}
      </div>
    </Modal>
  )
}
