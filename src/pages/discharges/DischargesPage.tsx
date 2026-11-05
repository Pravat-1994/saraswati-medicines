import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ClipboardCheck, FileSignature, LogOut, Stethoscope } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { dischargeService, patientBillingService } from '../../services'
import { ACTIVE_ADMISSION } from '../../lib/clinic'
import { formatDateTime, relativeTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { useCan } from '../../stores/sessionStore'
import type { AdmissionView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, SearchInput } from '../../components/ui/FilterBar'
import { Tabs } from '../../components/ui/Tabs'
import { EmptyState } from '../../components/ui/Feedback'
import { AdmissionStatusBadge, DischargeStatusBadge } from '../../components/clinic/ClinicBadges'
import { DischargeWorkspace } from './DischargeWorkspace'

type Tab = 'ACTIVE' | 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'COMPLETED'

export default function DischargesPage() {
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'REQUESTED'
  const [open, setOpen] = useState<string>()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const all = useQuery(() => dischargeService.list('ALL'), [], { tags: ['customers'] })
  const accounts = useQuery(() => patientBillingService.list({ type: 'IPD' }), [], { tags: ['customers'], enabled: can('billing.view') })
  const balance = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.admissionId, a])), [accounts.data])

  const rows = (all.data ?? [])
    .filter((a) => (tab === 'ACTIVE' ? ACTIVE_ADMISSION.includes(a.status) : a.discharge.status === tab))
    .filter((a) => !debounced || `${a.patientName} ${a.patientCode} ${a.admissionNo} ${a.bedLabel ?? ''} ${a.doctorName}`.toLowerCase().includes(debounced.toLowerCase()))
  const count = (s: Tab) => (all.data ?? []).filter((a) => (s === 'ACTIVE' ? ACTIVE_ADMISSION.includes(a.status) : a.discharge.status === s)).length

  const columns: Column<AdmissionView>[] = [
    {
      key: 'patient',
      header: 'Patient',
      cell: (a) => (
        <div>
          <div className="font-medium text-ink-900">{a.patientName}</div>
          <div className="text-xs text-ink-500">
            {a.patientCode} · {a.patientAge} yrs
          </div>
        </div>
      ),
    },
    {
      key: 'adm',
      header: 'Admission',
      cell: (a) => (
        <div>
          <div className="font-mono text-[13px] font-semibold">{a.admissionNo}</div>
          <div className="text-xs text-ink-500">Bed {a.bedLabel ?? '—'}</div>
        </div>
      ),
    },
    { key: 'doctor', header: 'Doctor', hideBelow: 'md', cell: (a) => a.doctorName },
    {
      key: 'req',
      header: 'Requested',
      hideBelow: 'lg',
      cell: (a) => (a.discharge.requestedAt ? <span title={formatDateTime(a.discharge.requestedAt)}>{a.discharge.requestedBy} · {relativeTime(a.discharge.requestedAt)}</span> : <span className="text-ink-400">—</span>),
    },
    {
      key: 'bal',
      header: 'Balance',
      align: 'right',
      hideBelow: 'sm',
      cell: (a) => {
        const acc = balance.get(a.id)
        if (!can('billing.view')) return <span className="text-ink-300">—</span>
        if (!acc) return <span className="text-ink-400">No account</span>
        const due = acc.totals.balance + (acc.accruedRoom?.amount ?? 0)
        return (
          <span className={due > 0.005 ? 'font-semibold text-amber-700' : 'text-emerald-700'} title={acc.accruedRoom ? 'Includes accrued room charges not yet posted' : undefined}>
            {due > 0.005 ? formatINR(due) : 'Settled'}
            {acc.accruedRoom ? '*' : ''}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => (
        <div className="flex flex-col items-start gap-1">
          <DischargeStatusBadge status={a.discharge.status} />
          {tab === 'ACTIVE' && <AdmissionStatusBadge status={a.status} />}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Discharge management"
        description="Request → doctor’s summary & approval → final bill → bed release. Only doctors approve clinical discharge documentation."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Discharge management' }]}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Requested" value={all.data ? count('REQUESTED') : '…'} tone="amber" icon={<LogOut className="h-4 w-4" />} onClick={() => setParams({ tab: 'REQUESTED' })} />
        <StatCard label="Under review" value={all.data ? count('UNDER_REVIEW') : '…'} tone="blue" icon={<Stethoscope className="h-4 w-4" />} onClick={() => setParams({ tab: 'UNDER_REVIEW' })} />
        <StatCard label="Approved — billing" value={all.data ? count('APPROVED') : '…'} tone="violet" icon={<FileSignature className="h-4 w-4" />} onClick={() => setParams({ tab: 'APPROVED' })} />
        <StatCard label="Completed" value={all.data ? count('COMPLETED') : '…'} icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => setParams({ tab: 'COMPLETED' })} />
      </div>
      <Card>
        <Tabs
          className="px-4 pt-1"
          value={tab}
          onChange={(k) => setParams({ tab: k }, { replace: true })}
          items={[
            { key: 'REQUESTED', label: 'Requested', count: all.data ? count('REQUESTED') : undefined },
            { key: 'UNDER_REVIEW', label: 'Under review', count: all.data ? count('UNDER_REVIEW') : undefined },
            { key: 'APPROVED', label: 'Approved', count: all.data ? count('APPROVED') : undefined },
            { key: 'COMPLETED', label: 'Completed' },
            { key: 'ACTIVE', label: 'All active inpatients', count: all.data ? count('ACTIVE') : undefined },
          ]}
        />
        <FilterBar actions={can('billing.view') ? <span className="text-xs text-ink-400">* includes accrued room charges</span> : undefined}>
          <SearchInput value={search} onChange={setSearch} placeholder="Patient, admission no., bed or doctor" />
        </FilterBar>
        <DataTable
          caption="Discharges"
          columns={columns}
          rows={all.data ? rows : undefined}
          rowKey={(a) => a.id}
          loading={all.fetching}
          error={all.error}
          onRetry={all.refetch}
          onRowClick={(a) => setOpen(a.id)}
          pageSize={15}
          empty={<EmptyState icon={<LogOut className="h-5 w-5" />} title="Nothing here" description={tab === 'ACTIVE' ? 'No patients are currently admitted.' : 'No discharges in this stage.'} />}
        />
      </Card>
      {open && <DischargeWorkspace admissionId={open} onClose={() => setOpen(undefined)} />}
    </div>
  )
}
