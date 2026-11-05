import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AlertTriangle, BedDouble, CalendarPlus, ClipboardList, HeartPulse, Hospital, Pencil, Phone, ShieldAlert } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { patientService } from '../../services'
import { formatDate, formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { CONSULTATION_TYPE_LABEL, formatSlot } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import { useCan } from '../../stores/sessionStore'
import type { AccountView, AdmissionView, AppointmentView, PrescriptionView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Tabs } from '../../components/ui/Tabs'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { AdmissionStatusBadge, AppointmentStatusBadge, FulfilmentBadge } from '../../components/clinic/ClinicBadges'
import { PatientFormModal } from './PatientFormModal'
import { VitalsGrid } from './VitalsGrid'

type TabKey = 'overview' | 'appointments' | 'admissions' | 'prescriptions' | 'bills'

export default function PatientProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) ?? 'overview'
  const [editing, setEditing] = useState(false)
  const q = useQuery(() => patientService.profile(id!), [id], { tags: ['customers', 'sales'] })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (!q.data) return <PageLoader />
  const { patient: p, appointments, admissions, prescriptions, accounts, latestVitals } = q.data
  const activeAdm = admissions.find((a) => a.id === p.activeAdmission?.id)

  const apptCols: Column<AppointmentView>[] = [
    { key: 'no', header: 'Appointment', cell: (a) => <span className="font-mono text-[13px] font-semibold">{a.appointmentNo}</span> },
    { key: 'when', header: 'Date & time', cell: (a) => `${formatDate(a.date)}, ${formatSlot(a.start)}` },
    { key: 'doc', header: 'Doctor', hideBelow: 'md', cell: (a) => <span>{a.doctorName} <span className="text-xs text-ink-500">· {a.specialization}</span></span> },
    { key: 'type', header: 'Type', hideBelow: 'sm', cell: (a) => CONSULTATION_TYPE_LABEL[a.type] },
    { key: 'status', header: 'Status', cell: (a) => <AppointmentStatusBadge status={a.status} /> },
  ]
  const admCols: Column<AdmissionView>[] = [
    { key: 'no', header: 'Admission', cell: (a) => <span className="font-mono text-[13px] font-semibold">{a.admissionNo}</span> },
    { key: 'date', header: 'Admitted', cell: (a) => formatDate(a.admittedAt ?? a.requestedAt) },
    { key: 'dx', header: 'Diagnosis', hideBelow: 'md', cell: (a) => a.diagnosis },
    { key: 'doc', header: 'Doctor', hideBelow: 'lg', cell: (a) => a.doctorName },
    { key: 'status', header: 'Status', cell: (a) => <AdmissionStatusBadge status={a.status} /> },
  ]
  const rxCols: Column<PrescriptionView>[] = [
    { key: 'no', header: 'Prescription', cell: (r) => <span className="font-mono text-[13px] font-semibold">{r.rxNo}</span> },
    { key: 'date', header: 'Date', cell: (r) => formatDate(r.createdAt) },
    { key: 'dx', header: 'Diagnosis', hideBelow: 'md', cell: (r) => r.diagnosis },
    { key: 'doc', header: 'Doctor', hideBelow: 'lg', cell: (r) => r.doctorName },
    { key: 'st', header: 'Status', cell: (r) => (r.status === 'DRAFT' ? <Badge>Draft</Badge> : <FulfilmentBadge status={r.fulfilment} />) },
  ]
  const billCols: Column<AccountView>[] = [
    { key: 'no', header: 'Account', cell: (a) => <span className="font-mono text-[13px] font-semibold">{a.billNo ?? a.accountNo}</span> },
    { key: 'type', header: 'Type', cell: (a) => (a.admissionId ? `Inpatient · ${a.admissionNo}` : `Outpatient${a.appointmentNo ? ` · ${a.appointmentNo}` : ''}`) },
    { key: 'net', header: 'Amount', align: 'right', cell: (a) => formatINR(a.totals.net) },
    { key: 'bal', header: 'Balance', align: 'right', cell: (a) => <span className={a.totals.balance > 0.005 ? 'font-semibold text-red-600' : ''}>{formatINR(a.totals.balance)}</span> },
    { key: 'st', header: 'Status', cell: (a) => <Badge tone={a.status === 'SETTLED' ? 'success' : a.status === 'FINALISED' ? 'warning' : 'info'}>{a.status === 'OPEN' ? 'Open' : a.status === 'FINALISED' ? 'Final bill' : 'Settled'}</Badge> },
  ]

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'appointments' as const, label: 'Appointments', count: appointments.length },
    { key: 'admissions' as const, label: 'Admissions', count: admissions.length },
    ...(can('prescriptions.view') ? [{ key: 'prescriptions' as const, label: 'Prescriptions', count: prescriptions.length }] : []),
    ...(can('billing.view') ? [{ key: 'bills' as const, label: 'Bills', count: accounts.length }] : []),
  ]

  return (
    <div>
      <PageHeader
        title={p.name}
        badge={p.activeAdmission ? <Badge tone="violet" icon={<BedDouble className="h-3 w-3" />}>Inpatient</Badge> : undefined}
        breadcrumbs={[{ label: 'Patients', to: '/patients' }, { label: p.patientCode }]}
        actions={
          <>
            {can('clinical.view') && (
              <Button variant="outline" icon={<ClipboardList className="h-4 w-4" />} onClick={() => navigate(`/clinical?patient=${p.id}`)}>
                Clinical records
              </Button>
            )}
            {can('admissions.manage') && !p.activeAdmission && (
              <Button variant="outline" icon={<Hospital className="h-4 w-4" />} onClick={() => navigate(`/admissions/new?patient=${p.id}`)}>
                Request admission
              </Button>
            )}
            {can('appointments.manage') && (
              <Button variant="outline" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => navigate(`/appointments?new=1&patient=${p.id}`)}>
                Book appointment
              </Button>
            )}
            {can('patients.manage') && (
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <PersonAvatar name={p.name} size="lg" />
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <InfoRow label="Patient ID" value={<span className="font-mono font-semibold">{p.patientCode}</span>} />
            <InfoRow label="Age / gender" value={`${p.age} yrs · ${p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}`} />
            <InfoRow label="Date of birth" value={formatDate(p.dateOfBirth)} />
            <InfoRow label="Blood group" value={p.bloodGroup ?? 'Not recorded'} />
          </div>
        </div>
        <div className={cn('flex flex-wrap items-center gap-2 border-t px-5 py-3', p.allergies.length ? 'border-red-100 bg-red-50/70' : 'border-ink-100 bg-ink-50/50')}>
          {p.allergies.length ? (
            <>
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <span className="text-[13px] font-semibold text-red-800">Allergies:</span>
              {p.allergies.map((a) => (
                <Badge key={a} tone="danger">
                  {a}
                </Badge>
              ))}
            </>
          ) : (
            <span className="text-[13px] text-ink-500">No known allergies recorded</span>
          )}
          {p.conditions.length > 0 && (
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-500">Conditions:</span>
              {p.conditions.map((c) => (
                <Badge key={c}>{c}</Badge>
              ))}
            </span>
          )}
        </div>
      </Card>

      <Tabs className="mb-5" value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} items={tabs} />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {activeAdm && (
              <Card>
                <CardHeader title="Current admission" icon={<Hospital className="h-4 w-4" />} action={<Link to={`/admissions/${activeAdm.id}`} className="text-xs font-semibold text-brand-700 hover:underline">Open admission →</Link>} />
                <CardBody>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <InfoRow label="Admission" value={<span className="font-mono">{activeAdm.admissionNo}</span>} />
                    <InfoRow label="Bed" value={activeAdm.bedLabel ? `${activeAdm.bedLabel} · ${activeAdm.roomNumber}` : '—'} />
                    <InfoRow label="Doctor" value={activeAdm.doctorName} />
                    <InfoRow label="Status" value={<AdmissionStatusBadge status={activeAdm.status} />} />
                    <InfoRow label="Diagnosis" value={activeAdm.diagnosis} className="col-span-2 sm:col-span-4" />
                  </dl>
                </CardBody>
              </Card>
            )}
            <Card>
              <CardHeader title="Latest vital signs" icon={<HeartPulse className="h-4 w-4" />} description={latestVitals ? `${formatDateTime(latestVitals.at)} · ${latestVitals.by}` : undefined} />
              <CardBody>{latestVitals?.vitals ? <VitalsGrid vitals={latestVitals.vitals} /> : <EmptyState compact title="No vitals recorded" description={can('clinical.view') ? 'Vitals appear here once recorded.' : 'You do not have access to clinical observations.'} />}</CardBody>
            </Card>
            {p.history && (
              <Card>
                <CardHeader title="Relevant medical history" />
                <CardBody>
                  <p className="text-sm leading-relaxed text-ink-700">{p.history}</p>
                </CardBody>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Contact" icon={<Phone className="h-4 w-4" />} />
              <CardBody>
                <dl className="grid gap-3">
                  <InfoRow label="Mobile" value={<a href={`tel:${p.phone.replace(/\s/g, '')}`} className="text-brand-700 hover:underline">{p.phone}</a>} />
                  <InfoRow label="Email" value={p.email} />
                  <InfoRow label="Address" value={p.address || undefined} />
                  <InfoRow label="Registered" value={`${formatDate(p.registeredAt)} by ${p.registeredBy}`} />
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Emergency contact" icon={<AlertTriangle className="h-4 w-4" />} />
              <CardBody>
                {p.emergencyContact ? (
                  <dl className="grid gap-3">
                    <InfoRow label="Name" value={`${p.emergencyContact.name} (${p.emergencyContact.relation})`} />
                    <InfoRow label="Mobile" value={p.emergencyContact.phone} />
                  </dl>
                ) : (
                  <p className="text-sm text-ink-500">Not recorded.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'appointments' && (
        <Card>
          <DataTable columns={apptCols} rows={appointments} rowKey={(a) => a.id} pageSize={10} onRowClick={(a) => navigate(`/appointments/${a.id}`)} empty={<EmptyState compact title="No appointments" />} />
        </Card>
      )}
      {tab === 'admissions' && (
        <Card>
          <DataTable columns={admCols} rows={admissions} rowKey={(a) => a.id} pageSize={10} onRowClick={(a) => navigate(`/admissions/${a.id}`)} empty={<EmptyState compact title="No admissions" />} />
        </Card>
      )}
      {tab === 'prescriptions' && (
        <Card>
          <DataTable columns={rxCols} rows={prescriptions} rowKey={(r) => r.id} pageSize={10} onRowClick={(r) => navigate(`/prescriptions/${r.id}`)} empty={<EmptyState compact title="No prescriptions" />} />
        </Card>
      )}
      {tab === 'bills' && (
        <Card>
          <DataTable columns={billCols} rows={accounts} rowKey={(a) => a.id} pageSize={10} onRowClick={(a) => navigate(`/billing/${a.id}`)} empty={<EmptyState compact title="No bills" />} />
        </Card>
      )}

      {editing && <PatientFormModal open patient={p} onClose={() => setEditing(false)} onSaved={() => q.refetch()} />}
    </div>
  )
}
