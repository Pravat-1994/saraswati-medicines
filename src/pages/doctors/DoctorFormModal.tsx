import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImagePlus, Plus, Stethoscope, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { clinicSettingsService, doctorService } from '../../services'
import { CONSULTATION_TYPE_LABEL, DAY_NAMES, toMinutes } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import type { ConsultationType, Doctor } from '../../types/clinic'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, FormSection, Input, Select, Switch, Textarea } from '../../components/ui/Form'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'

const TYPES: ConsultationType[] = ['VIDEO', 'AUDIO', 'IN_PERSON']
const time = z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM')

const schema = z
  .object({
    name: z.string().trim().min(3, 'Enter the doctor’s name').max(80),
    gender: z.enum(['MALE', 'FEMALE']),
    specialization: z.string().trim().min(2, 'Select a specialization'),
    qualifications: z.string().trim().min(2, 'Enter qualifications').max(120),
    experienceYears: z.number({ message: 'Required' }).int().min(0).max(70),
    registrationNo: z.string().trim().min(3, 'Registration number is required').max(40),
    registrationCouncil: z.string().trim().min(3, 'Council is required').max(80),
    consultationFee: z.number({ message: 'Required' }).min(0, 'Cannot be negative').max(100000),
    languages: z.array(z.string()).min(1, 'Add at least one language'),
    affiliation: z.string().trim().min(2, 'Enter clinic / hospital affiliation').max(120),
    consultationTypes: z.array(z.enum(['VIDEO', 'AUDIO', 'IN_PERSON'])).min(1, 'Select at least one type'),
    slotMinutes: z.number({ message: 'Required' }).int().min(5, 'At least 5 minutes').max(120),
    schedule: z.array(z.object({ day: z.number(), start: time, end: time })).min(1, 'Add at least one availability block'),
    online: z.boolean(),
    bio: z.string().trim().max(400),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    v.schedule.forEach((s, i) => {
      if (toMinutes(s.end) <= toMinutes(s.start)) ctx.addIssue({ code: 'custom', path: ['schedule', i, 'end'], message: 'Must end after start' })
    })
  })
type FormValues = z.infer<typeof schema>

export function DoctorFormModal({ open, onClose, doctor, onSaved }: { open: boolean; onClose: () => void; doctor?: Doctor; onSaved?: (d: Doctor) => void }) {
  if (!open) return null
  return <DoctorForm onClose={onClose} doctor={doctor} onSaved={onSaved} />
}

function DoctorForm({ onClose, doctor, onSaved }: { onClose: () => void; doctor?: Doctor; onSaved?: (d: Doctor) => void }) {
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const [photo, setPhoto] = useState<string | undefined>(doctor?.photoUrl)
  const [lang, setLang] = useState('')
  const { register, control, handleSubmit, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: doctor
      ? { ...doctor, bio: doctor.bio ?? '' }
      : { name: 'Dr. ', gender: 'FEMALE', specialization: '', qualifications: '', experienceYears: 0, registrationNo: '', registrationCouncil: 'Odisha Medical Council', consultationFee: 500, languages: ['English'], affiliation: 'Saraswati Clinic, Janpath', consultationTypes: ['IN_PERSON'], slotMinutes: 15, schedule: [{ day: 1, start: '10:00', end: '13:00' }], online: false, bio: '', isActive: true },
  })
  const errors = formState.errors
  const schedule = useFieldArray({ control, name: 'schedule' })
  const [languages, name] = useWatch({ control, name: ['languages', 'name'] })

  const save = useMutation((v: FormValues) => doctorService.save({ ...v, photoUrl: photo }, doctor?.id), {
    successMessage: (d) => (doctor ? `${d.name} updated` : `${d.name} added to the directory`),
    onSuccess: (d) => {
      onSaved?.(d)
      onClose()
    },
  })

  const onPhoto = (f?: File) => {
    if (!f) return
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return toast.error('Choose a PNG, JPG or WebP image.')
    if (f.size > 1024 * 1024) return toast.error('Photo must be 1 MB or smaller.')
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.readAsDataURL(f)
  }

  const specs = settings.data?.specializations ?? []
  const num = { valueAsNumber: true } as const

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!save.pending}
      size="xl"
      icon={<Stethoscope className="h-4 w-4" />}
      title={doctor ? `Edit ${doctor.name}` : 'Add doctor'}
      description="Profile shown in the doctor directory and the patient booking portal."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" form="doctor-form" loading={save.pending}>
            {doctor ? 'Save changes' : 'Add doctor'}
          </Button>
        </>
      }
    >
      <form id="doctor-form" noValidate onSubmit={handleSubmit((v) => void save.run(v))}>
        <FormSection title="Profile" description="Name, photo and specialisation.">
          <div className="flex items-center gap-4 sm:col-span-2">
            <PersonAvatar name={name || 'Doctor'} photoUrl={photo} size="lg" />
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-[13px] font-medium text-ink-700 hover:bg-ink-50">
                <ImagePlus className="h-4 w-4" /> Upload photo
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              {photo && (
                <Button size="sm" variant="ghost" onClick={() => setPhoto(undefined)}>
                  Remove
                </Button>
              )}
              <p className="w-full text-xs text-ink-500">Optional · max 1 MB. Kept in memory in demo mode.</p>
            </div>
          </div>
          <Field label="Full name" required error={errors.name?.message}>
            {(id) => <Input id={id} invalid={!!errors.name} {...register('name')} />}
          </Field>
          <Field label="Gender" required>
            {(id) => (
              <Select
                id={id}
                options={[
                  { value: 'FEMALE', label: 'Female' },
                  { value: 'MALE', label: 'Male' },
                ]}
                {...register('gender')}
              />
            )}
          </Field>
          <Field label="Specialization" required error={errors.specialization?.message}>
            {(id) => (
              <>
                <Input id={id} list="doctor-specs" invalid={!!errors.specialization} {...register('specialization')} />
                <datalist id="doctor-specs">{specs.map((s) => <option key={s} value={s} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Qualifications" required error={errors.qualifications?.message}>
            {(id) => <Input id={id} placeholder="MBBS, MD (Medicine)" invalid={!!errors.qualifications} {...register('qualifications')} />}
          </Field>
          <Field label="Experience (years)" required error={errors.experienceYears?.message}>
            {(id) => <Input id={id} type="number" min={0} invalid={!!errors.experienceYears} {...register('experienceYears', num)} />}
          </Field>
          <Field label="Clinic / hospital affiliation" required error={errors.affiliation?.message}>
            {(id) => <Input id={id} invalid={!!errors.affiliation} {...register('affiliation')} />}
          </Field>
          <Field label="Short bio" className="sm:col-span-2" error={errors.bio?.message}>
            {(id) => <Textarea id={id} rows={2} {...register('bio')} />}
          </Field>
        </FormSection>

        <FormSection title="Registration" description="Medical council registration / licence details.">
          <Field label="Registration no." required error={errors.registrationNo?.message}>
            {(id) => <Input id={id} className="font-mono" invalid={!!errors.registrationNo} {...register('registrationNo')} />}
          </Field>
          <Field label="Council" required error={errors.registrationCouncil?.message}>
            {(id) => <Input id={id} invalid={!!errors.registrationCouncil} {...register('registrationCouncil')} />}
          </Field>
        </FormSection>

        <FormSection title="Consultations" description="Fee, languages and consultation modes.">
          <Field label="Consultation fee (₹)" required error={errors.consultationFee?.message}>
            {(id) => <Input id={id} type="number" min={0} leading="₹" invalid={!!errors.consultationFee} {...register('consultationFee', num)} />}
          </Field>
          <Field label="Slot duration (minutes)" required error={errors.slotMinutes?.message}>
            {(id) => <Input id={id} type="number" min={5} step={5} invalid={!!errors.slotMinutes} {...register('slotMinutes', num)} />}
          </Field>
          <Field label="Consultation types" required error={errors.consultationTypes?.message} className="sm:col-span-2">
            {() => (
              <Controller
                control={control}
                name="consultationTypes"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {TYPES.map((t) => {
                      const on = field.value.includes(t)
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => field.onChange(on ? field.value.filter((x) => x !== t) : [...field.value, t])}
                          className={cn('rounded-lg border px-3 py-1.5 text-[13px] font-medium transition', on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-600 hover:border-ink-300')}
                        >
                          {CONSULTATION_TYPE_LABEL[t]}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            )}
          </Field>
          <Field label="Languages" required error={errors.languages?.message} className="sm:col-span-2">
            {(id) => (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 p-2">
                {languages.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                    {l}
                    <button type="button" aria-label={`Remove ${l}`} onClick={() => setValue('languages', languages.filter((x) => x !== l), { shouldValidate: true, shouldDirty: true })}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  id={id}
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      const v = lang.trim()
                      if (v && !languages.includes(v)) setValue('languages', [...languages, v], { shouldValidate: true, shouldDirty: true })
                      setLang('')
                    }
                  }}
                  placeholder="Type and press Enter"
                  className="min-w-32 flex-1 bg-transparent px-1 text-sm focus:outline-none"
                />
              </div>
            )}
          </Field>
          <div className="sm:col-span-2">
            <Controller control={control} name="online" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Available online" description="Shows a green status in the directory and portal." />} />
          </div>
          <div className="sm:col-span-2">
            <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Active" description="Inactive doctors are hidden from the directory and cannot be booked." />} />
          </div>
        </FormSection>

        <FormSection title="Weekly availability" description="Bookable blocks; slots are generated from the slot duration.">
          <div className="space-y-2 sm:col-span-2">
            {schedule.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2">
                <Select aria-label="Day" options={DAY_NAMES.map((d, n) => ({ value: String(n), label: d }))} {...register(`schedule.${i}.day`, { valueAsNumber: true })} />
                <Input aria-label="Start time" type="time" invalid={!!errors.schedule?.[i]?.start} {...register(`schedule.${i}.start`)} />
                <div>
                  <Input aria-label="End time" type="time" invalid={!!errors.schedule?.[i]?.end} {...register(`schedule.${i}.end`)} />
                  {errors.schedule?.[i]?.end && <p className="mt-1 text-xs text-red-600">{errors.schedule[i]?.end?.message}</p>}
                </div>
                <Button size="icon" variant="ghost" aria-label="Remove block" onClick={() => schedule.remove(i)} disabled={schedule.fields.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {errors.schedule?.message && <p className="text-xs text-red-600">{errors.schedule.message}</p>}
            <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => schedule.append({ day: 1, start: '10:00', end: '13:00' })}>
              Add block
            </Button>
          </div>
        </FormSection>
      </form>
    </Modal>
  )
}
