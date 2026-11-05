import { useState } from 'react'
import { useParams } from 'react-router'
import { BadgeCheck, CalendarPlus, Clock, Languages, Pencil, Star, Wifi, WifiOff } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { doctorService } from '../../services'
import { DAY_NAMES, formatSlot } from '../../lib/clinic'
import { formatDate, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ErrorState, PageLoader } from '../../components/ui/Feedback'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { ConsultationTypeBadge } from '../../components/clinic/ClinicBadges'
import { DateStrip, SlotGrid } from '../appointments/SlotGrid'
import { BookAppointmentModal } from '../appointments/BookAppointmentModal'
import { DoctorFormModal } from './DoctorFormModal'

export default function DoctorProfilePage() {
  const { id } = useParams()
  const can = useCan()
  const user = useSessionStore((s) => s.user)
  const [date, setDate] = useState(todayISO())
  const [booking, setBooking] = useState(false)
  const [editing, setEditing] = useState(false)
  const q = useQuery(() => doctorService.get(id!), [id], { tags: ['users', 'customers'] })
  const toggle = useMutation((online: boolean) => doctorService.setOnline(id!, online), { successMessage: (d) => (d.online ? 'Now shown as available online' : 'Now shown as offline') })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const { doctor: d, reviews, upcomingCount, completedCount } = q.data
  const isSelf = user?.doctorId === d.id
  const byDay = DAY_NAMES.map((name, day) => ({ name, blocks: d.schedule.filter((s) => s.day === day) }))

  return (
    <div>
      <PageHeader
        title={d.name}
        breadcrumbs={[{ label: 'Doctors', to: '/doctors' }, { label: d.name }]}
        badge={d.online ? <Badge tone="success" dot>Available online</Badge> : <Badge dot>Offline</Badge>}
        actions={
          <>
            {(isSelf || can('doctors.manage')) && (
              <Button variant="outline" icon={d.online ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />} loading={toggle.pending} onClick={() => toggle.run(!d.online)}>
                {d.online ? 'Go offline' : 'Go online'}
              </Button>
            )}
            {can('doctors.manage') && (
              <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can('appointments.manage') && (
              <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setBooking(true)}>
                Book appointment
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 overflow-hidden rounded-3xl brand-gradient p-6 text-white shadow-raised sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <PersonAvatar name={d.name} photoUrl={d.photoUrl} size="xl" online={d.online} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-accent-300">{d.specialization}</div>
            <div className="mt-1 font-display text-2xl font-bold">{d.name}</div>
            <div className="text-sm text-brand-100/85">{d.qualifications}</div>
            <p className="mt-3 max-w-2xl text-sm text-brand-100/80">{d.bio}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {d.consultationTypes.map((t) => (
                <ConsultationTypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/15">
            <div className="text-xs text-brand-100/80">Consultation fee</div>
            <div className="num font-display text-2xl font-bold">{formatINR(d.consultationFee)}</div>
            <div className="mt-1 text-xs text-brand-100/70">{d.slotMinutes} min slots</div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Experience" value={`${d.experienceYears} yrs`} icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard label="Free slots today" value={d.todaySlotsFree} icon={<Clock className="h-4 w-4" />} tone="blue" />
        <StatCard label="Upcoming appointments" value={upcomingCount} icon={<CalendarPlus className="h-4 w-4" />} tone="violet" />
        <StatCard label="Rating" value={d.reviewCount > 0 && d.rating !== undefined ? `${d.rating.toFixed(1)} ★` : '—'} icon={<Star className="h-4 w-4" />} tone="amber" footer={d.reviewCount > 0 ? `${d.reviewCount} reviews · ${completedCount} consultations` : `${completedCount} consultations · no reviews yet`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Book a slot" description="Live availability — booked and past slots are disabled." />
            <CardBody className="space-y-4">
              <DateStrip value={date} onChange={setDate} />
              <SlotGrid doctorId={d.id} date={date} readOnly={!can('appointments.manage')} onChange={() => setBooking(true)} />
              {!can('appointments.manage') && <p className="text-xs text-ink-500">Your role can view availability but not book.</p>}
            </CardBody>
          </Card>
          {reviews.length > 0 && (
            <Card>
              <CardHeader title="Patient reviews" description={`${reviews.length} verified reviews from completed consultations`} />
              <ul className="divide-y divide-ink-100 px-5 pb-4">
                {reviews.slice(0, 8).map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-800">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-[11px] text-ink-600">{r.patientInitials}</span>
                        <span className="text-accent-500">{'★'.repeat(r.rating)}<span className="text-ink-200">{'★'.repeat(5 - r.rating)}</span></span>
                      </span>
                      <span className="text-xs text-ink-400">{formatDate(r.date)}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-600">{r.comment}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Weekly availability" />
            <CardBody>
              <ul className="space-y-2">
                {byDay.map((day) => (
                  <li key={day.name} className="flex items-start justify-between gap-3 text-[13px]">
                    <span className="w-10 font-semibold text-ink-700">{day.name}</span>
                    <span className="flex flex-1 flex-wrap justify-end gap-1.5">
                      {day.blocks.length === 0 ? (
                        <span className="text-ink-300">Unavailable</span>
                      ) : (
                        day.blocks.map((b) => (
                          <span key={`${b.start}`} className="num rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                            {formatSlot(b.start)} – {formatSlot(b.end)}
                          </span>
                        ))
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Registration & practice" />
            <CardBody>
              <dl className="grid gap-3">
                <InfoRow label="Registration no." value={<span className="font-mono">{d.registrationNo}</span>} />
                <InfoRow label="Council" value={d.registrationCouncil} />
                <InfoRow label="Affiliation" value={d.affiliation} />
                <InfoRow label="Languages" value={<span className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5 text-ink-400" />{d.languages.join(', ')}</span>} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
      <BookAppointmentModal open={booking} onClose={() => setBooking(false)} doctorId={d.id} />
      <DoctorFormModal open={editing} onClose={() => setEditing(false)} doctor={d} />
    </div>
  )
}
