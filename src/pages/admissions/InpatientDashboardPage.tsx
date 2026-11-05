import { useState } from 'react'
import { Link } from 'react-router'
import { Activity, BedDouble, CalendarClock, ClipboardCheck, Gauge, Hospital, LogOut, Plus, UserRoundCheck } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { admissionService, clinicSettingsService, doctorService } from '../../services'
import { formatDate, formatDateTime, formatShortDay } from '../../lib/dates'
import { ROOM_TYPE_LABEL } from '../../lib/clinic'
import { formatNumber } from '../../lib/money'
import { useCan } from '../../stores/sessionStore'
import type { RoomType } from '../../types/clinic'
import type { AdmissionView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { FilterSelect } from '../../components/ui/FilterBar'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { AdmissionStatusBadge } from '../../components/clinic/ClinicBadges'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { Legend, RankedBars, SegmentedBar, SERIES, TrendChart } from '../../components/charts/Charts'

function PatientList({ items, empty, meta }: { items: AdmissionView[]; empty: string; meta: (a: AdmissionView) => string }) {
  if (items.length === 0) return <EmptyState compact title={empty} />
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((a) => (
        <li key={a.id}>
          <Link to={`/admissions/${a.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-ink-50">
            <PersonAvatar name={a.patientName} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink-900">{a.patientName}</span>
              <span className="block truncate text-xs text-ink-500">{meta(a)}</span>
            </span>
            <AdmissionStatusBadge status={a.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function InpatientDashboardPage() {
  const can = useCan()
  const [department, setDepartment] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [roomType, setRoomType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const f = { department: department || undefined, doctorId: doctorId || undefined, roomType: roomType || undefined }
  const dash = useQuery(() => admissionService.dashboard(f), [JSON.stringify(f)], { tags: ['customers', 'sales'] })
  const active = useQuery(() => admissionService.list({ status: 'ACTIVE', department: f.department, doctorId: f.doctorId, roomType: f.roomType as RoomType | undefined, from: from || undefined, to: to || undefined }), [JSON.stringify(f), from, to], { tags: ['customers', 'sales'] })
  const doctors = useQuery(() => doctorService.list(), [], { tags: ['customers'] })
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })
  const d = dash.data
  const inRange = (a: AdmissionView) => (!from || (a.admittedAt ?? '').slice(0, 10) >= from) && (!to || (a.admittedAt ?? '').slice(0, 10) <= to)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inpatient dashboard"
        description="Live view of admitted patients, bed occupancy and discharges."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Inpatients' }]}
        actions={
          <>
            <Link to="/rooms">
              <Button variant="outline" icon={<BedDouble className="h-4 w-4" />}>
                Bed board
              </Button>
            </Link>
            {can('admissions.manage') && (
              <Link to="/admissions/new">
                <Button icon={<Plus className="h-4 w-4" />}>New admission</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">
        <FilterSelect label="Department" value={department} onChange={setDepartment} options={(settings.data?.departments ?? []).map((x) => ({ value: x, label: x }))} />
        <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={(doctors.data ?? []).map((x) => ({ value: x.id, label: x.name }))} />
        <FilterSelect label="Room type" value={roomType} onChange={setRoomType} options={(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => ({ value: t, label: ROOM_TYPE_LABEL[t] }))} />
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-ink-500">Admitted</span>
          <input type="date" aria-label="Admitted from" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-ink-200 bg-white px-2 focus:border-brand-500 focus:outline-none" />
          <span className="text-ink-400">to</span>
          <input type="date" aria-label="Admitted to" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-ink-200 bg-white px-2 focus:border-brand-500 focus:outline-none" />
        </div>
      </div>

      {dash.error ? (
        <Card>
          <ErrorState message={dash.error} onRetry={dash.refetch} />
        </Card>
      ) : !d ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Admitted patients" value={formatNumber(d.admitted)} icon={<Hospital className="h-4 w-4" />} footer={`${d.underTreatment} under treatment`} />
            <StatCard label="Available beds" value={`${d.beds.available} / ${d.beds.total}`} icon={<BedDouble className="h-4 w-4" />} tone="blue" footer={`${d.beds.maintenance} under maintenance`} />
            <StatCard label="Occupied beds" value={d.beds.occupied} icon={<UserRoundCheck className="h-4 w-4" />} tone="red" footer={`${d.beds.reserved} reserved`} />
            <StatCard label="Occupancy" value={`${d.occupancyPct}%`} icon={<Gauge className="h-4 w-4" />} tone="violet" footer="Occupied + reserved of in-service beds" />
            <StatCard label="Pending admission requests" value={d.pendingRequests} icon={<ClipboardCheck className="h-4 w-4" />} tone="amber" footer={<Link to="/admissions?tab=requests" className="font-medium text-brand-700 hover:underline">Review →</Link>} />
            <StatCard label="Awaiting discharge" value={d.awaitingDischarge} icon={<LogOut className="h-4 w-4" />} tone="amber" footer={<Link to="/discharges" className="font-medium text-brand-700 hover:underline">Discharge queue →</Link>} />
            <StatCard label="Under treatment" value={d.underTreatment} icon={<Activity className="h-4 w-4" />} tone="brand" />
            <StatCard label="Expected discharges (48 h)" value={d.expectedDischarges.length} icon={<CalendarClock className="h-4 w-4" />} tone="ink" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Admissions & discharges" description="Last 14 days" action={<Legend items={[{ label: 'Admissions', color: SERIES[0] }, { label: 'Discharges', color: SERIES[1] }]} />} />
              <CardBody>
                <TrendChart
                  data={d.admissionsTrend}
                  xKey="date"
                  money={false}
                  height={240}
                  formatX={formatShortDay}
                  series={[
                    { key: 'admissions', label: 'Admissions', color: SERIES[0], type: 'bar' },
                    { key: 'discharges', label: 'Discharges', color: SERIES[1], type: 'bar' },
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Bed occupancy" description={`${d.beds.total} beds across all rooms`} />
              <CardBody className="space-y-6">
                <SegmentedBar
                  format={(v) => formatNumber(v)}
                  parts={[
                    { label: 'Available', value: d.beds.available, color: SERIES[0] },
                    { label: 'Occupied', value: d.beds.occupied, color: '#d03b3b' },
                    { label: 'Reserved', value: d.beds.reserved, color: SERIES[4] },
                    { label: 'Maintenance', value: d.beds.maintenance, color: '#8593a7' },
                  ]}
                />
                <div>
                  <div className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Patients by department</div>
                  {d.byDepartment.length === 0 ? <p className="text-sm text-ink-500">No admitted patients.</p> : <RankedBars format={(v) => `${v}`} items={d.byDepartment.map((x) => ({ key: x.department, label: x.department, value: x.patients }))} />}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Recent admissions" />
              <CardBody className="px-2">
                <PatientList items={d.recentAdmissions.filter(inRange)} empty="No admissions in this range" meta={(a) => `${a.admissionNo} · ${formatDateTime(a.admittedAt)} · ${a.bedLabel ?? 'no bed'}`} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Expected discharges" description="Within the next 48 hours" />
              <CardBody className="px-2">
                <PatientList items={d.expectedDischarges.filter(inRange)} empty="No discharges expected" meta={(a) => `${a.bedLabel ?? '—'} · expected ${formatDate(a.expectedDischarge)}`} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Currently under treatment" description={active.data ? `${active.data.filter((a) => a.status === 'UNDER_TREATMENT').length} patients` : undefined} />
              <CardBody className="px-2">
                {active.loading ? <Skeleton className="h-40" /> : <PatientList items={(active.data ?? []).filter((a) => a.status === 'UNDER_TREATMENT')} empty="No patients under treatment" meta={(a) => `${a.bedLabel ?? '—'} · ${a.doctorName} · day ${a.lengthOfStayDays ?? 1}`} />}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
