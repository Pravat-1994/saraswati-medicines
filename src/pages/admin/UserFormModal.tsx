import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserCog } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Switch } from '../../components/ui/Form'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { doctorService, userService } from '../../services'
import { useSessionStore } from '../../stores/sessionStore'
import type { AppUser, Role, RoleId } from '../../types/domain'
import { blankToUndefined, formatIndianPhone, isValidIndianPhone } from '../customers/validation'

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  email: z.string().trim().min(1, 'Email is required').regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address'),
  phone: z.string().trim().refine((v) => !v || isValidIndianPhone(v), 'Enter a valid 10-digit phone number'),
  roleId: z.enum(['ADMIN', 'PHARMACIST', 'STORE_MANAGER', 'SALES_OPERATOR', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'BILLING_OPERATOR']),
  isActive: z.boolean(),
  doctorId: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export interface UserFormModalProps {
  open: boolean
  onClose: () => void
  user?: AppUser
  roles: Role[]
}

export function UserFormModal(props: UserFormModalProps) {
  if (!props.open) return null
  return <UserForm key={props.user?.id ?? 'new'} {...props} />
}

function UserForm({ onClose, user, roles }: UserFormModalProps) {
  const currentId = useSessionStore((s) => s.user?.id)
  const isSelf = user?.id === currentId
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', roleId: user?.roleId ?? 'SALES_OPERATOR', isActive: user?.isActive ?? true, doctorId: user?.doctorId ?? '' },
  })
  const roleId = useWatch({ control, name: 'roleId' })
  const role = roles.find((r) => r.id === roleId)
  const doctors = useQuery(() => doctorService.list({}), [], { enabled: roleId === 'DOCTOR', tags: ['users'] })

  const save = useMutation(
    (v: FormValues) => userService.save({ name: v.name, email: v.email, phone: v.phone ? formatIndianPhone(v.phone) : blankToUndefined(v.phone), roleId: v.roleId as RoleId, doctorId: v.roleId === 'DOCTOR' ? v.doctorId || undefined : undefined, isActive: v.isActive }, user?.id),
    { successMessage: (u) => (user ? `${u.name} updated` : `${u.name} added`), onSuccess: onClose },
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!save.pending}
      icon={<UserCog className="h-4 w-4" />}
      title={user ? 'Edit user' : 'Add user'}
      description="In Decisions, users map to Decisions accounts; the role controls which modules they can use."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" loading={save.pending}>
            {user ? 'Save changes' : 'Add user'}
          </Button>
        </>
      }
    >
      <form id="user-form" noValidate onSubmit={handleSubmit((v) => void save.run(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name?.message} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.name} {...register('name')} />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.email} type="email" {...register('email')} />}
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.phone} inputMode="tel" {...register('phone')} />}
        </Field>
        <Field label="Role" required className="sm:col-span-2" hint={isSelf ? 'You cannot change your own role.' : role?.description}>
          {(id, d) =>
            isSelf ? (
              <Input id={id} aria-describedby={d} value={role?.name ?? ''} readOnly className="bg-ink-50" />
            ) : (
              <Select id={id} aria-describedby={d} options={roles.map((r) => ({ value: r.id, label: r.name }))} {...register('roleId')} />
            )
          }
        </Field>
        {roleId === 'DOCTOR' && (
          <Field label="Doctor profile" className="sm:col-span-2" hint="Links this account to a doctor profile. Only linked doctors can conduct consultations and sign prescriptions.">
            {(id, d) => <Select id={id} aria-describedby={d} placeholder="Not linked" options={(doctors.data ?? []).map((doc) => ({ value: doc.id, label: `${doc.name} — ${doc.specialization}` }))} {...register('doctorId')} />}
          </Field>
        )}
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch checked={field.value} onChange={field.onChange} disabled={isSelf} label="Active" description={isSelf ? 'You cannot deactivate your own account.' : 'Inactive users cannot sign in to the application.'} />
            )}
          />
        </div>
      </form>
    </Modal>
  )
}
