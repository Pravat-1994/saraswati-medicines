import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Activity, FileUp, NotebookPen, Pill } from 'lucide-react'
import { useMutation } from '../../hooks/useQuery'
import { clinicalRecordService } from '../../services'
import { CLINICAL_KIND_LABEL } from '../../lib/clinic'
import type { ClinicalEntryKind, Vitals } from '../../types/clinic'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'

interface Ctx {
  patientId: string
  admissionId?: string
  onClose: () => void
}

const numText = (lo: number, hi: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi), `${label}: enter ${lo}–${hi}`)

const vitalsSchema = z
  .object({
    systolic: numText(50, 260, 'Systolic'),
    diastolic: numText(30, 160, 'Diastolic'),
    heartRate: numText(20, 250, 'Heart rate'),
    temperatureC: numText(30, 45, 'Temperature'),
    respiratoryRate: numText(4, 70, 'Resp. rate'),
    spo2: numText(50, 100, 'SpO₂'),
    weightKg: numText(0.5, 300, 'Weight'),
  })
  .superRefine((v, ctx) => {
    if (Object.values(v).every((x) => x === '')) ctx.addIssue({ code: 'custom', path: ['systolic'], message: 'Record at least one vital sign' })
    if ((v.systolic === '') !== (v.diastolic === '')) ctx.addIssue({ code: 'custom', path: ['diastolic'], message: 'Enter both systolic and diastolic' })
    if (v.systolic && v.diastolic && Number(v.diastolic) >= Number(v.systolic)) ctx.addIssue({ code: 'custom', path: ['diastolic'], message: 'Diastolic must be lower than systolic' })
  })

type VitalsForm = z.infer<typeof vitalsSchema>

const VITAL_FIELDS: { key: keyof VitalsForm; label: string; unit: string; step?: string }[] = [
  { key: 'systolic', label: 'BP systolic', unit: 'mmHg' },
  { key: 'diastolic', label: 'BP diastolic', unit: 'mmHg' },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm' },
  { key: 'temperatureC', label: 'Temperature', unit: '°C', step: '0.1' },
  { key: 'respiratoryRate', label: 'Respiratory rate', unit: '/min' },
  { key: 'spo2', label: 'SpO₂', unit: '%' },
  { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.1' },
]

function VitalsDialog({ patientId, admissionId, onClose }: Ctx) {
  const { register, handleSubmit, formState } = useForm<VitalsForm>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: { systolic: '', diastolic: '', heartRate: '', temperatureC: '', respiratoryRate: '', spo2: '', weightKg: '' },
  })
  const save = useMutation((v: Vitals) => clinicalRecordService.add({ patientId, admissionId, kind: 'VITALS', vitals: v }), { successMessage: 'Vital signs recorded', onSuccess: onClose })
  const submit = (f: VitalsForm) => {
    const v: Vitals = {}
    for (const { key } of VITAL_FIELDS) if (f[key] !== '') v[key] = Number(f[key])
    void save.run(v)
  }
  const e = formState.errors
  return (
    <Modal
      open
      onClose={onClose}
      title="Record vital signs"
      description="Enter only the readings taken now."
      icon={<Activity className="h-4 w-4" />}
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(submit)} loading={save.pending}>
            Save readings
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
        {VITAL_FIELDS.map((f) => (
          <Field key={f.key} label={`${f.label} (${f.unit})`} error={e[f.key]?.message}>
            {(id, d) => <Input id={id} aria-describedby={d} type="number" inputMode="decimal" step={f.step ?? '1'} invalid={!!e[f.key]} {...register(f.key)} />}
          </Field>
        ))}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

const medSchema = z.object({
  name: z.string().trim().min(2, 'Medicine name is required').max(120),
  dose: z.string().trim().min(1, 'Dose is required').max(60),
  route: z.string().min(1),
  givenAt: z.string().min(1, 'Time given is required'),
})
type MedForm = z.infer<typeof medSchema>
const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Inhaled', 'Topical', 'Sublingual', 'Rectal', 'Other']

const localNow = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function MedicationDialog({ patientId, admissionId, onClose }: Ctx) {
  const { register, handleSubmit, formState } = useForm<MedForm>({ resolver: zodResolver(medSchema), defaultValues: { name: '', dose: '', route: 'Oral', givenAt: localNow() } })
  const save = useMutation(
    (m: MedForm) => clinicalRecordService.add({ patientId, admissionId, kind: 'MEDICATION', medication: { name: m.name, dose: m.dose, route: m.route, givenAt: new Date(m.givenAt).toISOString() } }),
    { successMessage: 'Medication administration recorded', onSuccess: onClose },
  )
  const e = formState.errors
  return (
    <Modal
      open
      onClose={onClose}
      title="Medication administered"
      icon={<Pill className="h-4 w-4" />}
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit((m) => save.run(m))} loading={save.pending}>
            Save record
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit((m) => save.run(m))} className="grid gap-4 sm:grid-cols-2">
        <Field label="Medicine" required error={e.name?.message} className="sm:col-span-2">
          {(id) => <Input id={id} placeholder="e.g. Inj. Pantoprazole 40 mg" invalid={!!e.name} {...register('name')} />}
        </Field>
        <Field label="Dose" required error={e.dose?.message}>
          {(id) => <Input id={id} placeholder="e.g. 1 vial" invalid={!!e.dose} {...register('dose')} />}
        </Field>
        <Field label="Route">{(id) => <Select id={id} options={ROUTES.map((r) => ({ value: r, label: r }))} {...register('route')} />}</Field>
        <Field label="Time given" required error={e.givenAt?.message} className="sm:col-span-2">
          {(id) => <Input id={id} type="datetime-local" max={localNow()} invalid={!!e.givenAt} {...register('givenAt')} />}
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

const noteSchema = z.object({ title: z.string().trim().max(80), text: z.string().trim().min(3, 'Write the note before saving').max(4000) })
type NoteForm = z.infer<typeof noteSchema>

function NoteDialog({ patientId, admissionId, onClose, kind }: Ctx & { kind: ClinicalEntryKind }) {
  const { register, handleSubmit, formState } = useForm<NoteForm>({ resolver: zodResolver(noteSchema), defaultValues: { title: '', text: '' } })
  const save = useMutation((n: NoteForm) => clinicalRecordService.add({ patientId, admissionId, kind, title: n.title || CLINICAL_KIND_LABEL[kind], text: n.text }), {
    successMessage: `${CLINICAL_KIND_LABEL[kind]} saved`,
    onSuccess: onClose,
  })
  const e = formState.errors
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={CLINICAL_KIND_LABEL[kind]}
      icon={<NotebookPen className="h-4 w-4" />}
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit((n) => save.run(n))} loading={save.pending}>
            Save
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit((n) => save.run(n))} className="space-y-4">
        <Field label="Title" hint="Optional">
          {(id) => <Input id={id} placeholder={CLINICAL_KIND_LABEL[kind]} {...register('title')} />}
        </Field>
        <Field label="Note" required error={e.text?.message}>
          {(id) => <Textarea id={id} rows={7} invalid={!!e.text} {...register('text')} />}
        </Field>
      </form>
    </Modal>
  )
}

const MAX_DOC = 10 * 1024 * 1024
const DOC_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp))$/

function DocumentDialog({ patientId, admissionId, onClose }: Ctx) {
  const [file, setFile] = useState<File>()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string>()
  const save = useMutation(
    (f: File) => clinicalRecordService.add({ patientId, admissionId, kind: 'DOCUMENT', title: title.trim() || f.name, file: { name: f.name, size: f.size, type: f.type } }),
    { successMessage: 'Document added to the record', onSuccess: onClose },
  )
  const submit = () => {
    if (!file) return setError('Choose a file to upload.')
    if (!DOC_TYPES.test(file.type)) return setError('Only PDF or image files (PNG, JPG, WEBP) are accepted.')
    if (file.size > MAX_DOC) return setError('File must be 10 MB or smaller.')
    setError(undefined)
    void save.run(file)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Upload document"
      icon={<FileUp className="h-4 w-4" />}
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.pending}>
            Add document
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" hint="Optional — e.g. Chest X-ray report">
          {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="File (PDF or image, max 10 MB)" required error={error}>
          {(id) => (
            <input
              id={id}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0])}
              className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-100"
            />
          )}
        </Field>
        <Alert tone="info">Demo mode records the file name, size and type only. Once integrated, the file is stored securely via the Decisions FileReference service with access restricted to authorised clinical staff.</Alert>
      </div>
    </Modal>
  )
}

export type EntryDialogKind = ClinicalEntryKind

export function AddEntryDialog({ kind, ...ctx }: Ctx & { kind: EntryDialogKind }) {
  if (kind === 'VITALS') return <VitalsDialog {...ctx} />
  if (kind === 'MEDICATION') return <MedicationDialog {...ctx} />
  if (kind === 'DOCUMENT') return <DocumentDialog {...ctx} />
  return <NoteDialog {...ctx} kind={kind} />
}
