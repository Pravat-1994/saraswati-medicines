import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CalendarDays, CalendarPlus, List } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { appointmentService, doctorService, patientService } from '../../services'
import { APPOINTMENT_STATUS_LABEL, formatSlot } from '../../lib/clinic'
import { formatDate, todayISO } from '../../lib/dates'
import { cn } from '../../lib/utils'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import type { AppointmentStatus, ConsultationType } from '../../types/clinic'
import type { AppointmentFilters, AppointmentView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { Tabs } from '../../components/ui/Tabs'
import { Switch, Input, Select } from '../../components/ui/Form'
import { EmptyState, Skeleton } from '../../components/ui/Feedback'
import { AppointmentStatusBadge, ConsultationTypeBadge } from '../../components/clinic/ClinicBadges'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { BookAppointmentModal } from './BookAppointmentModal'

type View = NonNullable<AppointmentFilters['view']>
const STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']

export default function AppointmentsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const can = useCan()
  const user = useSessionStore((s) => s.user)
  const isDoctor = user?.roleId === 'DOCTOR' && !!user.doctorId
  const view = (params.get('tab') as View) ?? 'TODAY'
  const [mode, setMode] = useState<'list' | 'calendar'>('list')
  const [mine, setMine] = useState(isDoctor)
  const [search, setSearch] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [type, setType] = useState<ConsultationType | ''>('')
  // Deep link from patient profile / clinical home: /appointments?new=1&patient=<id>
  const [booking, setBooking] = useState(() => params.get('new') === '1' && can('appointments.manage'))
  const presetPatientId = params.get('patient') ?? undefined
  const presetPatient = useQuery(() => patientService.profile(presetPatientId!), [presetPatientId], { enabled: !!presetPatientId && booking })
  const debounced = useDebounced(search)
  const doctors = useQuery(() => doctorService.list({}), [], { tags: ['users'] })
  const filters: AppointmentFilters = { view, mine: mine || undefined, doctorId: doctorId || undefined, status: status || 'ALL', type: type || 'ALL', search: debounced || undefined }
  const list = useQuery(() => appointmentService.list(filters), [JSON.stringify(filters)], { tags: ['customers', 'sales'] })

  const columns: Column<AppointmentView>[] = [
    {
      key: 'when',
      header: 'When',
      sortable: true,
      sortValue: (a) => `${a.date}${a.start}`,
      cell: (a) => (
        <div>
          <div className="font-semibold text-ink-900">{a.date === todayISO() ? 'Today' : formatDate(a.date)}</div>
          <div className="num text-xs text-ink-500">
            {formatSlot(a.start)} – {formatSlot(a.end)}
          </div>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      sortable: true,
      sortValue: (a) => a.patientName,
      cell: (a) => (
        <div>
          <div className="font-medium text-ink-900">{a.patientName}</div>
          <div className="font-mono text-[11px] text-ink-500">{a.patientCode}</div>
        </div>
      ),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      hideBelow: 'md',
      cell: (a) => (
        <div>
          <div className="text-ink-800">{a.doctorName}</div>
          <div className="text-xs text-ink-500">{a.specialization}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', hideBelow: 'sm', cell: (a) => <ConsultationTypeBadge type={a.type} /> },
    { key: 'reason', header: 'Reason', hideBelow: 'xl', cell: (a) => <span className="line-clamp-1 text-ink-600">{a.reason}</span> },
    { key: 'no', header: 'Booking', hideBelow: 'lg', cell: (a) => <span className="font-mono text-xs text-ink-500">{a.appointmentNo}</span> },
    { key: 'status', header: 'Status', cell: (a) => <AppointmentStatusBadge status={a.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Schedule, confirm and track consultations across doctors."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Healthcare' }, { label: 'Appointments' }]}
        actions={
          <>
            <div className="flex rounded-xl bg-ink-100/80 p-1" role="group" aria-label="View mode">
              {(['list', 'calendar'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium', mode === m ? 'bg-white shadow-sm' : 'text-ink-500')}>
                  {m === 'list' ? <List className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />} {m === 'list' ? 'List' : 'Day view'}
                </button>
              ))}
            </div>
            {can('appointments.manage') && (
              <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setBooking(true)}>
                New appointment
              </Button>
            )}
          </>
        }
      />
      {mode === 'calendar' ? (
        <DayView defaultDoctor={isDoctor ? user?.doctorId : undefined} />
      ) : (
        <Card>
          <Tabs
            className="px-4 pt-1"
            value={view}
            onChange={(k) => setParams({ tab: k }, { replace: true })}
            items={[
              { key: 'TODAY', label: 'Today' },
              { key: 'UPCOMING', label: 'Upcoming' },
              { key: 'PAST', label: 'Past' },
              { key: 'ALL', label: 'All' },
            ]}
          />
          <FilterBar
            active={!!(search || doctorId || status || type)}
            onReset={() => {
              setSearch('')
              setDoctorId('')
              setStatus('')
              setType('')
            }}
            actions={isDoctor && <div className="w-56"><Switch checked={mine} onChange={setMine} label="My appointments" /></div>}
          >
            <SearchInput value={search} onChange={setSearch} placeholder="Patient, ID, doctor or booking no." />
            {!mine && <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />}
            <FilterSelect label="Status" value={status} onChange={(v) => setStatus(v as AppointmentStatus | '')} options={STATUSES.map((s) => ({ value: s, label: APPOINTMENT_STATUS_LABEL[s] }))} />
            <FilterSelect
              label="Type"
              value={type}
              onChange={(v) => setType(v as ConsultationType | '')}
              options={[
                { value: 'VIDEO', label: 'Video' },
                { value: 'AUDIO', label: 'Audio' },
                { value: 'IN_PERSON', label: 'In-person' },
              ]}
            />
          </FilterBar>
          <DataTable
            caption="Appointments"
            columns={columns}
            rows={list.data}
            rowKey={(a) => a.id}
            loading={list.fetching}
            error={list.error}
            onRetry={list.refetch}
            pageSize={15}
            onRowClick={(a) => navigate(`/appointments/${a.id}`)}
            rowClassName={(a) => (a.status === 'IN_PROGRESS' ? 'bg-violet-50/40' : a.status === 'PENDING' ? 'bg-accent-50/40' : undefined)}
            empty={<EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No appointments" description="Change the tab or filters, or book a new appointment." />}
          />
        </Card>
      )}
      <BookAppointmentModal
        key={presetPatient.data?.patient.id ?? 'none'}
        open={booking && (!presetPatientId || !!presetPatient.data || !!presetPatient.error)}
        patient={presetPatient.data?.patient}
        onClose={() => {
          setBooking(false)
          if (params.has('new') || params.has('patient')) setParams((p) => {
            p.delete('new')
            p.delete('patient')
            return p
          }, { replace: true })
        }}
        onBooked={(a) => navigate(`/appointments/${a.id}`)}
      />
    </div>
  )
}

function DayView({ defaultDoctor }: { defaultDoctor?: string }) {
  const doctors = useQuery(() => doctorService.list({}), [], { tags: ['users'] })
  const [doctorId, setDoctorId] = useState(defaultDoctor ?? '')
  const [date, setDate] = useState(todayISO())
  const effective = doctorId || doctors.data?.[0]?.id || ''
  const slots = useQuery(() => doctorService.slots(effective, date), [effective, date], { enabled: !!effective, tags: ['customers'] })
  const appts = useQuery(() => appointmentService.list({ view: 'ALL', doctorId: effective }), [effective], { enabled: !!effective, tags: ['customers'] })
  const doctor = doctors.data?.find((d) => d.id === effective)
  const dayAppts = (appts.data ?? []).filter((a) => a.date === date)

  return (
    <Card>
      <CardHeader
        title="Day view"
        description="Each row is a bookable slot. Booked slots show the patient."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Doctor" selectSize="sm" value={effective} onChange={(e) => setDoctorId(e.target.value)} options={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }))} className="w-56" />
            <Input aria-label="Date" inputSize="sm" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
          </div>
        }
      />
      <CardBody>
        {doctor && (
          <div className="mb-4 flex items-center gap-3">
            <PersonAvatar name={doctor.name} photoUrl={doctor.photoUrl} size="sm" online={doctor.online} />
            <div className="text-[13px]">
              <div className="font-semibold text-ink-900">{doctor.name}</div>
              <div className="text-ink-500">
                {doctor.specialization} · {formatDate(date)}
              </div>
            </div>
          </div>
        )}
        {slots.loading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (slots.data ?? []).length === 0 ? (
          <EmptyState compact title="No availability" description="The doctor is not scheduled on this day." />
        ) : (
          <ol className="divide-y divide-ink-100 rounded-xl border border-ink-100">
            {(slots.data ?? []).map((s) => {
              const a = dayAppts.find((x) => x.start === s.start && x.status !== 'CANCELLED')
              return (
                <li key={s.start} className={cn('flex items-center gap-4 px-4 py-2.5', a && 'bg-brand-50/30')}>
                  <span className="num w-20 shrink-0 text-[13px] font-semibold text-ink-700">{formatSlot(s.start)}</span>
                  {a ? (
                    <Link to={`/appointments/${a.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg hover:text-brand-800">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink-900">{a.patientName}</span>
                        <span className="block truncate text-xs text-ink-500">{a.reason}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <ConsultationTypeBadge type={a.type} />
                        <AppointmentStatusBadge status={a.status} />
                      </span>
                    </Link>
                  ) : (
                    <span className={cn('text-[13px]', s.available ? 'text-emerald-700' : 'text-ink-300')}>{s.available ? 'Available' : s.reason === 'PAST' ? 'Past' : 'Booked'}</span>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
