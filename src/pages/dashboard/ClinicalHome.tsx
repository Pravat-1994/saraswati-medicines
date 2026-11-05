import { Link, useNavigate } from 'react-router'
import { ArrowRight, BedDouble, CalendarPlus, ClipboardList, HeartPulse, Hospital, ReceiptIndianRupee, UserPlus } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { admissionService, patientBillingService } from '../../services'
import { formatDate, relativeTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState, Skeleton } from '../../components/ui/Feedback'
import { AdmissionStatusBadge } from '../../components/clinic/ClinicBadges'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { HealthcareToday } from './HealthcareToday'

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function InpatientList({ forNurse }: { forNurse: boolean }) {
  const list = useQuery(() => admissionService.list({ status: 'ACTIVE' }), [], { tags: ['customers'] })
  return (
    <Card>
      <CardHeader
        title="Active inpatients"
        icon={<HeartPulse className="h-4 w-4" />}
        description={forNurse ? 'Open a patient to record vitals, medication and observations' : undefined}
        action={
          <Link to="/inpatients" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
            Inpatient dashboard <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      {!list.data ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : list.data.length === 0 ? (
        <EmptyState compact icon={<BedDouble className="h-5 w-5" />} title="No patients admitted" />
      ) : (
        <ul className="divide-y divide-ink-100 px-2 pb-2">
          {list.data.map((a) => (
            <li key={a.id}>
              <Link to={forNurse ? `/clinical?patient=${a.patientId}&admission=${a.id}` : `/admissions/${a.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-ink-50">
                <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg bg-violet-50 font-mono text-[11px] font-bold text-violet-700">{a.bedLabel ?? '—'}</span>
                <PersonAvatar name={a.patientName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">
                    {a.patientName} <span className="font-normal text-ink-400">· {a.patientAge} yrs</span>
                  </span>
                  <span className="block truncate text-xs text-ink-500">
                    {a.diagnosis || a.reason} · {a.doctorName}
                  </span>
                </span>
                <AdmissionStatusBadge status={a.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function AccountsDue() {
  const list = useQuery(() => patientBillingService.list({ status: 'DUE' }), [], { tags: ['customers'] })
  return (
    <Card>
      <CardHeader
        title="Patient accounts with dues"
        icon={<ReceiptIndianRupee className="h-4 w-4" />}
        action={
          <Link to="/billing" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
            Patient billing <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      {!list.data ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : list.data.length === 0 ? (
        <EmptyState compact title="No outstanding balances" />
      ) : (
        <ul className="divide-y divide-ink-100 px-2 pb-2">
          {list.data.slice(0, 8).map((a) => (
            <li key={a.id}>
              <Link to={`/billing/${a.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-ink-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">{a.patientName}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {a.accountNo} · {a.admissionNo ? `IPD ${a.admissionNo}` : 'OPD'} · opened {relativeTime(a.openedAt)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block text-[13px] font-semibold text-ink-900">{formatINR(a.totals.balance + (a.accruedRoom?.amount ?? 0))}</span>
                  {a.accruedRoom && <span className="block text-[10px] text-ink-400">incl. accrued room</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Home screen for clinical roles (Doctor, Nurse, Receptionist, Billing Operator). */
export function ClinicalHome() {
  const can = useCan()
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const role = useSessionStore((s) => s.role)
  const isDoctor = role?.id === 'DOCTOR'
  const isNurse = role?.id === 'NURSE'
  const actions = [
    { show: can('appointments.manage'), label: 'New appointment', icon: CalendarPlus, to: '/appointments?new=1' },
    { show: can('patients.manage'), label: 'Register patient', icon: UserPlus, to: '/patients' },
    { show: can('admissions.manage'), label: 'New admission', icon: Hospital, to: '/admissions/new' },
    { show: can('clinical.record'), label: 'Record vitals', icon: ClipboardList, to: '/clinical' },
    { show: can('billing.view'), label: 'Patient bills', icon: ReceiptIndianRupee, to: '/billing' },
  ].filter((a) => a.show)

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-ink-900 to-brand-900 px-6 py-6 text-white shadow-raised sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-brand-300/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-violet-100/80">
              {greeting()}, {user?.name.replace(/^(Dr\.|Sr\.)\s*/, '').split(' ')[0]}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{isDoctor ? 'Your clinic day' : isNurse ? 'Ward overview' : `${role?.name ?? 'Clinic'} workspace`}</h1>
            <p className="mt-1.5 text-sm text-violet-100/75">{formatDate(new Date().toISOString())} · Saraswati Clinic</p>
          </div>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((a, i) => (
                <Button
                  key={a.to}
                  variant={i === 0 ? 'accent' : 'ghost'}
                  className={i === 0 ? undefined : 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20'}
                  icon={<a.icon className="h-4 w-4" />}
                  onClick={() => navigate(a.to)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {(can('appointments.view') || can('admissions.view')) && <HealthcareToday mine={isDoctor} />}

      <div className="grid gap-4 xl:grid-cols-2">
        {can('admissions.view') && (isNurse || isDoctor || can('admissions.manage')) && <InpatientList forNurse={isNurse && can('clinical.view')} />}
        {can('billing.view') && <AccountsDue />}
      </div>
    </div>
  )
}
