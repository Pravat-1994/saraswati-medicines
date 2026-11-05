import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarX, CheckCircle2, FileHeart, FileText, Play, UserX, Video } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useMutation, useQuery } from '../../hooks/useQuery'
import { appointmentService, consultationService } from '../../services'
import { CONSULTATION_TYPE_LABEL, ageFrom, formatSlot } from '../../lib/clinic'
import { formatDate, formatDateTime, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import { ServiceError } from '../../types/api'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { Field, Textarea } from '../../components/ui/Form'
import { AppointmentStatusBadge, ConsultationTypeBadge, FulfilmentBadge } from '../../components/clinic/ClinicBadges'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { DateStrip, SlotGrid } from './SlotGrid'

const nowLocal = () => {
  const d = new Date()
  return `${todayISO()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AppointmentDetailPage() {
  const { id } = useParams()
  const can = useCan()
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const q = useQuery(() => appointmentService.get(id!), [id], { tags: ['customers', 'sales'] })
  const [dialog, setDialog] = useState<'cancel' | 'reschedule' | null>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState<string>()
  const [refresh, setRefresh] = useState(0)
  const [rsError, setRsError] = useState<string>()
  const [rsPending, setRsPending] = useState(false)
  const [starting, setStarting] = useState(false)

  const setStatus = useMutation((s: 'CONFIRMED' | 'SCHEDULED' | 'NO_SHOW') => appointmentService.setStatus(id!, s), { successMessage: (a) => `Appointment ${a.status.toLowerCase().replace('_', '-')}` })
  const cancel = useMutation(() => appointmentService.cancel(id!, reason), { successMessage: 'Appointment cancelled', onSuccess: () => setDialog(null) })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const { appointment: a, patient, doctor, consultation, prescriptions } = q.data
  const isOwner = user?.roleId === 'DOCTOR' && user.doctorId === a.doctorId
  const upcoming = ['PENDING', 'CONFIRMED', 'SCHEDULED'].includes(a.status)
  const manage = can('appointments.manage')

  const reschedule = async () => {
    if (!start) return setRsError('Choose a new slot.')
    setRsPending(true)
    setRsError(undefined)
    try {
      await appointmentService.reschedule(a.id, date, start)
      invalidate()
      toast.success(`Rescheduled to ${formatDate(date)} at ${formatSlot(start)}`)
      setDialog(null)
    } catch (err) {
      setRsError(errorMessage(err))
      if (err instanceof ServiceError && err.code === 'SLOT_TAKEN') {
        setStart(undefined)
        setRefresh((n) => n + 1)
      }
    } finally {
      setRsPending(false)
    }
  }

  const start_ = async () => {
    setStarting(true)
    try {
      const room = await consultationService.start(a.id)
      invalidate()
      navigate(`/consultations/${room.consultation.id}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={a.appointmentNo}
        badge={<AppointmentStatusBadge status={a.status} />}
        description={`${a.date === todayISO() ? 'Today' : formatDate(a.date)}, ${formatSlot(a.start)} – ${formatSlot(a.end)} · ${CONSULTATION_TYPE_LABEL[a.type]} consultation`}
        breadcrumbs={[{ label: 'Appointments', to: '/appointments' }, { label: a.appointmentNo }]}
        actions={
          <>
            {manage && a.status === 'PENDING' && (
              <Button variant="outline" icon={<CalendarCheck className="h-4 w-4" />} loading={setStatus.pending} onClick={() => setStatus.run('CONFIRMED')}>
                Confirm
              </Button>
            )}
            {manage && (a.status === 'PENDING' || a.status === 'CONFIRMED') && (
              <Button variant="outline" icon={<CheckCircle2 className="h-4 w-4" />} loading={setStatus.pending} onClick={() => setStatus.run('SCHEDULED')}>
                Mark scheduled
              </Button>
            )}
            {manage && upcoming && (
              <>
                <Button
                  variant="outline"
                  icon={<CalendarClock className="h-4 w-4" />}
                  onClick={() => {
                    setDate(a.date >= todayISO() ? a.date : todayISO())
                    setStart(undefined)
                    setRsError(undefined)
                    setDialog('reschedule')
                  }}
                >
                  Reschedule
                </Button>
                <Button
                  variant="ghost"
                  icon={<CalendarX className="h-4 w-4" />}
                  onClick={() => {
                    setReason('')
                    setDialog('cancel')
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
            {manage && (a.status === 'CONFIRMED' || a.status === 'SCHEDULED') && `${a.date}T${a.end}` < nowLocal() && (
              <Button variant="ghost" icon={<UserX className="h-4 w-4" />} onClick={() => setStatus.run('NO_SHOW')}>
                No-show
              </Button>
            )}
            {isOwner && (a.status === 'CONFIRMED' || a.status === 'SCHEDULED') && a.date === todayISO() && (
              <Button icon={<Play className="h-4 w-4" />} loading={starting} onClick={() => void start_()}>
                Start consultation
              </Button>
            )}
            {consultation && (
              <Link to={`/consultations/${consultation.id}`}>
                <Button variant={a.status === 'IN_PROGRESS' ? 'primary' : 'outline'} icon={<Video className="h-4 w-4" />}>
                  {a.status === 'IN_PROGRESS' ? (isOwner ? 'Resume consultation' : 'View consultation') : 'Consultation record'}
                </Button>
              </Link>
            )}
            {isOwner && can('prescriptions.issue') && (a.status === 'IN_PROGRESS' || a.status === 'COMPLETED') && (
              <Link to={`/prescriptions/new?appointment=${a.id}&patient=${a.patientId}${consultation ? `&consultation=${consultation.id}` : ''}`}>
                <Button variant="outline" icon={<FileHeart className="h-4 w-4" />}>
                  Write prescription
                </Button>
              </Link>
            )}
          </>
        }
      />

      {patient.allergies.length > 0 && (
        <Alert tone="danger" className="mb-4" icon={<AlertTriangle className="h-4 w-4" />} title="Allergies">
          {patient.allergies.join(', ')}
        </Alert>
      )}
      {a.status === 'CANCELLED' && a.cancelReason && (
        <Alert tone="warning" className="mb-4" title="Cancelled">
          {a.cancelReason}
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Consultation details" />
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-3">
                <InfoRow label="Type" value={<ConsultationTypeBadge type={a.type} />} />
                <InfoRow label="Fee" value={formatINR(a.fee)} />
                <InfoRow label="Booked via" value={a.bookedVia === 'PORTAL' ? 'Patient portal' : 'Staff'} />
                <InfoRow label="Reason" value={a.reason} className="sm:col-span-3" />
                {a.symptoms && <InfoRow label="Symptoms" value={a.symptoms} className="sm:col-span-3" />}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Reports" description={a.reports.length ? `${a.reports.length} file(s) shared by the patient` : 'No reports uploaded'} />
            {a.reports.length > 0 && (
              <ul className="divide-y divide-ink-100 px-5 pb-4">
                {a.reports.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 py-2.5 text-[13px]">
                    <FileText className="h-4 w-4 text-brand-600" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-ink-400">{(f.size / 1024).toFixed(0)} KB · {formatDateTime(f.uploadedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {a.reports.length > 0 && <p className="px-5 pb-4 text-xs text-ink-400">File contents are stored in Decisions once integrated; demo mode keeps file names only.</p>}
          </Card>
          {prescriptions.length > 0 && (
            <Card>
              <CardHeader title="Prescriptions" />
              <ul className="divide-y divide-ink-100 px-5 pb-4">
                {prescriptions.map((r) => (
                  <li key={r.id}>
                    <Link to={`/prescriptions/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px] hover:text-brand-800">
                      <span>
                        <span className="font-mono font-semibold">{r.rxNo}</span> · {r.diagnosis}
                      </span>
                      <span className="flex gap-2">
                        {r.status === 'DRAFT' ? <Badge>Draft</Badge> : <FulfilmentBadge status={r.fulfilment} />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-ink-200 pl-5">
                {[...a.history].reverse().map((h, i) => (
                  <li key={`${h.at}-${i}`} className="relative">
                    <span className="absolute top-1 -left-[26px] h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
                    <div className="text-[13px] font-medium text-ink-900">{h.action}</div>
                    <div className="text-xs text-ink-500">
                      {formatDateTime(h.at)} · {h.by}
                      {h.note ? ` — ${h.note}` : ''}
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Patient" />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <PersonAvatar name={patient.name} />
                <div>
                  <div className="font-semibold text-ink-900">{patient.name}</div>
                  <div className="text-xs text-ink-500">
                    {patient.patientCode} · {ageFrom(patient.dateOfBirth)} yrs · {patient.gender.toLowerCase()}
                  </div>
                </div>
              </div>
              <dl className="grid gap-3 text-[13px]">
                {patient.bloodGroup && <InfoRow label="Blood group" value={patient.bloodGroup} />}
                <InfoRow label="Conditions" value={patient.conditions.length ? patient.conditions.join(', ') : 'None recorded'} />
              </dl>
              {can('patients.view') && (
                <Link to={`/patients/${patient.id}`} className="text-[13px] font-semibold text-brand-700 hover:underline">
                  Open patient record →
                </Link>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Doctor" />
            <CardBody>
              <Link to={`/doctors/${doctor.id}`} className="flex items-center gap-3 hover:text-brand-800">
                <PersonAvatar name={doctor.name} photoUrl={doctor.photoUrl} online={doctor.online} />
                <div>
                  <div className="font-semibold">{doctor.name}</div>
                  <div className="text-xs text-ink-500">{doctor.specialization}</div>
                </div>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        size="sm"
        title={`Cancel ${a.appointmentNo}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>Keep</Button>
            <Button variant="danger" disabled={!reason.trim()} loading={cancel.pending} onClick={() => cancel.run()}>Cancel appointment</Button>
          </>
        }
      >
        <Field label="Reason" required>{(fid) => <Textarea id={fid} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </Modal>

      <Modal
        open={dialog === 'reschedule'}
        onClose={() => setDialog(null)}
        dismissible={!rsPending}
        size="lg"
        title="Reschedule appointment"
        description={`${doctor.name} · currently ${formatDate(a.date)} at ${formatSlot(a.start)}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={rsPending}>Cancel</Button>
            <Button loading={rsPending} onClick={() => void reschedule()} disabled={!start}>Reschedule</Button>
          </>
        }
      >
        <div className="space-y-4">
          {rsError && <Alert tone="danger">{rsError}</Alert>}
          <DateStrip value={date} onChange={(d) => { setDate(d); setStart(undefined) }} />
          <SlotGrid doctorId={doctor.id} date={date} value={start} onChange={setStart} refreshKey={refresh} />
        </div>
      </Modal>
    </div>
  )
}
