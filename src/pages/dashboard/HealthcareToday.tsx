import { Link } from 'react-router'
import { ArrowRight, BedDouble, CalendarClock, CalendarPlus, FileHeart, Hospital, LogOut, Users } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { admissionService, appointmentService, clinicSettingsService } from '../../services'
import { formatSlot } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import { useCan } from '../../stores/sessionStore'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { EmptyState, Skeleton } from '../../components/ui/Feedback'
import { SegmentedBar, SERIES } from '../../components/charts/Charts'
import { AppointmentStatusBadge, ConsultationTypeBadge } from '../../components/clinic/ClinicBadges'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'

type Tone = 'brand' | 'amber' | 'violet' | 'blue' | 'red'
const TONE: Record<Tone, string> = { brand: 'text-brand-700 bg-brand-50', amber: 'text-amber-700 bg-amber-50', violet: 'text-violet-700 bg-violet-50', blue: 'text-sky-700 bg-sky-50', red: 'text-red-600 bg-red-50' }

export function ClinicTile({ label, value, sub, icon, to, tone }: { label: string; value: React.ReactNode; sub: string; icon: React.ReactNode; to?: string; tone: Tone }) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', TONE[tone])}>{icon}</span>
        <span className="text-xs font-medium text-ink-500">{label}</span>
      </div>
      <div className="num mt-2 font-display text-xl font-bold text-ink-950">{value}</div>
      <div className="truncate text-[11px] text-ink-500">{sub}</div>
    </>
  )
  const cls = 'block rounded-2xl border border-ink-200/70 bg-white p-4 shadow-card'
  return to ? (
    <Link to={to} className={cn(cls, 'transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Today's clinic activity: tiles, today's appointments and bed occupancy. */
export function HealthcareToday({ mine }: { mine?: boolean }) {
  const can = useCan()
  const canAppt = can('appointments.view')
  const canAdm = can('admissions.view')
  const snap = useQuery(() => clinicSettingsService.snapshot(), [], { tags: ['customers', 'sales', 'inventory'] })
  const today = useQuery(() => appointmentService.list({ view: 'TODAY', mine }), [mine], { enabled: canAppt, tags: ['customers'] })
  const inpatient = useQuery(() => admissionService.dashboard(), [], { enabled: canAdm, tags: ['customers'] })
  const s = snap.data
  const beds = inpatient.data?.beds

  return (
    <section className="space-y-4" aria-labelledby="hc-today">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="hc-today" className="font-display text-lg font-semibold text-ink-900">
            Healthcare today
          </h2>
          <p className="text-[13px] text-ink-500">Clinic appointments, inpatients and pending work</p>
        </div>
      </div>
      {!s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
          <ClinicTile label="Appointments today" value={s.appointmentsToday} sub="excluding cancelled" icon={<CalendarClock className="h-4 w-4" />} tone="brand" to={canAppt ? '/appointments' : undefined} />
          <ClinicTile label="Pending bookings" value={s.pendingAppointments} sub="awaiting confirmation" icon={<CalendarPlus className="h-4 w-4" />} tone="amber" to={canAppt ? '/appointments' : undefined} />
          <ClinicTile label="Inpatients" value={s.inpatients} sub="currently admitted" icon={<Hospital className="h-4 w-4" />} tone="violet" to={canAdm ? '/inpatients' : undefined} />
          <ClinicTile label="Admission requests" value={s.pendingAdmissions} sub="to approve" icon={<Users className="h-4 w-4" />} tone="blue" to={canAdm ? '/admissions' : undefined} />
          <ClinicTile label="Discharges" value={s.pendingDischarges} sub="in progress" icon={<LogOut className="h-4 w-4" />} tone="amber" to={canAdm ? '/discharges' : undefined} />
          <ClinicTile label="Prescriptions" value={s.rxToFulfil} sub="to fulfil at pharmacy" icon={<FileHeart className="h-4 w-4" />} tone="red" to={can('prescriptions.view') ? '/prescriptions' : undefined} />
        </div>
      )}

      <div className={cn('grid gap-4', canAppt && canAdm && 'xl:grid-cols-3')}>
        {canAppt && (
          <Card className={cn(canAdm && 'xl:col-span-2')}>
            <CardHeader
              title={mine ? 'My appointments today' : 'Today’s appointments'}
              icon={<CalendarClock className="h-4 w-4" />}
              action={
                <Link to="/appointments" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
                  All appointments <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            {!today.data ? (
              <CardBody>
                <Skeleton className="h-40 rounded-xl" />
              </CardBody>
            ) : today.data.length === 0 ? (
              <EmptyState compact icon={<CalendarClock className="h-5 w-5" />} title="No appointments today" />
            ) : (
              <ul className="divide-y divide-ink-100 px-2 pb-2">
                {today.data.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <Link to={`/appointments/${a.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-ink-50">
                      <span className="num w-16 shrink-0 text-[13px] font-semibold text-ink-900">{formatSlot(a.start)}</span>
                      <PersonAvatar name={a.patientName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink-900">{a.patientName}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {mine ? a.reason : `${a.doctorName} · ${a.specialization}`}
                        </span>
                      </span>
                      <span className="hidden sm:block">
                        <ConsultationTypeBadge type={a.type} />
                      </span>
                      <AppointmentStatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {canAdm && (
          <Card>
            <CardHeader
              title="Bed occupancy"
              icon={<BedDouble className="h-4 w-4" />}
              description={inpatient.data ? `${inpatient.data.occupancyPct}% of in-service beds in use` : undefined}
              action={
                can('beds.view') && (
                  <Link to="/rooms" className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                    Rooms →
                  </Link>
                )
              }
            />
            <CardBody>
              {!beds ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : (
                <SegmentedBar
                  format={(v) => `${v} bed${v === 1 ? '' : 's'}`}
                  parts={[
                    { label: 'Available', value: beds.available, color: SERIES[0] },
                    { label: 'Occupied', value: beds.occupied, color: SERIES[1] },
                    { label: 'Reserved', value: beds.reserved, color: SERIES[4] },
                    { label: 'Maintenance', value: beds.maintenance, color: '#b1bccb' },
                  ]}
                />
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </section>
  )
}
