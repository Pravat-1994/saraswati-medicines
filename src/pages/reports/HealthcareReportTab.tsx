import { BedDouble, CalendarCheck, Hospital, IndianRupee, Wallet } from 'lucide-react'
import { CardBody, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { RankedBars, SegmentedBar, SERIES } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { admissionService, appointmentService, patientBillingService } from '../../services'
import { APPOINTMENT_STATUS_LABEL } from '../../lib/clinic'
import { isWithinRange } from '../../lib/dates'
import { formatINR, formatNumber, formatPct, round2 } from '../../lib/money'
import { useCan } from '../../stores/sessionStore'
import type { DateRange } from '../../types/api'
import type { AppointmentStatus } from '../../types/clinic'
import { KpiGrid, ReportActions, ReportCard, TotalsFooter } from './ReportParts'

const STATUS_ORDER: AppointmentStatus[] = ['COMPLETED', 'SCHEDULED', 'CONFIRMED', 'PENDING', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW']
const STATUS_COLOR: Record<AppointmentStatus, string> = { COMPLETED: SERIES[0], SCHEDULED: SERIES[1], CONFIRMED: SERIES[3], PENDING: SERIES[4], IN_PROGRESS: SERIES[5], CANCELLED: '#b1bccb', NO_SHOW: SERIES[2] }

interface StatusRow {
  status: AppointmentStatus
  count: number
  share: number
}
interface DoctorRow {
  doctor: string
  specialization: string
  booked: number
  completed: number
  noShow: number
  completionPct: number
}
interface DeptRow {
  department: string
  admissions: number
  active: number
  discharged: number
  avgStay: number
}
interface BillingRow {
  type: string
  accounts: number
  billed: number
  collected: number
  outstanding: number
}

function AppointmentsSection({ range }: { range: DateRange }) {
  const q = useQuery(() => appointmentService.list({ view: 'ALL' }), [], { tags: ['customers'] })
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <Skeleton className="h-80 rounded-2xl" />
  const list = q.data.filter((a) => isWithinRange(a.date, range))
  const total = list.length
  const statusRows: StatusRow[] = STATUS_ORDER.map((status) => {
    const count = list.filter((a) => a.status === status).length
    return { status, count, share: total ? (count / total) * 100 : 0 }
  }).filter((r) => r.count > 0)
  const byDoctor = new Map<string, DoctorRow>()
  list.forEach((a) => {
    const r = byDoctor.get(a.doctorId) ?? { doctor: a.doctorName, specialization: a.specialization, booked: 0, completed: 0, noShow: 0, completionPct: 0 }
    r.booked++
    if (a.status === 'COMPLETED') r.completed++
    if (a.status === 'NO_SHOW') r.noShow++
    byDoctor.set(a.doctorId, r)
  })
  const doctorRows = [...byDoctor.values()].map((r) => ({ ...r, completionPct: r.booked ? (r.completed / r.booked) * 100 : 0 })).sort((a, b) => b.completed - a.completed)
  const completed = list.filter((a) => a.status === 'COMPLETED')
  const fees = round2(completed.reduce((s, a) => s + a.fee, 0))

  const statusCols: Column<StatusRow>[] = [
    { key: 'status', header: 'Status', cell: (r) => <span className="font-medium text-ink-900">{APPOINTMENT_STATUS_LABEL[r.status]}</span> },
    { key: 'count', header: 'Appointments', align: 'right', cell: (r) => formatNumber(r.count) },
    { key: 'share', header: 'Share', align: 'right', cell: (r) => formatPct(r.share) },
  ]
  const doctorCols: Column<DoctorRow>[] = [
    { key: 'doctor', header: 'Doctor', sortable: true, sortValue: (r) => r.doctor, cell: (r) => (
      <div>
        <div className="font-medium text-ink-900">{r.doctor}</div>
        <div className="text-xs text-ink-500">{r.specialization}</div>
      </div>
    ) },
    { key: 'booked', header: 'Booked', align: 'right', sortable: true, sortValue: (r) => r.booked, cell: (r) => formatNumber(r.booked) },
    { key: 'completed', header: 'Consultations', align: 'right', sortable: true, sortValue: (r) => r.completed, cell: (r) => <span className="font-semibold">{formatNumber(r.completed)}</span> },
    { key: 'noShow', header: 'No-shows', align: 'right', sortable: true, sortValue: (r) => r.noShow, cell: (r) => formatNumber(r.noShow) },
    { key: 'pct', header: 'Completion', align: 'right', sortable: true, sortValue: (r) => r.completionPct, cell: (r) => formatPct(r.completionPct) },
  ]

  return (
    <>
      <KpiGrid>
        <StatCard label="Appointments" value={formatNumber(total)} icon={<CalendarCheck className="h-4 w-4" />} />
        <StatCard label="Consultations completed" value={formatNumber(completed.length)} tone="blue" footer={total ? `${formatPct((completed.length / total) * 100)} of booked` : undefined} />
        <StatCard label="No-shows" value={formatNumber(list.filter((a) => a.status === 'NO_SHOW').length)} tone="red" />
        <StatCard label="Consultation fees (completed)" value={formatINR(fees)} icon={<IndianRupee className="h-4 w-4" />} tone="amber" />
      </KpiGrid>
      {total === 0 ? (
        <ReportCard title="Appointments by status">
          <EmptyState compact title="No appointments in this period" />
        </ReportCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <ReportCard title="Appointments by status" actions={<ReportActions filename="appointments-by-status" rows={statusRows} columns={[{ header: 'Status', value: (r) => APPOINTMENT_STATUS_LABEL[r.status] }, { header: 'Appointments', value: (r) => r.count }, { header: 'Share %', value: (r) => r.share.toFixed(1) }]} />}>
            <CardBody>
              <SegmentedBar format={(v) => formatNumber(v)} parts={statusRows.map((r) => ({ label: APPOINTMENT_STATUS_LABEL[r.status], value: r.count, color: STATUS_COLOR[r.status] }))} />
            </CardBody>
            <DataTable columns={statusCols} rows={statusRows} rowKey={(r) => r.status} pageSize={0} dense />
          </ReportCard>
          <ReportCard title="Consultations per doctor" description="Completed consultations in period">
            <CardBody>
              <RankedBars format={(v) => `${formatNumber(v)}`} items={doctorRows.slice(0, 10).map((r) => ({ key: r.doctor, label: r.doctor, value: r.completed, sub: r.specialization }))} />
            </CardBody>
          </ReportCard>
          <ReportCard
            className="xl:col-span-2"
            title="Doctor activity"
            actions={<ReportActions filename="doctor-activity" rows={doctorRows} columns={[{ header: 'Doctor', value: (r) => r.doctor }, { header: 'Specialisation', value: (r) => r.specialization }, { header: 'Booked', value: (r) => r.booked }, { header: 'Completed', value: (r) => r.completed }, { header: 'No-shows', value: (r) => r.noShow }, { header: 'Completion %', value: (r) => r.completionPct.toFixed(1) }]} />}
          >
            <DataTable columns={doctorCols} rows={doctorRows} rowKey={(r) => r.doctor} pageSize={0} />
          </ReportCard>
        </div>
      )}
    </>
  )
}

function AdmissionsSection({ range }: { range: DateRange }) {
  const adm = useQuery(() => admissionService.list({ status: 'ALL' }), [], { tags: ['customers'] })
  const dash = useQuery(() => admissionService.dashboard(), [], { tags: ['customers'] })
  if (adm.error) return <ErrorState message={adm.error} onRetry={adm.refetch} />
  if (!adm.data || !dash.data) return <Skeleton className="h-72 rounded-2xl" />
  const list = adm.data.filter((a) => a.status !== 'CANCELLED' && isWithinRange(a.admittedAt ?? a.requestedAt, range))
  const deps = new Map<string, { admissions: number; active: number; discharged: number; stay: number[] }>()
  list.forEach((a) => {
    const d = deps.get(a.department) ?? { admissions: 0, active: 0, discharged: 0, stay: [] }
    d.admissions++
    if (['ADMITTED', 'UNDER_TREATMENT', 'DISCHARGE_REQUESTED'].includes(a.status)) d.active++
    if (a.status === 'DISCHARGED') {
      d.discharged++
      if (a.lengthOfStayDays) d.stay.push(a.lengthOfStayDays)
    }
    deps.set(a.department, d)
  })
  const rows: DeptRow[] = [...deps.entries()].map(([department, d]) => ({ department, admissions: d.admissions, active: d.active, discharged: d.discharged, avgStay: d.stay.length ? d.stay.reduce((s, x) => s + x, 0) / d.stay.length : 0 })).sort((a, b) => b.admissions - a.admissions)
  const beds = dash.data.beds
  const cols: Column<DeptRow>[] = [
    { key: 'department', header: 'Department', cell: (r) => <span className="font-medium text-ink-900">{r.department}</span> },
    { key: 'admissions', header: 'Admissions', align: 'right', cell: (r) => formatNumber(r.admissions) },
    { key: 'active', header: 'Currently admitted', align: 'right', cell: (r) => formatNumber(r.active) },
    { key: 'discharged', header: 'Discharged', align: 'right', cell: (r) => formatNumber(r.discharged) },
    { key: 'stay', header: 'Avg stay (days)', align: 'right', cell: (r) => (r.avgStay ? r.avgStay.toFixed(1) : '—') },
  ]
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <ReportCard
        className="xl:col-span-2"
        title="Admissions by department"
        description="Admitted or requested in the selected period (excluding cancelled)"
        actions={<ReportActions filename="admissions-by-department" rows={rows} columns={[{ header: 'Department', value: (r) => r.department }, { header: 'Admissions', value: (r) => r.admissions }, { header: 'Currently admitted', value: (r) => r.active }, { header: 'Discharged', value: (r) => r.discharged }, { header: 'Avg stay (days)', value: (r) => r.avgStay.toFixed(1) }]} />}
      >
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.department} pageSize={0} empty={<EmptyState compact icon={<Hospital className="h-5 w-5" />} title="No admissions in this period" />} />
      </ReportCard>
      <ReportCard title="Bed occupancy" description={`Live · ${dash.data.occupancyPct}% of in-service beds in use`}>
        <CardBody>
          <SegmentedBar
            format={(v) => `${v} bed${v === 1 ? '' : 's'}`}
            parts={[
              { label: 'Available', value: beds.available, color: SERIES[0] },
              { label: 'Occupied', value: beds.occupied, color: SERIES[1] },
              { label: 'Reserved', value: beds.reserved, color: SERIES[4] },
              { label: 'Maintenance', value: beds.maintenance, color: '#b1bccb' },
            ]}
          />
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-500">
            <BedDouble className="h-3.5 w-3.5" /> {beds.total} beds across {beds.byType.length} room types
          </p>
        </CardBody>
      </ReportCard>
    </div>
  )
}

function BillingSection({ range }: { range: DateRange }) {
  const q = useQuery(() => patientBillingService.list({ status: 'ALL' }), [], { tags: ['customers'] })
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <Skeleton className="h-60 rounded-2xl" />
  const inRange = q.data.filter((a) => isWithinRange(a.openedAt, range))
  const collectedInRange = round2(q.data.flatMap((a) => a.payments).filter((p) => isWithinRange(p.date, range)).reduce((s, p) => s + (p.kind === 'REFUND' ? -p.amount : p.amount), 0))
  const make = (type: string, list: typeof inRange): BillingRow => ({
    type,
    accounts: list.length,
    billed: round2(list.reduce((s, a) => s + a.totals.net, 0)),
    collected: round2(list.reduce((s, a) => s + a.totals.paid - a.totals.refunded, 0)),
    outstanding: round2(list.reduce((s, a) => s + Math.max(0, a.totals.balance), 0)),
  })
  const rows = [make('Inpatient (IPD)', inRange.filter((a) => a.admissionId)), make('Outpatient (OPD)', inRange.filter((a) => !a.admissionId))]
  const totals = make('Total', inRange)
  const cols: Column<BillingRow>[] = [
    { key: 'type', header: 'Account type', cell: (r) => <span className="font-medium text-ink-900">{r.type}</span> },
    { key: 'accounts', header: 'Accounts', align: 'right', cell: (r) => formatNumber(r.accounts) },
    { key: 'billed', header: 'Billed', align: 'right', cell: (r) => formatINR(r.billed) },
    { key: 'collected', header: 'Collected', align: 'right', cell: (r) => formatINR(r.collected) },
    { key: 'outstanding', header: 'Outstanding', align: 'right', cell: (r) => <span className={r.outstanding > 0 ? 'font-semibold text-amber-700' : undefined}>{formatINR(r.outstanding)}</span> },
  ]
  return (
    <>
      <KpiGrid>
        <StatCard label="Patient accounts opened" value={formatNumber(totals.accounts)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Billed" value={formatINR(totals.billed)} tone="blue" />
        <StatCard label="Collections in period" value={formatINR(collectedInRange)} tone="brand" footer="Payments received, net of refunds" />
        <StatCard label="Outstanding" value={formatINR(totals.outstanding)} tone="amber" footer="Posted charges not yet paid" />
      </KpiGrid>
      <ReportCard
        title="Patient billing collections"
        description="Accounts opened in the period. Pharmacy sales are reported separately."
        actions={<ReportActions filename="patient-billing" rows={[...rows, totals]} columns={[{ header: 'Type', value: (r) => r.type }, { header: 'Accounts', value: (r) => r.accounts }, { header: 'Billed', value: (r) => r.billed }, { header: 'Collected', value: (r) => r.collected }, { header: 'Outstanding', value: (r) => r.outstanding }]} />}
      >
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(r) => r.type}
          pageSize={0}
          footer={<TotalsFooter columns={cols} values={{ type: 'Total', accounts: formatNumber(totals.accounts), billed: formatINR(totals.billed), collected: formatINR(totals.collected), outstanding: formatINR(totals.outstanding) }} />}
        />
      </ReportCard>
    </>
  )
}

export default function HealthcareReportTab({ range }: { range: DateRange }) {
  const can = useCan()
  return (
    <div className="space-y-6">
      {can('appointments.view') && <AppointmentsSection range={range} />}
      {can('admissions.view') && <AdmissionsSection range={range} />}
      {can('billing.view') && <BillingSection range={range} />}
    </div>
  )
}
