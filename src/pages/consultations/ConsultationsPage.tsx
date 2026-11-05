import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Info, Play, Video } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage, invalidate, useQuery } from '../../hooks/useQuery'
import { appointmentService, clinicSettingsService, consultationService } from '../../services'
import { formatSlot } from '../../lib/clinic'
import { relativeTime } from '../../lib/dates'
import { cn } from '../../lib/utils'
import { useSessionStore } from '../../stores/sessionStore'
import type { AppointmentView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback'
import { AppointmentStatusBadge, ConsultationTypeBadge } from '../../components/clinic/ClinicBadges'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'

export default function ConsultationsPage() {
  const user = useSessionStore((s) => s.user)
  const isDoctor = user?.roleId === 'DOCTOR' && !!user.doctorId
  const navigate = useNavigate()
  const [startingId, setStartingId] = useState<string>()
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const today = useQuery(() => appointmentService.list({ view: 'TODAY', mine: isDoctor || undefined }), [isDoctor], { tags: ['customers', 'sales'] })
  const rows = (today.data ?? []).filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW')
  const live = rows.filter((a) => a.status === 'IN_PROGRESS')
  const queue = rows.filter((a) => a.status === 'CONFIRMED' || a.status === 'SCHEDULED' || a.status === 'PENDING')
  const done = rows.filter((a) => a.status === 'COMPLETED')

  const start = async (a: AppointmentView) => {
    setStartingId(a.id)
    try {
      const room = await consultationService.start(a.id)
      invalidate()
      navigate(`/consultations/${room.consultation.id}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setStartingId(undefined)
    }
  }

  const renderRow = (a: AppointmentView) => {
    const owner = isDoctor && user?.doctorId === a.doctorId
    return (
      <li key={a.id} className={cn('flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center', a.status === 'IN_PROGRESS' && 'bg-violet-50/40')}>
        <span className="num w-20 shrink-0 text-[13px] font-semibold text-ink-700">{formatSlot(a.start)}</span>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <PersonAvatar name={a.patientName} size="sm" />
          <div className="min-w-0">
            <Link to={`/appointments/${a.id}`} className="block truncate text-[13px] font-semibold text-ink-900 hover:text-brand-700">
              {a.patientName}
            </Link>
            <div className="truncate text-xs text-ink-500">
              {a.reason}
              {!isDoctor && ` · ${a.doctorName}`}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ConsultationTypeBadge type={a.type} />
          <AppointmentStatusBadge status={a.status} />
          {a.consultationId ? (
            <Link to={`/consultations/${a.consultationId}`}>
              <Button size="sm" variant={a.status === 'IN_PROGRESS' && owner ? 'primary' : 'outline'} icon={<Video className="h-3.5 w-3.5" />}>
                {a.status === 'IN_PROGRESS' ? (owner ? 'Resume' : 'View') : 'Record'}
              </Button>
            </Link>
          ) : (
            owner &&
            (a.status === 'CONFIRMED' || a.status === 'SCHEDULED') && (
              <Button size="sm" icon={<Play className="h-3.5 w-3.5" />} loading={startingId === a.id} onClick={() => void start(a)}>
                Start
              </Button>
            )
          )}
        </div>
      </li>
    )
  }

  return (
    <div>
      <PageHeader
        title="Online consultations"
        description={isDoctor ? 'Your consultation queue for today.' : 'Consultations in progress and scheduled for today across all doctors.'}
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Healthcare' }, { label: 'Consultations' }]}
      />
      {settings.data?.videoProvider === 'NONE' && (
        <Alert tone="info" className="mb-5" icon={<Info className="h-4 w-4" />} title="No video provider configured">
          Consultations run in demo mode: chat, notes, files and prescriptions work, but no live audio/video is connected. Configure Jitsi or another approved provider in Settings to enable calls.
        </Alert>
      )}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="In progress" value={today.data ? live.length : '…'} tone="violet" />
        <StatCard label="Waiting" value={today.data ? queue.length : '…'} tone="amber" />
        <StatCard label="Completed today" value={today.data ? done.length : '…'} />
      </div>
      {!today.data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Video className="h-5 w-5" />} title="No consultations today" description="Booked appointments for today will appear here." />
        </Card>
      ) : (
        <div className="space-y-4">
          {[
            { title: 'In progress', list: live },
            { title: 'Queue', list: queue },
            { title: 'Completed', list: done },
          ]
            .filter((g) => g.list.length > 0)
            .map((g) => (
              <Card key={g.title}>
                <CardHeader title={g.title} description={`${g.list.length} consultation(s) · updated ${relativeTime(new Date().toISOString())}`} />
                <ul className="divide-y divide-ink-100 border-t border-ink-100">
                  {g.list.map(renderRow)}
                </ul>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
