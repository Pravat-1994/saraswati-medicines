import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, FileHeart, FileText, Mic, MicOff, Paperclip, PhoneOff, Send, Timer, User, Video, VideoOff } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useMutation, useQuery } from '../../hooks/useQuery'
import { consultationService } from '../../services'
import { CONSULTATION_TYPE_LABEL, ageFrom, formatSlot } from '../../lib/clinic'
import { formatDate, formatDateTime, formatTime } from '../../lib/dates'
import { cn } from '../../lib/utils'
import { useSessionStore } from '../../stores/sessionStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Tabs } from '../../components/ui/Tabs'
import { Textarea } from '../../components/ui/Form'
import { ConsultationTypeBadge, FulfilmentBadge } from '../../components/clinic/ClinicBadges'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'

type Panel = 'chat' | 'files' | 'notes' | 'patient'

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

const duration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ConsultationRoomPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const q = useQuery(() => consultationService.get(id!), [id], { tags: ['customers', 'sales'] })
  const [panel, setPanel] = useState<Panel>('chat')
  const [text, setText] = useState('')
  const [notes, setNotes] = useState<string>()
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ended, setEnded] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const c = q.data?.consultation
  const live = c?.status === 'IN_PROGRESS'
  const now = useNow(!!live)

  const send = useMutation((t: string, file?: { name: string; size: number; type: string }) => consultationService.postMessage(id!, t, file), { onSuccess: () => setText('') })
  const saveNotes = useMutation((n: string) => consultationService.saveNotes(id!, n), { successMessage: 'Notes saved' })
  const end = useMutation((n: string) => consultationService.end(id!, n), {
    successMessage: 'Consultation completed',
    onSuccess: () => {
      setConfirmEnd(false)
      setEnded(true)
    },
  })

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [c?.messages.length])

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data || !c) return <PageLoader />
  const { appointment: a, patient, doctor, prescriptions, video } = q.data
  const isOwner = user?.roleId === 'DOCTOR' && user.doctorId === c.doctorId
  const canAct = isOwner && live
  const noteValue = notes ?? c.notes
  const elapsed = (c.endedAt ? new Date(c.endedAt).getTime() : now) - new Date(c.startedAt).getTime()

  const attach = async (f?: File) => {
    if (!f) return
    try {
      await consultationService.postMessage(id!, `Shared ${f.name}`, { name: f.name, size: f.size, type: f.type })
      invalidate()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title={`Consultation · ${patient.name}`}
        badge={live ? <Badge tone="violet" dot>In progress</Badge> : <Badge tone="success" dot>Completed</Badge>}
        description={`${a.appointmentNo} · ${formatDate(a.date)} ${formatSlot(a.start)} · ${CONSULTATION_TYPE_LABEL[c.type]} with ${doctor.name}`}
        breadcrumbs={[{ label: 'Consultations', to: '/consultations' }, { label: a.appointmentNo }]}
        actions={
          <>
            <span className="num inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-3 py-2 text-sm font-semibold text-white" aria-label="Consultation duration">
              <Timer className="h-4 w-4 text-accent-300" /> {duration(elapsed)}
            </span>
            {isOwner && (
              <Link to={`/prescriptions/new?appointment=${a.id}&consultation=${c.id}&patient=${patient.id}`}>
                <Button variant="outline" icon={<FileHeart className="h-4 w-4" />}>
                  Write prescription
                </Button>
              </Link>
            )}
            {canAct && (
              <Button variant="danger" icon={<PhoneOff className="h-4 w-4" />} onClick={() => setConfirmEnd(true)}>
                End consultation
              </Button>
            )}
          </>
        }
      />
      {!isOwner && live && (
        <Alert tone="info" className="mb-4">
          You are viewing this consultation read-only. Only {doctor.name} can conduct it.
        </Alert>
      )}
      {patient.allergies.length > 0 && (
        <Alert tone="danger" className="mb-4" icon={<AlertTriangle className="h-4 w-4" />} title="Allergies">
          {patient.allergies.join(', ')}
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-ink-950 shadow-raised">
            {c.type === 'IN_PERSON' ? (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <User className="h-10 w-10 text-brand-300" />
                <div className="font-display text-lg font-semibold">In-person consultation</div>
                <p className="max-w-md text-sm text-ink-300">The patient is seen at the clinic. Use chat for shared files and the notes panel for clinical notes.</p>
              </div>
            ) : video.url && live ? (
              <>
                <iframe title="Video consultation" src={video.url} allow="camera; microphone; fullscreen; display-capture" className="aspect-video w-full border-0" />
                <div className="absolute top-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white">Video via {video.provider === 'JITSI' ? 'Jitsi' : 'configured provider'} — connection is managed by the provider</div>
              </>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <div className="rounded-full bg-accent-400/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent-300 uppercase">Demo mode</div>
                <VideoOff className="h-10 w-10 text-ink-400" />
                <div className="font-display text-lg font-semibold">{live ? 'No video provider configured' : 'Consultation ended'}</div>
                <p className="max-w-md text-sm text-ink-300">
                  {live
                    ? 'No call is connected. Configure Jitsi or another approved provider in Settings → Clinic to enable secure audio/video. Chat, files and notes below work in demo mode.'
                    : `This ${CONSULTATION_TYPE_LABEL[c.type].toLowerCase()} consultation lasted ${duration(elapsed)}.`}
                </p>
              </div>
            )}
            {live && c.type !== 'IN_PERSON' && (
              <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-ink-900 px-4 py-3">
                <button type="button" onClick={() => setMic((v) => !v)} aria-pressed={!mic} className={cn('flex h-11 w-11 items-center justify-center rounded-full transition', mic ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-600 text-white')} aria-label={mic ? 'Mute microphone (local)' : 'Unmute microphone (local)'}>
                  {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>
                {c.type === 'VIDEO' && (
                  <button type="button" onClick={() => setCam((v) => !v)} aria-pressed={!cam} className={cn('flex h-11 w-11 items-center justify-center rounded-full transition', cam ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-600 text-white')} aria-label={cam ? 'Turn camera off (local)' : 'Turn camera on (local)'}>
                    {cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </button>
                )}
                {canAct && (
                  <button type="button" onClick={() => setConfirmEnd(true)} className="flex h-11 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700">
                    <PhoneOff className="h-4 w-4" /> End
                  </button>
                )}
                <span className="ml-2 hidden text-[11px] text-ink-400 sm:inline">Local controls{video.url ? '' : ' — no call connected'}</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Patient" />
              <CardBody>
                <div className="mb-3 flex items-center gap-3">
                  <PersonAvatar name={patient.name} />
                  <div>
                    <div className="font-semibold text-ink-900">{patient.name}</div>
                    <div className="text-xs text-ink-500">
                      {patient.patientCode} · {ageFrom(patient.dateOfBirth)} yrs · {patient.gender.toLowerCase()}
                    </div>
                  </div>
                </div>
                <dl className="grid gap-2 text-[13px]">
                  <InfoRow label="Reason" value={a.reason} />
                  {a.symptoms && <InfoRow label="Symptoms" value={a.symptoms} />}
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Appointment" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <InfoRow label="Type" value={<ConsultationTypeBadge type={c.type} />} />
                  <InfoRow label="Started" value={formatTime(c.startedAt)} />
                  <InfoRow label="Doctor" value={doctor.name} />
                  <InfoRow label="Ended" value={c.endedAt ? formatTime(c.endedAt) : '—'} />
                </dl>
                {prescriptions.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
                    {prescriptions.map((r) => (
                      <Link key={r.id} to={`/prescriptions/${r.id}`} className="flex items-center justify-between text-[13px] hover:text-brand-700">
                        <span className="font-mono font-semibold">{r.rxNo}</span>
                        {r.status === 'DRAFT' ? <Badge>Draft</Badge> : <FulfilmentBadge status={r.fulfilment} />}
                      </Link>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        <Card className="flex flex-col xl:h-[calc(100vh-12rem)] xl:min-h-[560px]">
          <Tabs
            className="px-3 pt-1"
            value={panel}
            onChange={setPanel}
            items={[
              { key: 'chat', label: 'Chat', count: c.messages.filter((m) => m.from !== 'SYSTEM').length },
              { key: 'files', label: 'Files', count: c.files.length },
              { key: 'notes', label: 'Notes' },
              { key: 'patient', label: 'History' },
            ]}
          />
          {panel === 'chat' && (
            <>
              <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 280 }}>
                {c.messages.map((m) =>
                  m.from === 'SYSTEM' ? (
                    <div key={m.id} className="text-center text-[11px] text-ink-400">
                      {m.text} · {formatTime(m.at)}
                    </div>
                  ) : (
                    <div key={m.id} className={cn('flex flex-col', m.from === 'DOCTOR' ? 'items-end' : 'items-start')}>
                      <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px]', m.from === 'DOCTOR' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-ink-100 text-ink-900')}>
                        {m.text}
                        {m.file && (
                          <div className={cn('mt-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs', m.from === 'DOCTOR' ? 'bg-white/15' : 'bg-white')}>
                            <FileText className="h-3.5 w-3.5" /> {m.file.name}
                          </div>
                        )}
                      </div>
                      <span className="mt-0.5 text-[10px] text-ink-400">
                        {m.author} · {formatTime(m.at)}
                      </span>
                    </div>
                  ),
                )}
                <div ref={chatEnd} />
              </div>
              {canAct ? (
                <form
                  className="flex items-center gap-2 border-t border-ink-100 p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (text.trim()) void send.run(text)
                  }}
                >
                  <label className="cursor-pointer rounded-lg p-2 text-ink-500 hover:bg-ink-100" title="Share a file">
                    <Paperclip className="h-4 w-4" />
                    <span className="sr-only">Attach file</span>
                    <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void attach(e.target.files?.[0])} />
                  </label>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the patient…" aria-label="Message" className="h-10 flex-1 rounded-xl border border-ink-200 px-3 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none" />
                  <Button type="submit" size="icon" aria-label="Send" loading={send.pending} disabled={!text.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <p className="border-t border-ink-100 p-3 text-center text-xs text-ink-400">{live ? 'Read-only' : 'Consultation ended — chat is closed.'}</p>
              )}
            </>
          )}
          {panel === 'files' && (
            <div className="flex-1 overflow-y-auto p-4">
              {c.files.length === 0 ? (
                <EmptyState compact title="No files shared" description="Reports uploaded at booking and files shared in chat appear here." />
              ) : (
                <ul className="space-y-2">
                  {c.files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2.5 text-[13px]">
                      <FileText className="h-4 w-4 text-brand-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{f.name}</span>
                        <span className="text-xs text-ink-500">
                          {(f.size / 1024).toFixed(0)} KB · {f.uploadedBy} · {formatDateTime(f.uploadedAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink-400">Demo mode stores file names only; Decisions FileReferenceService will hold the files with access control.</p>
            </div>
          )}
          {panel === 'notes' && (
            <div className="flex flex-1 flex-col gap-2 p-4">
              <Textarea
                aria-label="Consultation notes"
                rows={12}
                className="flex-1"
                value={noteValue}
                readOnly={!canAct}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (canAct && notes !== undefined && notes !== c.notes) void saveNotes.run(notes)
                }}
                placeholder={canAct ? 'History, examination findings, advice… (saved when you leave the field)' : 'No notes recorded.'}
              />
              <p className="text-xs text-ink-400">{canAct ? (saveNotes.pending ? 'Saving…' : 'Autosaves on blur.') : 'Read-only.'}</p>
            </div>
          )}
          {panel === 'patient' && (
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-[13px]">
              <InfoRow label="Allergies" value={patient.allergies.length ? <span className="font-semibold text-red-700">{patient.allergies.join(', ')}</span> : 'No known allergies'} />
              <InfoRow label="Conditions" value={patient.conditions.length ? patient.conditions.join(', ') : 'None recorded'} />
              <InfoRow label="Blood group" value={patient.bloodGroup} />
              <InfoRow label="History" value={patient.history ?? 'Not recorded'} />
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => end.run(noteValue)}
        loading={end.pending}
        tone="primary"
        title="End this consultation?"
        confirmLabel="End consultation"
        message="The appointment will be marked completed and the consultation fee posted to the patient’s OPD account. Your notes will be saved."
      />
      <Modal
        open={ended}
        onClose={() => setEnded(false)}
        size="sm"
        title="Consultation completed"
        footer={
          <>
            <Button variant="outline" onClick={() => setEnded(false)}>
              Later
            </Button>
            <Button icon={<FileHeart className="h-4 w-4" />} onClick={() => navigate(`/prescriptions/new?appointment=${a.id}&consultation=${c.id}&patient=${patient.id}`)}>
              Write prescription
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">Would you like to write a prescription for {patient.name} now?</p>
      </Modal>
    </div>
  )
}
