import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Lock, PenLine, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useQuery } from '../../hooks/useQuery'
import { doctorService, patientService, prescriptionService } from '../../services'
import { todayISO } from '../../lib/dates'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import type { PatientListItem } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, FormSection, Input, Textarea } from '../../components/ui/Form'
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { PatientPicker } from '../../components/clinic/PatientPicker'
import { MedicineNameInput } from './MedicineNameInput'

const FREQUENCIES = ['1-0-1', '1-1-1', '1-0-0', '0-0-1', 'OD (once daily)', 'BD (twice daily)', 'TDS (three times a day)', 'QID (four times a day)', 'SOS (when required)', 'HS (at bedtime)']

const item = z.object({
  medicineId: z.string().optional(),
  medicineName: z.string().trim().min(2, 'Medicine name is required'),
  dosage: z.string().trim().min(1, 'Required'),
  frequency: z.string().trim().min(1, 'Required'),
  duration: z.string().trim().min(1, 'Required'),
  instructions: z.string().trim().max(200),
  quantity: z.number({ message: 'Required' }).int('Whole number').min(1, 'At least 1'),
})
const schema = z.object({
  diagnosis: z.string().trim().min(2, 'Diagnosis is required').max(200),
  symptoms: z.string().trim().max(400),
  items: z.array(item).min(1, 'Add at least one medicine'),
  recommendations: z.string().trim().max(800),
  followUpDate: z.string().optional().refine((v) => !v || v >= todayISO(), 'Follow-up must be today or later'),
})
type FormValues = z.infer<typeof schema>
const emptyItem = { medicineId: undefined, medicineName: '', dosage: '1 tablet', frequency: '1-0-1', duration: '5 days', instructions: 'After food', quantity: 1 }

export default function PrescriptionEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const can = useCan()
  const user = useSessionStore((s) => s.user)
  const isDoctor = user?.roleId === 'DOCTOR' && !!user.doctorId && can('prescriptions.issue')
  const existing = useQuery(() => prescriptionService.get(id!), [id], { enabled: !!id && isDoctor })
  const patientParam = params.get('patient') ?? existing.data?.prescription.patientId
  const prefill = useQuery(() => patientService.profile(patientParam!), [patientParam], { enabled: !!patientParam && isDoctor })
  const me = useQuery(() => doctorService.get(user!.doctorId!), [user?.doctorId], { enabled: isDoctor })

  if (!isDoctor) {
    return (
      <Card>
        <h1 className="sr-only">Prescription editor</h1>
        <EmptyState icon={<Lock className="h-5 w-5" />} title="Only doctors can write prescriptions" description="Prescriptions must be created and signed by an authorised, registered medical practitioner. Pharmacy and administrative staff can view and dispense finalised prescriptions." action={<Link to="/prescriptions"><Button variant="outline">Back to prescriptions</Button></Link>} />
      </Card>
    )
  }
  if (id && existing.error) return <ErrorState message={existing.error} onRetry={existing.refetch} />
  if ((id && !existing.data) || (patientParam && !prefill.data && !prefill.error)) return <PageLoader />
  if (existing.data && existing.data.prescription.status !== 'DRAFT') {
    return (
      <Card>
        <h1 className="sr-only">Prescription editor</h1>
        <EmptyState icon={<Lock className="h-5 w-5" />} title="This prescription is finalised" description="Signed prescriptions cannot be edited. Create a new prescription if changes are needed." action={<Link to={`/prescriptions/${id}`}><Button variant="outline">View prescription</Button></Link>} />
      </Card>
    )
  }
  return <Editor key={id ?? 'new'} id={id} initialPatient={prefill.data?.patient} params={params} existing={existing.data} doctorName={me.data?.doctor.name ?? user.name} />
}

function Editor({ id, initialPatient, params, existing, doctorName }: { id?: string; initialPatient?: PatientListItem; params: URLSearchParams; existing?: Awaited<ReturnType<typeof prescriptionService.get>>; doctorName: string }) {
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientListItem | undefined>(initialPatient)
  const [patientError, setPatientError] = useState(false)
  const [savedId, setSavedId] = useState<string | undefined>(id)
  const [signing, setSigning] = useState(false)
  const [signName, setSignName] = useState('')
  const [busy, setBusy] = useState(false)
  const rx = existing?.prescription
  const { register, control, handleSubmit, formState, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: rx
      ? { diagnosis: rx.diagnosis, symptoms: rx.symptoms, items: rx.items.map((i) => ({ medicineId: i.medicineId, medicineName: i.medicineName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions, quantity: i.quantity })), recommendations: rx.recommendations, followUpDate: rx.followUpDate ?? '' }
      : { diagnosis: '', symptoms: '', items: [{ ...emptyItem }], recommendations: '', followUpDate: '' },
  })
  const errors = formState.errors
  const items = useFieldArray({ control, name: 'items' })

  const persist = async (v: FormValues) => {
    if (!patient) {
      setPatientError(true)
      throw new Error('Select a patient')
    }
    const saved = await prescriptionService.saveDraft(
      {
        patientId: patient.id,
        appointmentId: rx?.appointmentId ?? params.get('appointment') ?? undefined,
        consultationId: rx?.consultationId ?? params.get('consultation') ?? undefined,
        admissionId: rx?.admissionId ?? params.get('admission') ?? undefined,
        diagnosis: v.diagnosis,
        symptoms: v.symptoms,
        items: v.items.map((i) => ({ ...i, medicineId: i.medicineId || undefined })),
        recommendations: v.recommendations,
        followUpDate: v.followUpDate || undefined,
      },
      savedId,
    )
    setSavedId(saved.id)
    invalidate()
    return saved
  }

  const saveDraft = async (v: FormValues) => {
    setBusy(true)
    try {
      const saved = await persist(v)
      toast.success(`Draft ${saved.rxNo} saved`)
      navigate(`/prescriptions/${saved.id}/edit`, { replace: true })
    } catch (err) {
      if (patient) toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const finalise = async () => {
    setBusy(true)
    try {
      const saved = await persist(getValues())
      const final = await prescriptionService.finalise(saved.id, signName)
      invalidate()
      toast.success(`${final.rxNo} finalised and signed`)
      navigate(`/prescriptions/${final.id}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(saveDraft)}>
      <PageHeader
        title={rx ? `Edit draft ${rx.rxNo}` : 'New prescription'}
        description="Drafts are visible only to you. Finalising records your typed signature, registration number and the time."
        breadcrumbs={[{ label: 'Prescriptions', to: '/prescriptions' }, { label: rx ? rx.rxNo : 'New' }]}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(-1)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="outline" icon={<Save className="h-4 w-4" />} loading={busy}>
              Save draft
            </Button>
            <Button
              icon={<PenLine className="h-4 w-4" />}
              disabled={busy}
              onClick={() => {
                if (!patient) return setPatientError(true)
                void handleSubmit(() => {
                  setSignName('')
                  setSigning(true)
                })()
              }}
            >
              Finalise & sign
            </Button>
          </>
        }
      />
      {patient && patient.allergies.length > 0 && (
        <Alert tone="danger" className="mb-4" icon={<AlertTriangle className="h-4 w-4" />} title="Patient allergies">
          {patient.allergies.join(', ')} — check every prescribed medicine.
        </Alert>
      )}
      <Card className="px-5 sm:px-6">
        <FormSection title="Patient" description="Prescriptions are linked to the patient record and consultation.">
          <div className="sm:col-span-2">
            <PatientPicker value={patient} onChange={(p) => { setPatient(p); setPatientError(false) }} invalid={patientError} />
            {patientError && <p className="mt-1 text-xs font-medium text-red-600">Select a patient.</p>}
            {patient && patient.conditions.length > 0 && <p className="mt-2 text-xs text-ink-500">Known conditions: {patient.conditions.join(', ')}</p>}
          </div>
        </FormSection>
        <FormSection title="Clinical details" description="Diagnosis and presenting symptoms.">
          <Field label="Diagnosis" required error={errors.diagnosis?.message} className="sm:col-span-2">
            {(fid) => <Input id={fid} invalid={!!errors.diagnosis} {...register('diagnosis')} />}
          </Field>
          <Field label="Symptoms" className="sm:col-span-2">
            {(fid) => <Textarea id={fid} rows={2} {...register('symptoms')} />}
          </Field>
        </FormSection>
      </Card>

      <Card className="mt-4">
        <CardHeader title="℞ Medicines" description="No automatic substitution — pharmacists dispense exactly what is prescribed." action={<Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => items.append({ ...emptyItem })}>Add medicine</Button>} />
        <CardBody className="space-y-4">
          {errors.items?.message && <Alert tone="danger">{errors.items.message}</Alert>}
          {items.fields.map((f, i) => (
            <div key={f.id} className="rounded-xl border border-ink-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-700">#{i + 1}</span>
                <Button size="icon-sm" variant="ghost" aria-label="Remove medicine" onClick={() => items.remove(i)} disabled={items.fields.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <Field label="Medicine" required error={errors.items?.[i]?.medicineName?.message} className="sm:col-span-2 lg:col-span-2">
                  {(fid) => (
                    <Controller
                      control={control}
                      name={`items.${i}.medicineName`}
                      render={({ field }) => (
                        <Controller
                          control={control}
                          name={`items.${i}.medicineId`}
                          render={({ field: idField }) => (
                            <MedicineNameInput
                              id={fid}
                              name={field.value}
                              medicineId={idField.value}
                              invalid={!!errors.items?.[i]?.medicineName}
                              onChange={(v) => {
                                field.onChange(v.name)
                                idField.onChange(v.medicineId)
                              }}
                            />
                          )}
                        />
                      )}
                    />
                  )}
                </Field>
                <Field label="Dosage" required error={errors.items?.[i]?.dosage?.message}>
                  {(fid) => <Input id={fid} invalid={!!errors.items?.[i]?.dosage} {...register(`items.${i}.dosage`)} />}
                </Field>
                <Field label="Frequency" required error={errors.items?.[i]?.frequency?.message}>
                  {(fid) => (
                    <>
                      <Input id={fid} list="rx-frequencies" invalid={!!errors.items?.[i]?.frequency} {...register(`items.${i}.frequency`)} />
                      <datalist id="rx-frequencies">{FREQUENCIES.map((x) => <option key={x} value={x} />)}</datalist>
                    </>
                  )}
                </Field>
                <Field label="Duration" required error={errors.items?.[i]?.duration?.message}>
                  {(fid) => <Input id={fid} invalid={!!errors.items?.[i]?.duration} {...register(`items.${i}.duration`)} />}
                </Field>
                <Field label="Qty to dispense" required error={errors.items?.[i]?.quantity?.message} hint="Packs">
                  {(fid) => <Input id={fid} type="number" min={1} invalid={!!errors.items?.[i]?.quantity} {...register(`items.${i}.quantity`, { valueAsNumber: true })} />}
                </Field>
                <Field label="Instructions" className="sm:col-span-2 lg:col-span-6">
                  {(fid) => <Input id={fid} placeholder="e.g. After food, avoid alcohol" {...register(`items.${i}.instructions`)} />}
                </Field>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card className="mt-4 px-5 sm:px-6">
        <FormSection title="Advice & follow-up">
          <Field label="Recommendations" className="sm:col-span-2">
            {(fid) => <Textarea id={fid} rows={3} placeholder="Diet, activity, warning signs…" {...register('recommendations')} />}
          </Field>
          <Field label="Follow-up date" error={errors.followUpDate?.message}>
            {(fid) => <Input id={fid} type="date" min={todayISO()} invalid={!!errors.followUpDate} {...register('followUpDate')} />}
          </Field>
        </FormSection>
      </Card>

      <Modal
        open={signing}
        onClose={() => setSigning(false)}
        dismissible={!busy}
        size="sm"
        icon={<PenLine className="h-4 w-4" />}
        title="Finalise & sign prescription"
        description="Once signed the prescription becomes valid for dispensing and can no longer be edited."
        footer={
          <>
            <Button variant="outline" onClick={() => setSigning(false)} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} disabled={signName.trim().toLowerCase() !== doctorName.toLowerCase()} onClick={() => void finalise()}>
              Sign & finalise
            </Button>
          </>
        }
      >
        <Field label={`Type your name exactly: ${doctorName}`} hint="Your registration number and the time will be recorded with your signature.">
          {(fid) => <Input id={fid} value={signName} onChange={(e) => setSignName(e.target.value)} autoComplete="off" />}
        </Field>
      </Modal>
    </form>
  )
}
