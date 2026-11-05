import { useState } from 'react'
import { CalendarPlus, Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useQuery } from '../../hooks/useQuery'
import { appointmentService, clinicSettingsService, doctorService } from '../../services'
import { CONSULTATION_TYPE_LABEL, formatSlot } from '../../lib/clinic'
import { formatDate, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { cn } from '../../lib/utils'
import { ServiceError } from '../../types/api'
import type { ConsultationType } from '../../types/clinic'
import type { AppointmentView, PatientListItem } from '../../types/clinicApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Select, Textarea } from '../../components/ui/Form'
import { Alert } from '../../components/ui/Feedback'
import { PatientPicker } from '../../components/clinic/PatientPicker'
import { DateStrip, SlotGrid } from './SlotGrid'
import { QuickRegisterModal } from './QuickRegisterModal'

interface Props {
  open: boolean
  onClose: () => void
  doctorId?: string
  patient?: PatientListItem
  onBooked?: (a: AppointmentView) => void
}

/** Staff books an appointment on behalf of a patient. */
export function BookAppointmentModal(props: Props) {
  if (!props.open) return null
  return <BookForm {...props} />
}

type FileLite = { name: string; size: number; type: string }

function BookForm({ onClose, doctorId: initialDoctor, patient: initialPatient, onBooked }: Props) {
  const doctors = useQuery(() => doctorService.list({}), [], { tags: ['users'] })
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const [patient, setPatient] = useState<PatientListItem | undefined>(initialPatient)
  const [registering, setRegistering] = useState(false)
  const [doctorId, setDoctorId] = useState(initialDoctor ?? '')
  const [type, setType] = useState<ConsultationType | ''>('')
  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState<string>()
  const [reason, setReason] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [files, setFiles] = useState<FileLite[]>([])
  const [refresh, setRefresh] = useState(0)
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  const doctor = doctors.data?.find((d) => d.id === doctorId)
  const types = doctor?.consultationTypes ?? []
  const effectiveType: ConsultationType | '' = type && types.includes(type) ? type : (types[0] ?? '')
  const maxMb = settings.data?.maxReportSizeMb ?? 10
  const windowDays = settings.data?.bookingWindowDays ?? 14

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next: FileLite[] = []
    for (const f of Array.from(list)) {
      if (!/^(application\/pdf|image\/(png|jpe?g|webp))$/.test(f.type)) {
        toast.error(`${f.name}: only PDF or image files are accepted.`)
        continue
      }
      if (f.size > maxMb * 1024 * 1024) {
        toast.error(`${f.name} is larger than ${maxMb} MB.`)
        continue
      }
      next.push({ name: f.name, size: f.size, type: f.type })
    }
    setFiles((cur) => [...cur, ...next].slice(0, 5))
  }

  const missing = !patient ? 'Select a patient.' : !doctor ? 'Select a doctor.' : !effectiveType ? 'Choose a consultation type.' : !start ? 'Choose a time slot.' : !reason.trim() ? 'Enter the reason for consultation.' : undefined

  const submit = async () => {
    setTouched(true)
    if (missing || !patient || !doctor || !start || !effectiveType) return
    setPending(true)
    setError(undefined)
    try {
      const a = await appointmentService.book({ patientId: patient.id, doctorId: doctor.id, type: effectiveType, date, start, reason, symptoms: symptoms || undefined, reports: files })
      invalidate()
      toast.success(`Appointment ${a.appointmentNo} booked for ${formatDate(a.date)} at ${formatSlot(a.start)}`)
      onBooked?.(a)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof ServiceError && err.code === 'SLOT_TAKEN') {
        setStart(undefined)
        setRefresh((n) => n + 1)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Modal
        open={!registering}
        onClose={onClose}
        dismissible={!pending}
        size="xl"
        icon={<CalendarPlus className="h-4 w-4" />}
        title="Book appointment"
        description="Staff booking on behalf of a patient — the appointment is confirmed immediately."
        footer={
          <>
            {doctor && start && (
              <span className="mr-auto text-[13px] text-ink-600">
                {formatDate(date)} · {formatSlot(start)} · fee <span className="num font-semibold text-ink-900">{formatINR(doctor.consultationFee)}</span>
              </span>
            )}
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={pending}>
              Confirm booking
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          {touched && missing && !error && <Alert tone="warning">{missing}</Alert>}
          <Field label="Patient" required>
            {() => <PatientPicker value={patient} onChange={setPatient} onRegisterNew={() => setRegistering(true)} invalid={touched && !patient} />}
          </Field>
          {patient && patient.allergies.length > 0 && <Alert tone="danger" title="Allergies">{patient.allergies.join(', ')}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Doctor" required>
              {(id) => (
                <Select
                  id={id}
                  value={doctorId}
                  onChange={(e) => {
                    setDoctorId(e.target.value)
                    setStart(undefined)
                  }}
                  placeholder="Select doctor"
                  invalid={touched && !doctor}
                  options={(doctors.data ?? []).map((d) => ({ value: d.id, label: `${d.name} — ${d.specialization} (${formatINR(d.consultationFee)})` }))}
                />
              )}
            </Field>
            <Field label="Consultation type" required>
              {() => (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Consultation type">
                  {(types.length ? types : (['VIDEO', 'AUDIO', 'IN_PERSON'] as ConsultationType[])).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={effectiveType === t}
                      disabled={!types.includes(t)}
                      onClick={() => setType(t)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
                        effectiveType === t ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/15' : 'border-ink-200 text-ink-600 hover:border-ink-300',
                      )}
                    >
                      {CONSULTATION_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-ink-700">Date & time</div>
            <DateStrip
              value={date}
              days={windowDays}
              onChange={(d) => {
                setDate(d)
                setStart(undefined)
              }}
            />
            <div className="mt-3">
              <SlotGrid doctorId={doctor?.id} date={date} value={start} onChange={setStart} refreshKey={refresh} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reason for consultation" required error={touched && !reason.trim() ? 'Required' : undefined}>
              {(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} invalid={touched && !reason.trim()} />}
            </Field>
            <Field label="Symptoms" hint="Optional">
              {(id) => <Textarea id={id} rows={2} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />}
            </Field>
          </div>
          <Field label="Medical reports" hint={`PDF or images, up to ${maxMb} MB each (max 5). Stored via Decisions once integrated.`}>
            {(id) => (
              <div className="space-y-2">
                <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-4 py-3 text-[13px] text-ink-600 hover:border-brand-400">
                  <Paperclip className="h-4 w-4 text-brand-600" /> Attach reports
                  <input id={id} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
                </label>
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-1.5 text-[12.5px]">
                    <span className="truncate">{f.name} · {(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="rounded p-1 text-ink-400 hover:text-red-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>
        </div>
      </Modal>
      <QuickRegisterModal
        open={registering}
        onClose={() => setRegistering(false)}
        onRegistered={(p) => {
          setPatient(p)
          setRegistering(false)
        }}
      />
    </>
  )
}
