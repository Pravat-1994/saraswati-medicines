import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRightLeft, PackagePlus, SlidersHorizontal, ShieldCheck } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'
import { ExpiryBadge } from '../../components/ui/Badge'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { formatDate, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { inventoryService, supplierService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import type { AdjustmentType } from '../../types/domain'
import type { BatchView } from '../../types/views'
import { MedicinePicker, type PickedMedicine } from './MedicinePicker'
import { ADJUSTMENT_TYPE_LABEL } from './labels'


function useMedicineBatches(medicineId?: string) {
  return useQuery(
    () => inventoryService.batches({ filters: { medicineId }, pageSize: 100 }).then((r) => r.items),
    [medicineId],
    { enabled: !!medicineId, tags: ['inventory'] },
  )
}

const batchLabel = (b: BatchView) => `${b.batchNumber} · ${b.location} · exp ${formatDate(b.expiryDate)} · ${b.quantity} avail.`

// ───────────────────────────── Adjustment ─────────────────────────────

const adjustmentSchema = z.object({
  batchId: z.string().min(1, 'Select a batch'),
  type: z.enum(['INCREASE', 'DECREASE', 'DAMAGED', 'EXPIRED_WRITE_OFF']),
  quantity: z.number({ message: 'Enter a quantity' }).int('Whole units only').positive('Must be greater than zero'),
  reason: z.string().trim().min(5, 'Describe the reason (min 5 characters)').max(300),
})
type AdjustmentForm = z.infer<typeof adjustmentSchema>

export interface AdjustmentInitial {
  medicine?: PickedMedicine
  batchId?: string
  type?: AdjustmentType
  quantity?: number
}

function AdjustmentBody({ initial, onClose }: { initial?: AdjustmentInitial; onClose: () => void }) {
  const settings = useSettings()
  const can = useCan()
  const [medicine, setMedicine] = useState<PickedMedicine | null>(initial?.medicine ?? null)
  const batches = useMedicineBatches(medicine?.id)
  const { register, handleSubmit, control, formState, setValue } = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { batchId: initial?.batchId ?? '', type: initial?.type ?? 'DECREASE', quantity: initial?.quantity, reason: '' },
  })
  const batchId = useWatch({ control, name: 'batchId' })
  const type = useWatch({ control, name: 'type' })
  const qty = useWatch({ control, name: 'quantity' })
  const batch = batches.data?.find((b) => b.id === batchId)
  const threshold = settings.adjustmentApprovalThreshold
  const needsApproval = !can('inventory.approve') && (threshold === 0 || (Number(qty) || 0) > threshold)
  const exceeds = batch && type !== 'INCREASE' && (Number(qty) || 0) > batch.quantity
  const writeOffInvalid = batch && type === 'EXPIRED_WRITE_OFF' && batch.expiryStatus !== 'EXPIRED'

  const mutation = useMutation(inventoryService.requestAdjustment, {
    successMessage: (r) => (r.status === 'APPROVED' ? `Adjustment ${r.adjustmentNumber} applied to stock.` : `Adjustment ${r.adjustmentNumber} sent for approval.`),
    onSuccess: onClose,
  })

  const submit = handleSubmit(async (v) => {
    if (!medicine) return
    await mutation.run({ medicineId: medicine.id, batchId: v.batchId, type: v.type, quantity: v.quantity, reason: v.reason })
  })

  return (
    <form id="adjustment-form" onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Medicine" required error={!medicine && formState.isSubmitted ? 'Select a medicine' : undefined}>
        {(id) => (
          <MedicinePicker
            id={id}
            value={medicine}
            autoFocus={!medicine}
            onSelect={(m) => {
              setMedicine({ id: m.id, name: m.name, code: m.code })
              setValue('batchId', '')
            }}
            onClear={() => {
              setMedicine(null)
              setValue('batchId', '')
            }}
          />
        )}
      </Field>
      <Field label="Batch" required error={formState.errors.batchId?.message} hint={medicine && batches.data?.length === 0 ? 'This medicine has no batches with stock.' : undefined}>
        {(id) => (
          <Select
            id={id}
            disabled={!medicine || batches.loading}
            invalid={!!formState.errors.batchId}
            placeholder={batches.loading ? 'Loading batches…' : 'Select batch'}
            options={(batches.data ?? []).map((b) => ({ value: b.id, label: batchLabel(b) }))}
            {...register('batchId')}
          />
        )}
      </Field>
      {batch && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-600">
          <span>
            Available <b className="num text-ink-900">{batch.quantity}</b>
          </span>
          <span>
            Reserved <b className="num text-ink-900">{batch.reserved}</b>
          </span>
          <span>
            Damaged <b className="num text-ink-900">{batch.damaged}</b>
          </span>
          <ExpiryBadge status={batch.expiryStatus} days={batch.daysToExpiry} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Adjustment type" required>
          {(id) => <Select id={id} options={Object.entries(ADJUSTMENT_TYPE_LABEL).map(([value, label]) => ({ value, label }))} {...register('type')} />}
        </Field>
        <Field label="Quantity (units)" required error={formState.errors.quantity?.message ?? (exceeds ? `Only ${batch?.quantity} available` : undefined)}>
          {(id) => <Input id={id} type="number" min={1} step={1} inputMode="numeric" invalid={!!formState.errors.quantity || !!exceeds} {...register('quantity', { valueAsNumber: true })} />}
        </Field>
      </div>
      <Field label="Reason" required error={formState.errors.reason?.message}>
        {(id) => <Textarea id={id} rows={3} placeholder="e.g. Physical count variance found during weekly audit" invalid={!!formState.errors.reason} {...register('reason')} />}
      </Field>
      {writeOffInvalid && <Alert tone="danger">Only expired batches can be written off as expired. Choose “Decrease” or “Mark as damaged” instead.</Alert>}
      <Alert tone={needsApproval ? 'warning' : 'info'} icon={<ShieldCheck className="h-4 w-4" />} title={needsApproval ? 'Requires manager approval' : 'Applied immediately'}>
        {can('inventory.approve')
          ? 'Your role can authorise adjustments, so this will be applied right away and logged under your name.'
          : threshold > 0
            ? `Adjustments up to ${threshold} units are applied immediately. Larger adjustments wait for a Store Manager or Administrator to approve.`
            : 'All adjustments require approval by a Store Manager or Administrator.'}
      </Alert>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose} disabled={mutation.pending}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.pending} disabled={!medicine || !!exceeds || !!writeOffInvalid}>
          {needsApproval ? 'Submit for approval' : 'Apply adjustment'}
        </Button>
      </div>
    </form>
  )
}

export function AdjustmentModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: AdjustmentInitial }) {
  return (
    <Modal open={open} onClose={onClose} title="Stock adjustment" description="Correct counts, record damage or write off expired stock. Every adjustment is audited." icon={<SlidersHorizontal className="h-4 w-4" />} size="md">
      {open && <AdjustmentBody initial={initial} onClose={onClose} />}
    </Modal>
  )
}

// ───────────────────────────── Transfer ─────────────────────────────

const transferSchema = z.object({
  batchId: z.string().min(1, 'Select a batch'),
  toLocation: z.string().min(1, 'Select a destination'),
  quantity: z.number({ message: 'Enter a quantity' }).int('Whole units only').positive('Must be greater than zero'),
  note: z.string().max(200).optional(),
})
type TransferForm = z.infer<typeof transferSchema>

function TransferBody({ initial, onClose }: { initial?: { medicine?: PickedMedicine; batchId?: string }; onClose: () => void }) {
  const settings = useSettings()
  const [medicine, setMedicine] = useState<PickedMedicine | null>(initial?.medicine ?? null)
  const batches = useMedicineBatches(medicine?.id)
  const { register, handleSubmit, control, formState, setValue } = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: { batchId: initial?.batchId ?? '', toLocation: '', note: '' },
  })
  const selectedBatchId = useWatch({ control, name: 'batchId' })
  const batch = batches.data?.find((b) => b.id === selectedBatchId)
  const qty = Number(useWatch({ control, name: 'quantity' })) || 0
  const exceeds = !!batch && qty > batch.quantity
  const mutation = useMutation(inventoryService.transfer, { successMessage: (t) => `Transfer ${t.transferNumber} completed.`, onSuccess: onClose })

  const submit = handleSubmit(async (v) => {
    if (!medicine) return
    await mutation.run({ medicineId: medicine.id, batchId: v.batchId, toLocation: v.toLocation, quantity: v.quantity, note: v.note || undefined })
  })

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Medicine" required error={!medicine && formState.isSubmitted ? 'Select a medicine' : undefined}>
        {(id) => (
          <MedicinePicker
            id={id}
            value={medicine}
            autoFocus={!medicine}
            onSelect={(m) => {
              setMedicine({ id: m.id, name: m.name, code: m.code })
              setValue('batchId', '')
            }}
            onClear={() => setMedicine(null)}
          />
        )}
      </Field>
      <Field label="Source batch" required error={formState.errors.batchId?.message}>
        {(id) => (
          <Select
            id={id}
            disabled={!medicine}
            invalid={!!formState.errors.batchId}
            placeholder="Select batch"
            options={(batches.data ?? []).filter((b) => b.quantity > 0).map((b) => ({ value: b.id, label: batchLabel(b) }))}
            {...register('batchId')}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination" required error={formState.errors.toLocation?.message}>
          {(id) => (
            <Select
              id={id}
              invalid={!!formState.errors.toLocation}
              placeholder="Select location"
              options={settings.locations.map((l) => ({ value: l, label: l, disabled: l === batch?.location }))}
              {...register('toLocation')}
            />
          )}
        </Field>
        <Field label="Quantity" required error={formState.errors.quantity?.message ?? (exceeds ? `Only ${batch?.quantity} available` : undefined)}>
          {(id) => <Input id={id} type="number" min={1} step={1} invalid={!!formState.errors.quantity || exceeds} {...register('quantity', { valueAsNumber: true })} />}
        </Field>
      </div>
      <Field label="Note" hint="Optional — e.g. moved to counter shelf for faster dispensing">
        {(id) => <Input id={id} {...register('note')} />}
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose} disabled={mutation.pending}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.pending} disabled={!medicine || exceeds} icon={<ArrowRightLeft className="h-4 w-4" />}>
          Transfer stock
        </Button>
      </div>
    </form>
  )
}

export function TransferModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: { medicine?: PickedMedicine; batchId?: string } }) {
  return (
    <Modal open={open} onClose={onClose} title="Transfer stock" description="Move units of a batch between store locations. The batch number and expiry are preserved." icon={<ArrowRightLeft className="h-4 w-4" />}>
      {open && <TransferBody initial={initial} onClose={onClose} />}
    </Modal>
  )
}

// ───────────────────────────── Add stock ─────────────────────────────

const addStockSchema = z
  .object({
    batchNumber: z.string().trim().min(2, 'Batch number is required').max(30),
    mfgDate: z.string().min(1, 'Required'),
    expiryDate: z.string().min(1, 'Required'),
    quantity: z.number({ message: 'Enter a quantity' }).int('Whole units only').positive('Must be greater than zero'),
    purchasePrice: z.number({ message: 'Enter a price' }).positive('Must be greater than zero'),
    sellingPrice: z.number({ message: 'Enter a price' }).positive('Must be greater than zero'),
    location: z.string().min(1, 'Select a location'),
    supplierId: z.string().optional(),
  })
  .refine((v) => v.expiryDate > v.mfgDate, { path: ['expiryDate'], message: 'Expiry must be after manufacturing date' })
  .refine((v) => v.expiryDate >= todayISO(), { path: ['expiryDate'], message: 'This batch is already expired' })
  .refine((v) => v.mfgDate <= todayISO(), { path: ['mfgDate'], message: 'Manufacturing date cannot be in the future' })
  .refine((v) => v.sellingPrice >= v.purchasePrice, { path: ['sellingPrice'], message: 'Selling price is below cost' })
type AddStockForm = z.infer<typeof addStockSchema>

function AddStockBody({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const [medicine, setMedicine] = useState<PickedMedicine | null>(null)
  const suppliers = useQuery(() => supplierService.list({ pageSize: 100, filters: { status: 'ACTIVE' } }), [], { tags: ['suppliers'] })
  const { register, handleSubmit, formState, setValue, control } = useForm<AddStockForm>({
    resolver: zodResolver(addStockSchema),
    defaultValues: { batchNumber: '', mfgDate: '', expiryDate: '', location: settings.locations[0] ?? '', supplierId: '' },
  })
  const mutation = useMutation(inventoryService.addBatch, { successMessage: (b) => `${b.medicineName} batch ${b.batchNumber} added to stock.`, onSuccess: onClose })
  const e = formState.errors
  const qty = Number(useWatch({ control, name: 'quantity' })) || 0
  const cost = Number(useWatch({ control, name: 'purchasePrice' })) || 0

  const submit = handleSubmit(async (v) => {
    if (!medicine) return
    await mutation.run({ medicineId: medicine.id, ...v, supplierId: v.supplierId || undefined })
  })

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Alert tone="info">Use direct stock-in for opening stock or emergency purchases. Regular deliveries should be received against a purchase order.</Alert>
      <Field label="Medicine" required error={!medicine && formState.isSubmitted ? 'Select a medicine' : undefined}>
        {(id) => (
          <MedicinePicker
            id={id}
            value={medicine}
            autoFocus
            onSelect={(m) => {
              setMedicine({ id: m.id, name: m.name, code: m.code })
              setValue('purchasePrice', m.purchasePrice)
              setValue('sellingPrice', m.sellingPrice)
              if (m.primarySupplierId) setValue('supplierId', m.primarySupplierId)
              if (m.storageInstructions.toLowerCase().includes('refrigerator')) {
                const cold = settings.locations.find((l) => /cold/i.test(l))
                if (cold) setValue('location', cold)
              }
            }}
            onClear={() => setMedicine(null)}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch number" required error={e.batchNumber?.message}>
          {(id) => <Input id={id} className="uppercase" invalid={!!e.batchNumber} {...register('batchNumber')} />}
        </Field>
        <Field label="Quantity (units)" required error={e.quantity?.message}>
          {(id) => <Input id={id} type="number" min={1} invalid={!!e.quantity} {...register('quantity', { valueAsNumber: true })} />}
        </Field>
        <Field label="Manufacturing date" required error={e.mfgDate?.message}>
          {(id) => <Input id={id} type="date" max={todayISO()} invalid={!!e.mfgDate} {...register('mfgDate')} />}
        </Field>
        <Field label="Expiry date" required error={e.expiryDate?.message}>
          {(id) => <Input id={id} type="date" min={todayISO()} invalid={!!e.expiryDate} {...register('expiryDate')} />}
        </Field>
        <Field label="Purchase price / unit" required error={e.purchasePrice?.message}>
          {(id) => <Input id={id} type="number" step="0.01" leading="₹" invalid={!!e.purchasePrice} {...register('purchasePrice', { valueAsNumber: true })} />}
        </Field>
        <Field label="Selling price (MRP) / unit" required error={e.sellingPrice?.message}>
          {(id) => <Input id={id} type="number" step="0.01" leading="₹" invalid={!!e.sellingPrice} {...register('sellingPrice', { valueAsNumber: true })} />}
        </Field>
        <Field label="Location" required error={e.location?.message}>
          {(id) => <Select id={id} options={settings.locations.map((l) => ({ value: l, label: l }))} {...register('location')} />}
        </Field>
        <Field label="Supplier">
          {(id) => <Select id={id} placeholder="Not specified" options={(suppliers.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} {...register('supplierId')} />}
        </Field>
      </div>
      {qty > 0 && cost > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-brand-50/60 px-4 py-2.5 text-[13px] text-brand-900">
          <span>Stock value added (at cost)</span>
          <span className="num font-semibold">{formatINR(qty * cost)}</span>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose} disabled={mutation.pending}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.pending} disabled={!medicine} icon={<PackagePlus className="h-4 w-4" />}>
          Add to stock
        </Button>
      </div>
    </form>
  )
}

export function AddStockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add stock (direct stock-in)" description="Record a new batch without a purchase order." icon={<PackagePlus className="h-4 w-4" />} size="lg">
      {open && <AddStockBody onClose={onClose} />}
    </Modal>
  )
}
