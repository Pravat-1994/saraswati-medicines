import { useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldCheck, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate } from '../../hooks/useQuery'
import { patientService } from '../../services'
import { todayISO } from '../../lib/dates'
import { maskPhone } from '../../lib/clinic'
import { ServiceError } from '../../types/api'
import type { Patient } from '../../types/clinic'
import type { PatientInput, PatientListItem } from '../../types/clinicApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { cn } from '../../lib/utils'

const phone = z
  .string()
  .trim()
  .refine((v) => /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid 10-digit Indian mobile number')

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter the full name').max(80),
    dateOfBirth: z.string().min(1, 'Date of birth is required').refine((v) => v <= todayISO(), 'Cannot be in the future'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    phone,
    email: z.string().trim().regex(/^([^\s@]+@[^\s@]+\.[^\s@]{2,})?$/, 'Enter a valid email').optional(),
    address: z.string().trim().max(200),
    ecName: z.string().trim().max(80).optional(),
    ecRelation: z.string().trim().max(40).optional(),
    ecPhone: z.string().trim().optional(),
    bloodGroup: z.string().optional(),
    allergies: z.array(z.string()),
    conditions: z.array(z.string()),
    history: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.ecName && v.ecName.length > 0) {
      if (!v.ecPhone || !/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.ecPhone.replace(/[\s-]/g, ''))) ctx.addIssue({ code: 'custom', path: ['ecPhone'], message: 'Enter the emergency contact’s mobile number' })
    }
  })

type FormValues = z.infer<typeof schema>

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function ChipInput({ id, value, onChange, placeholder, tone }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder: string; tone: 'red' | 'ink' }) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t])
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
      {value.map((v) => (
        <span key={v} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', tone === 'red' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-ink-100 text-ink-700')}>
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded hover:bg-black/5">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input id={id} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={value.length ? '' : placeholder} className="min-w-28 flex-1 bg-transparent px-1 text-sm focus:outline-none" />
    </div>
  )
}

function toInput(v: FormValues): PatientInput {
  return {
    name: v.name,
    dateOfBirth: v.dateOfBirth,
    gender: v.gender,
    phone: v.phone,
    email: v.email || undefined,
    address: v.address,
    emergencyContact: v.ecName ? { name: v.ecName, relation: v.ecRelation || 'Relative', phone: v.ecPhone ?? '' } : undefined,
    bloodGroup: v.bloodGroup || undefined,
    allergies: v.allergies,
    conditions: v.conditions,
    history: v.history || undefined,
  }
}

/** Register or edit a patient, with duplicate detection before registration. */
export function PatientFormModal({ open, onClose, patient, onSaved }: { open: boolean; onClose: () => void; patient?: Patient; onSaved?: (p: Patient) => void }) {
  const navigate = useNavigate()
  const [dupes, setDupes] = useState<PatientListItem[] | null>(null)
  const [pending, setPending] = useState<PatientInput | null>(null)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, control, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      name: patient?.name ?? '',
      dateOfBirth: patient?.dateOfBirth ?? '',
      gender: patient?.gender ?? 'FEMALE',
      phone: patient?.phone ?? '',
      email: patient?.email ?? '',
      address: patient?.address ?? '',
      ecName: patient?.emergencyContact?.name ?? '',
      ecRelation: patient?.emergencyContact?.relation ?? '',
      ecPhone: patient?.emergencyContact?.phone ?? '',
      bloodGroup: patient?.bloodGroup ?? '',
      allergies: patient?.allergies ?? [],
      conditions: patient?.conditions ?? [],
      history: patient?.history ?? '',
    },
  })
  const errors = formState.errors

  const close = () => {
    setDupes(null)
    setPending(null)
    reset()
    onClose()
  }

  const save = async (input: PatientInput, confirmDuplicate: boolean) => {
    setSaving(true)
    try {
      const saved = patient ? await patientService.update(patient.id, input) : await patientService.register(input, confirmDuplicate)
      invalidate()
      toast.success(patient ? 'Patient details updated' : `${saved.name} registered as ${saved.patientCode}`)
      setDupes(null)
      setPending(null)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      if (err instanceof ServiceError && err.code === 'DUPLICATE' && !patient) {
        setPending(input)
        setDupes(await patientService.findDuplicates(input))
      } else toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = async (v: FormValues) => {
    const input = toInput(v)
    if (!patient) {
      const matches = await patientService.findDuplicates(input).catch(() => [])
      if (matches.length) {
        setPending(input)
        setDupes(matches)
        return
      }
    }
    await save(input, false)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      dismissible={!saving}
      icon={<UserPlus className="h-4 w-4" />}
      title={patient ? `Edit ${patient.name}` : 'Register patient'}
      description={patient ? patient.patientCode : 'A patient ID is generated automatically.'}
      footer={
        dupes ? (
          <>
            <Button variant="outline" onClick={() => setDupes(null)} disabled={saving}>
              Back to form
            </Button>
            <Button variant="secondary" loading={saving} onClick={() => pending && save(pending, true)}>
              Register anyway
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving || formState.isSubmitting}>
              {patient ? 'Save changes' : 'Register patient'}
            </Button>
          </>
        )
      }
    >
      {dupes ? (
        <div className="space-y-4">
          <Alert tone="warning" title="This patient may already be registered">
            We found {dupes.length} record{dupes.length === 1 ? '' : 's'} with the same mobile number and date of birth, or the same name and date of birth. Open the existing record to avoid duplicates, or register anyway if this is a different person.
          </Alert>
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
            {dupes.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <PersonAvatar name={d.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink-900">{d.name}</div>
                  <div className="text-xs text-ink-500">
                    {d.patientCode} · {d.age} yrs · {maskPhone(d.phone)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    close()
                    navigate(`/patients/${d.id}`)
                  }}
                >
                  Open existing
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <section>
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Identity</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Full name" required error={errors.name?.message} className="sm:col-span-3">
                {(id) => <Input id={id} autoComplete="off" invalid={!!errors.name} {...register('name')} />}
              </Field>
              <Field label="Date of birth" required error={errors.dateOfBirth?.message}>
                {(id) => <Input id={id} type="date" max={todayISO()} invalid={!!errors.dateOfBirth} {...register('dateOfBirth')} />}
              </Field>
              <Field label="Gender" required>
                {(id) => <Select id={id} options={[{ value: 'FEMALE', label: 'Female' }, { value: 'MALE', label: 'Male' }, { value: 'OTHER', label: 'Other' }]} {...register('gender')} />}
              </Field>
              <Field label="Blood group" hint="Optional">
                {(id) => <Select id={id} placeholder="Unknown" options={BLOOD.map((b) => ({ value: b, label: b }))} {...register('bloodGroup')} />}
              </Field>
            </div>
          </section>
          <section>
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile number" required error={errors.phone?.message}>
                {(id) => <Input id={id} inputMode="tel" placeholder="98XXXXXXXX" invalid={!!errors.phone} {...register('phone')} />}
              </Field>
              <Field label="Email" hint="Optional" error={errors.email?.message}>
                {(id) => <Input id={id} type="email" invalid={!!errors.email} {...register('email')} />}
              </Field>
              <Field label="Address" className="sm:col-span-2">
                {(id) => <Input id={id} placeholder="Area, city" {...register('address')} />}
              </Field>
            </div>
          </section>
          <section>
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Emergency contact</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name">{(id) => <Input id={id} {...register('ecName')} />}</Field>
              <Field label="Relation">{(id) => <Input id={id} placeholder="e.g. Spouse" {...register('ecRelation')} />}</Field>
              <Field label="Mobile" error={errors.ecPhone?.message}>
                {(id) => <Input id={id} inputMode="tel" invalid={!!errors.ecPhone} {...register('ecPhone')} />}
              </Field>
            </div>
          </section>
          <section>
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Medical</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Allergies" hint="Press Enter to add each allergy">
                {(id) => <Controller control={control} name="allergies" render={({ field }) => <ChipInput id={id} value={field.value} onChange={field.onChange} placeholder="e.g. Penicillin" tone="red" />} />}
              </Field>
              <Field label="Existing conditions" hint="Press Enter to add">
                {(id) => <Controller control={control} name="conditions" render={({ field }) => <ChipInput id={id} value={field.value} onChange={field.onChange} placeholder="e.g. Hypertension" tone="ink" />} />}
              </Field>
              <Field label="Relevant medical history" className="sm:col-span-2">
                {(id) => <Textarea id={id} rows={2} {...register('history')} />}
              </Field>
            </div>
          </section>
          <p className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" /> Collect only what is needed for care. Do not record Aadhaar, insurance or financial details here.
          </p>
        </form>
      )}
    </Modal>
  )
}
