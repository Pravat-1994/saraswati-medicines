import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Truck } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Switch, Textarea } from '../../components/ui/Form'
import { useMutation } from '../../hooks/useQuery'
import { supplierService } from '../../services'
import { useSettingsStore } from '../../stores/settingsStore'
import type { Supplier } from '../../types/domain'
import { blankToUndefined, formatIndianPhone, gstinSchema, optionalEmailSchema, phoneSchema, pincodeSchema } from '../customers/validation'

const schema = z.object({
  name: z.string().trim().min(3, 'Supplier name must be at least 3 characters').max(100),
  contactPerson: z.string().trim().min(2, 'Contact person is required').max(80),
  phone: phoneSchema,
  email: optionalEmailSchema,
  gstin: gstinSchema,
  drugLicenseNo: z.string().trim().max(60),
  line1: z.string().trim().min(3, 'Address is required').max(120),
  line2: z.string().trim().max(120),
  city: z.string().trim().min(2, 'City is required').max(60),
  state: z.string().trim().min(2, 'State is required').max(60),
  pincode: pincodeSchema,
  paymentTermsDays: z.number({ message: 'Enter number of days' }).int('Whole days only').min(0, 'Cannot be negative').max(365, 'Maximum 365 days'),
  openingBalance: z.number({ message: 'Enter an amount' }).min(0, 'Cannot be negative').max(10_000_000),
  notes: z.string().trim().max(500),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export interface SupplierFormModalProps {
  open: boolean
  onClose: () => void
  supplier?: Supplier
  onSaved?: (s: Supplier) => void
}

export function SupplierFormModal(props: SupplierFormModalProps) {
  if (!props.open) return null
  return <SupplierForm key={props.supplier?.id ?? 'new'} {...props} />
}

function SupplierForm({ onClose, supplier, onSaved }: SupplierFormModalProps) {
  const defaultTerms = useSettingsStore((s) => s.settings?.defaultPaymentTermsDays ?? 30)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: supplier?.name ?? '',
      contactPerson: supplier?.contactPerson ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      gstin: supplier?.gstin ?? '',
      drugLicenseNo: supplier?.drugLicenseNo ?? '',
      line1: supplier?.address.line1 ?? '',
      line2: supplier?.address.line2 ?? '',
      city: supplier?.address.city ?? '',
      state: supplier?.address.state ?? 'Odisha',
      pincode: supplier?.address.pincode ?? '',
      paymentTermsDays: supplier?.paymentTermsDays ?? defaultTerms,
      openingBalance: supplier?.openingBalance ?? 0,
      notes: supplier?.notes ?? '',
      isActive: supplier?.isActive ?? true,
    },
  })

  const save = useMutation(
    (v: FormValues) => {
      const input = {
        name: v.name,
        contactPerson: v.contactPerson,
        phone: formatIndianPhone(v.phone),
        email: blankToUndefined(v.email),
        gstin: v.gstin.toUpperCase(),
        drugLicenseNo: blankToUndefined(v.drugLicenseNo),
        address: { line1: v.line1, line2: blankToUndefined(v.line2), city: v.city, state: v.state, pincode: v.pincode },
        paymentTermsDays: v.paymentTermsDays,
        openingBalance: v.openingBalance,
        notes: blankToUndefined(v.notes),
        isActive: v.isActive,
      }
      return supplier ? supplierService.update(supplier.id, input) : supplierService.create(input)
    },
    {
      successMessage: (s) => (supplier ? `${s.name} updated` : `${s.name} added`),
      onSuccess: (s) => {
        onSaved?.(s)
        onClose()
      },
    },
  )

  const text = (name: keyof FormValues, label: string, opts: { required?: boolean; placeholder?: string; hint?: string; span?: boolean; upper?: boolean; inputMode?: 'tel' | 'email' | 'numeric' } = {}) => (
    <Field label={label} required={opts.required} error={errors[name]?.message} hint={opts.hint} className={opts.span ? 'sm:col-span-2' : undefined}>
      {(id, d) => (
        <Input
          id={id}
          aria-describedby={d}
          invalid={!!errors[name]}
          placeholder={opts.placeholder}
          inputMode={opts.inputMode}
          className={opts.upper ? 'uppercase' : undefined}
          {...register(name)}
        />
      )}
    </Field>
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!save.pending}
      size="lg"
      icon={<Truck className="h-4 w-4" />}
      title={supplier ? 'Edit supplier' : 'Add supplier'}
      description="Distributor details used on purchase orders and payment records."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" loading={save.pending}>
            {supplier ? 'Save changes' : 'Add supplier'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" noValidate onSubmit={handleSubmit((v) => void save.run(v))} className="space-y-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Business</legend>
          {text('name', 'Supplier name', { required: true, placeholder: 'e.g. Kalinga Pharma Distributors', span: true })}
          {text('gstin', 'GSTIN', { required: true, placeholder: '21AAKFK4512L1Z8', upper: true })}
          {text('drugLicenseNo', 'Drug licence no.', { placeholder: 'OD-KH-20B-11823' })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Contact</legend>
          {text('contactPerson', 'Contact person', { required: true })}
          {text('phone', 'Phone', { required: true, placeholder: '+91 94370 21145', inputMode: 'tel' })}
          {text('email', 'Email', { placeholder: 'orders@supplier.in', inputMode: 'email', span: true })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Address</legend>
          {text('line1', 'Address line 1', { required: true, span: true })}
          {text('line2', 'Address line 2', { span: true })}
          {text('city', 'City', { required: true })}
          {text('state', 'State', { required: true })}
          {text('pincode', 'PIN code', { required: true, inputMode: 'numeric', placeholder: '751010' })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Terms</legend>
          <Field label="Payment terms (days)" required error={errors.paymentTermsDays?.message}>
            {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.paymentTermsDays} type="number" min={0} {...register('paymentTermsDays', { valueAsNumber: true })} />}
          </Field>
          <Field label="Opening balance (₹)" error={errors.openingBalance?.message} hint="Amount owed before using this system">
            {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.openingBalance} type="number" min={0} step="0.01" {...register('openingBalance', { valueAsNumber: true })} />}
          </Field>
          <Field label="Notes" error={errors.notes?.message} className="sm:col-span-2">
            {(id, d) => <Textarea id={id} aria-describedby={d} rows={2} {...register('notes')} />}
          </Field>
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} label="Active supplier" description="Inactive suppliers cannot be selected on new purchase orders." />
              )}
            />
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
