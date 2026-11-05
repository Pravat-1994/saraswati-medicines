import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Form'
import { useMutation } from '../../hooks/useQuery'
import { customerService } from '../../services'
import { todayISO } from '../../lib/dates'
import type { Customer } from '../../types/domain'
import { blankToUndefined, formatIndianPhone, optionalEmailSchema, phoneSchema } from './validation'

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  phone: phoneSchema,
  email: optionalEmailSchema,
  address: z.string().trim().max(200, 'Address is too long'),
  dateOfBirth: z.string().refine((v) => !v || v <= todayISO(), 'Date of birth cannot be in the future'),
  notes: z.string().trim().max(500, 'Notes are limited to 500 characters'),
})

type FormValues = z.infer<typeof schema>

export interface CustomerFormModalProps {
  open: boolean
  onClose: () => void
  customer?: Customer
  onSaved?: (c: Customer) => void
}

/** Add / edit customer dialog. Also used by the POS screen for quick registration. */
export function CustomerFormModal(props: CustomerFormModalProps) {
  if (!props.open) return null
  return <CustomerForm key={props.customer?.id ?? 'new'} {...props} />
}

function CustomerForm({ onClose, customer, onSaved }: CustomerFormModalProps) {
  const isEdit = !!customer
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      address: customer?.address ?? '',
      dateOfBirth: customer?.dateOfBirth ?? '',
      notes: customer?.notes ?? '',
    },
  })

  const save = useMutation(
    (v: FormValues) => {
      const input = {
        name: v.name.trim(),
        phone: formatIndianPhone(v.phone),
        email: blankToUndefined(v.email),
        address: blankToUndefined(v.address),
        dateOfBirth: blankToUndefined(v.dateOfBirth),
        notes: blankToUndefined(v.notes),
      }
      return customer ? customerService.update(customer.id, input) : customerService.create(input)
    },
    {
      successMessage: (c) => (isEdit ? `${c.name} updated` : `${c.name} added to customers`),
      onSuccess: (c) => {
        onSaved?.(c)
        onClose()
      },
    },
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!save.pending}
      size="md"
      icon={<UserPlus className="h-4 w-4" />}
      title={isEdit ? 'Edit customer' : 'Add customer'}
      description={isEdit ? 'Update contact details and notes.' : 'Registration is optional — walk-in sales never require a customer record.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={save.pending}>
            {isEdit ? 'Save changes' : 'Add customer'}
          </Button>
        </>
      }
    >
      <form id="customer-form" noValidate onSubmit={handleSubmit((v) => void save.run(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name?.message} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.name} placeholder="e.g. Sunita Mishra" autoComplete="name" {...register('name')} />}
        </Field>
        <Field label="Phone" required error={errors.phone?.message} hint="10-digit number, +91 optional">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.phone} placeholder="+91 98610 23409" inputMode="tel" autoComplete="tel" {...register('phone')} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.email} type="email" placeholder="name@example.com" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.address} placeholder="Locality, city" {...register('address')} />}
        </Field>
        <Field label="Date of birth" error={errors.dateOfBirth?.message} hint="Optional — useful for senior-citizen offers">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.dateOfBirth} type="date" max={todayISO()} {...register('dateOfBirth')} />}
        </Field>
        <Field label="Notes" error={errors.notes?.message} className="sm:col-span-2" hint="e.g. regular medication, delivery preferences">
          {(id, d) => <Textarea id={id} aria-describedby={d} invalid={!!errors.notes} rows={3} {...register('notes')} />}
        </Field>
      </form>
    </Modal>
  )
}
