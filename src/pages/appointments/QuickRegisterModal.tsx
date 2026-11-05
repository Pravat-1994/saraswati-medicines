import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus } from 'lucide-react'
import { errorMessage, invalidate } from '../../hooks/useQuery'
import { patientService } from '../../services'
import { todayISO } from '../../lib/dates'
import { ServiceError } from '../../types/api'
import type { Patient } from '../../types/clinic'
import type { PatientListItem } from '../../types/clinicApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the full name').max(80),
  phone: z.string().trim().refine((v) => /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid 10-digit mobile number'),
  dateOfBirth: z.string().min(1, 'Date of birth is required').refine((v) => v <= todayISO(), 'Cannot be in the future'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  address: z.string().trim().max(200).optional(),
})
type FormValues = z.infer<typeof schema>

/** Minimal registration used while booking. Full details can be completed in Patient Registration. */
export function QuickRegisterModal({ open, onClose, onRegistered }: { open: boolean; onClose: () => void; onRegistered: (p: PatientListItem) => void }) {
  if (!open) return null
  return <QuickRegisterForm onClose={onClose} onRegistered={onRegistered} />
}

function toListItem(p: Patient): PatientListItem {
  const age = Math.max(0, new Date().getFullYear() - Number(p.dateOfBirth.slice(0, 4)))
  return { ...p, age, appointmentCount: 0 }
}

function QuickRegisterForm({ onClose, onRegistered }: { onClose: () => void; onRegistered: (p: PatientListItem) => void }) {
  const [dupes, setDupes] = useState<PatientListItem[]>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const { register, handleSubmit, getValues, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', phone: '', dateOfBirth: '', gender: 'FEMALE', address: '' } })
  const errors = formState.errors

  const submit = async (v: FormValues, confirmDuplicate = false) => {
    setPending(true)
    setError(undefined)
    try {
      const p = await patientService.register({ name: v.name, phone: v.phone, dateOfBirth: v.dateOfBirth, gender: v.gender, address: v.address ?? '', allergies: [], conditions: [] }, confirmDuplicate)
      invalidate()
      onRegistered(toListItem(p))
    } catch (err) {
      if (err instanceof ServiceError && err.code === 'DUPLICATE') {
        const found = await patientService.findDuplicates({ name: v.name, phone: v.phone, dateOfBirth: v.dateOfBirth })
        setDupes(found)
      } else setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!pending}
      size="md"
      icon={<UserPlus className="h-4 w-4" />}
      title="Register patient"
      description="Basic details only. Allergies, history and emergency contact can be added in Patient Registration."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          {dupes?.length ? (
            <Button variant="secondary" loading={pending} onClick={() => void submit(getValues(), true)}>
              Register anyway
            </Button>
          ) : (
            <Button type="submit" form="quick-patient" loading={pending}>
              Register
            </Button>
          )}
        </>
      }
    >
      {dupes && dupes.length > 0 && (
        <Alert tone="warning" className="mb-4" title="This patient may already be registered">
          <ul className="mt-2 space-y-1.5">
            {dupes.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span>
                  {d.name} · {d.patientCode} · {d.age} yrs
                </span>
                <Button size="xs" onClick={() => onRegistered(d)}>
                  Use existing
                </Button>
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <form id="quick-patient" noValidate onSubmit={handleSubmit((v) => void submit(v))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name?.message} className="sm:col-span-2">
          {(id) => <Input id={id} invalid={!!errors.name} {...register('name')} />}
        </Field>
        <Field label="Mobile number" required error={errors.phone?.message}>
          {(id) => <Input id={id} inputMode="tel" invalid={!!errors.phone} {...register('phone')} />}
        </Field>
        <Field label="Date of birth" required error={errors.dateOfBirth?.message}>
          {(id) => <Input id={id} type="date" max={todayISO()} invalid={!!errors.dateOfBirth} {...register('dateOfBirth')} />}
        </Field>
        <Field label="Gender" required>
          {(id) => (
            <Select
              id={id}
              options={[
                { value: 'FEMALE', label: 'Female' },
                { value: 'MALE', label: 'Male' },
                { value: 'OTHER', label: 'Other' },
              ]}
              {...register('gender')}
            />
          )}
        </Field>
        <Field label="Address" hint="Optional">
          {(id) => <Input id={id} {...register('address')} />}
        </Field>
      </form>
    </Modal>
  )
}
