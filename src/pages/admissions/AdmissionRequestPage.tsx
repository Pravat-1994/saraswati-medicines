import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Check, ShieldAlert, Siren } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useQuery } from '../../hooks/useQuery'
import { admissionService, clinicSettingsService, doctorService, patientService, roomService } from '../../services'
import { formatDate, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { ADMISSION_TYPE_LABEL, ROOM_TYPE_LABEL, maskPhone } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import type { AdmissionType, RoomType } from '../../types/clinic'
import type { PatientListItem } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/Badge'
import { PatientPicker } from '../../components/clinic/PatientPicker'
import { PatientFormModal } from '../patients/PatientFormModal'

const TYPES: AdmissionType[] = ['EMERGENCY', 'PLANNED', 'REFERRAL', 'OBSERVATION']
const TYPE_HINT: Record<AdmissionType, string> = {
  EMERGENCY: 'Auto-approved; clinical approval recorded by the admitting doctor',
  PLANNED: 'Scheduled procedure or treatment',
  REFERRAL: 'Referred by another doctor or facility',
  OBSERVATION: 'Short stay for monitoring',
}

const schema = z.object({
  doctorId: z.string().min(1, 'Choose the admitting doctor'),
  type: z.enum(['EMERGENCY', 'PLANNED', 'REFERRAL', 'OBSERVATION']),
  department: z.string().min(1, 'Choose a department'),
  reason: z.string().trim().min(5, 'Describe the reason for admission').max(300),
  diagnosis: z.string().trim().max(200),
  initialObservations: z.string().trim().max(600),
  expectedDischarge: z.string().optional(),
  preferredRoomType: z.string().optional(),
  attendantName: z.string().trim().max(80).optional(),
  attendantRelation: z.string().trim().max(40).optional(),
  attendantPhone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid mobile number'),
})
type FormValues = z.infer<typeof schema>

const STEPS = ['Patient', 'Clinical details', 'Review & submit']

export default function AdmissionRequestPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [patient, setPatient] = useState<PatientListItem>()
  const [registering, setRegistering] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const doctors = useQuery(() => doctorService.list(), [], { tags: ['customers'] })
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const beds = useQuery(() => roomService.summary(), [], { tags: ['customers'] })
  const preselect = params.get('patient')

  useEffect(() => {
    if (!preselect) return
    let cancelled = false
    patientService.profile(preselect).then((p) => !cancelled && setPatient(p.patient), () => undefined)
    return () => {
      cancelled = true
    }
  }, [preselect])

  const { register, handleSubmit, control, trigger, setValue, getValues, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { doctorId: '', type: 'PLANNED', department: '', reason: '', diagnosis: '', initialObservations: '', expectedDischarge: '', preferredRoomType: '', attendantName: '', attendantRelation: '', attendantPhone: '' },
  })
  const errors = formState.errors
  const [type, doctorId] = useWatch({ control, name: ['type', 'doctorId'] })

  // Default department from the admitting doctor's affiliation where it matches a department.
  useEffect(() => {
    const d = doctors.data?.find((x) => x.id === doctorId)
    const deps = settings.data?.departments ?? []
    if (d && !getValues('department')) {
      const match = deps.find((dep) => d.specialization.toLowerCase().includes(dep.toLowerCase().split(' ')[0]) || dep.toLowerCase().includes(d.specialization.toLowerCase().slice(0, 6)))
      setValue('department', match ?? (deps.includes('General Medicine') ? 'General Medicine' : ''))
    }
  }, [doctorId, doctors.data, settings.data, getValues, setValue])

  useEffect(() => {
    if (patient?.emergencyContact && !getValues('attendantName')) {
      setValue('attendantName', patient.emergencyContact.name)
      setValue('attendantRelation', patient.emergencyContact.relation)
      setValue('attendantPhone', patient.emergencyContact.phone)
    }
  }, [patient, getValues, setValue])

  const next = async () => {
    if (step === 0) {
      if (!patient) return toast.error('Select or register the patient first.')
      if (patient.activeAdmission) return toast.error(`${patient.name} is already admitted (${patient.activeAdmission.admissionNo}).`)
      setStep(1)
    } else if (step === 1) {
      if (await trigger()) setStep(2)
    }
  }

  const onSubmit = async (v: FormValues) => {
    if (!patient) return
    setSubmitting(true)
    try {
      const a = await admissionService.request({
        patientId: patient.id,
        doctorId: v.doctorId,
        type: v.type,
        department: v.department,
        reason: v.reason,
        diagnosis: v.diagnosis,
        initialObservations: v.initialObservations,
        expectedDischarge: v.expectedDischarge || undefined,
        preferredRoomType: (v.preferredRoomType || undefined) as RoomType | undefined,
        attendant: v.attendantName ? { name: v.attendantName, relation: v.attendantRelation || 'Relative', phone: v.attendantPhone || '' } : undefined,
      })
      invalidate()
      toast.success(a.status === 'APPROVED' ? `${a.admissionNo} created and auto-approved (emergency). Allocate a bed next.` : `${a.admissionNo} submitted for approval`)
      navigate(`/admissions/${a.id}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const v = getValues()
  const doctor = doctors.data?.find((d) => d.id === v.doctorId)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New admission request" description="Register or find the patient, record the clinical reason, then submit for approval and bed allocation." breadcrumbs={[{ label: 'Admissions', to: '/admissions' }, { label: 'New' }]} />

      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium', i === step ? 'border-brand-500 bg-brand-50 text-brand-800' : i < step ? 'border-brand-200 bg-white text-ink-700' : 'border-ink-200 bg-white text-ink-400')} aria-current={i === step ? 'step' : undefined}>
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-white text-brand-700 ring-2 ring-brand-500' : 'bg-ink-100 text-ink-500')}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className="truncate">{s}</span>
          </li>
        ))}
      </ol>

      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardBody className="space-y-5 pt-5">
            {step === 0 && (
              <>
                <h2 className="font-display text-[15px] font-semibold text-ink-900">Who is being admitted?</h2>
                <PatientPicker value={patient} onChange={setPatient} onRegisterNew={() => setRegistering(true)} />
                {patient?.activeAdmission && <Alert tone="warning">This patient already has an active admission ({patient.activeAdmission.admissionNo}).</Alert>}
                {patient && patient.allergies.length > 0 && (
                  <Alert tone="danger" icon={<ShieldAlert className="h-4 w-4" />} title="Allergies">
                    {patient.allergies.join(', ')}
                  </Alert>
                )}
                {beds.data && (
                  <div className="flex flex-wrap gap-2 rounded-xl bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
                    <span className="font-medium text-ink-800">Bed availability now:</span>
                    {beds.data.byType.map((t) => (
                      <span key={t.type}>
                        {ROOM_TYPE_LABEL[t.type]} <span className={cn('font-semibold', t.available ? 'text-emerald-700' : 'text-red-600')}>{t.available}</span>/{t.total}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <fieldset>
                  <legend className="mb-2 text-[13px] font-medium text-ink-700">Admission type</legend>
                  <div className="grid gap-2 sm:grid-cols-4" role="radiogroup">
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={type === t}
                        onClick={() => setValue('type', t)}
                        className={cn('rounded-xl border p-3 text-left transition', type === t ? (t === 'EMERGENCY' ? 'border-red-400 bg-red-50 ring-2 ring-red-400/20' : 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/15') : 'border-ink-200 hover:border-ink-300')}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                          {t === 'EMERGENCY' && <Siren className="h-4 w-4 text-red-600" />}
                          {ADMISSION_TYPE_LABEL[t]}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">{TYPE_HINT[t]}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Admitting doctor" required error={errors.doctorId?.message}>
                    {(id) => <Select id={id} placeholder="Select doctor" invalid={!!errors.doctorId} options={(doctors.data ?? []).map((d) => ({ value: d.id, label: `${d.name} — ${d.specialization}` }))} {...register('doctorId')} />}
                  </Field>
                  <Field label="Department" required error={errors.department?.message}>
                    {(id) => <Select id={id} placeholder="Select department" invalid={!!errors.department} options={(settings.data?.departments ?? []).map((d) => ({ value: d, label: d }))} {...register('department')} />}
                  </Field>
                  <Field label="Reason for admission" required error={errors.reason?.message} className="sm:col-span-2">
                    {(id) => <Textarea id={id} rows={2} invalid={!!errors.reason} {...register('reason')} />}
                  </Field>
                  <Field label="Provisional diagnosis" hint="As recorded by the doctor">
                    {(id) => <Input id={id} {...register('diagnosis')} />}
                  </Field>
                  <Field label="Expected discharge" hint="Optional">
                    {(id) => <Input id={id} type="date" min={todayISO()} {...register('expectedDischarge')} />}
                  </Field>
                  <Field label="Initial observations" className="sm:col-span-2">
                    {(id) => <Textarea id={id} rows={2} placeholder="Condition on arrival, vitals summary, mobility…" {...register('initialObservations')} />}
                  </Field>
                  <Field label="Preferred room type" hint="Used to suggest beds">
                    {(id) => <Select id={id} placeholder="No preference" options={(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => ({ value: t, label: ROOM_TYPE_LABEL[t] }))} {...register('preferredRoomType')} />}
                  </Field>
                </div>
                <div>
                  <h3 className="mb-2 text-[13px] font-medium text-ink-700">Attendant</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Name">{(id) => <Input id={id} {...register('attendantName')} />}</Field>
                    <Field label="Relation">{(id) => <Input id={id} {...register('attendantRelation')} />}</Field>
                    <Field label="Mobile" error={errors.attendantPhone?.message}>
                      {(id) => <Input id={id} inputMode="tel" invalid={!!errors.attendantPhone} {...register('attendantPhone')} />}
                    </Field>
                  </div>
                </div>
              </>
            )}

            {step === 2 && patient && (
              <>
                {v.type === 'EMERGENCY' ? (
                  <Alert tone="danger" icon={<Siren className="h-4 w-4" />} title="Emergency admission">
                    This request is approved automatically so a bed can be allocated straight away. The admitting doctor records clinical approval afterwards.
                  </Alert>
                ) : (
                  <Alert tone="info">After submission, an authorised doctor or manager approves the request. Then allocate a bed and confirm the admission.</Alert>
                )}
                <dl className="grid gap-4 sm:grid-cols-3">
                  <InfoRow label="Patient" value={`${patient.name} (${patient.patientCode})`} />
                  <InfoRow label="Age / mobile" value={`${patient.age} yrs · ${maskPhone(patient.phone)}`} />
                  <InfoRow label="Admission type" value={<Badge tone={v.type === 'EMERGENCY' ? 'danger' : 'brand'}>{ADMISSION_TYPE_LABEL[v.type]}</Badge>} />
                  <InfoRow label="Doctor" value={doctor ? `${doctor.name} · ${doctor.specialization}` : '—'} />
                  <InfoRow label="Department" value={v.department} />
                  <InfoRow label="Expected discharge" value={v.expectedDischarge ? formatDate(v.expectedDischarge) : 'Not set'} />
                  <InfoRow label="Reason" value={v.reason} className="sm:col-span-3" />
                  <InfoRow label="Provisional diagnosis" value={v.diagnosis || 'Not recorded'} className="sm:col-span-3" />
                  <InfoRow label="Preferred room" value={v.preferredRoomType ? ROOM_TYPE_LABEL[v.preferredRoomType as RoomType] : 'No preference'} />
                  <InfoRow label="Attendant" value={v.attendantName ? `${v.attendantName} (${v.attendantRelation || 'Relative'})` : 'Not recorded'} />
                  <InfoRow label="Admission charge" value={settings.data ? formatINR(settings.data.admissionCharge) : '—'} />
                </dl>
              </>
            )}
          </CardBody>
          <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/50 px-5 py-3.5 sm:rounded-b-2xl">
            <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => (step === 0 ? navigate('/admissions') : setStep(step - 1))} disabled={submitting}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < 2 ? (
              <Button iconRight={<ArrowRight className="h-4 w-4" />} onClick={next}>
                Continue
              </Button>
            ) : (
              <Button type="submit" loading={submitting} icon={<Check className="h-4 w-4" />}>
                Submit admission request
              </Button>
            )}
          </div>
        </Card>
      </form>

      {registering && (
        <PatientFormModal
          open
          onClose={() => setRegistering(false)}
          onSaved={(p) => {
            void patientService.profile(p.id).then((prof) => setPatient(prof.patient))
          }}
        />
      )}
    </div>
  )
}
