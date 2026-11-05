import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { FileHeart, Plus } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { prescriptionService } from '../../services'
import { FULFILMENT_LABEL } from '../../lib/clinic'
import { formatDateTime } from '../../lib/dates'
import { useCan, useSessionStore } from '../../stores/sessionStore'
import type { FulfilmentStatus } from '../../types/clinic'
import type { PrescriptionView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { Tabs } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/Feedback'
import { FulfilmentBadge } from '../../components/clinic/ClinicBadges'

type Tab = 'ALL' | 'MINE' | 'DRAFT' | 'FINAL'

export default function PrescriptionsPage() {
  const navigate = useNavigate()
  const can = useCan()
  const user = useSessionStore((s) => s.user)
  const isDoctor = user?.roleId === 'DOCTOR' && !!user.doctorId && can('prescriptions.issue')
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? (isDoctor ? 'MINE' : can('prescriptions.fulfil') ? 'FINAL' : 'ALL')
  const [search, setSearch] = useState('')
  const [fulfilment, setFulfilment] = useState<FulfilmentStatus | ''>(can('prescriptions.fulfil') && !isDoctor ? 'PENDING' : '')
  const debounced = useDebounced(search)
  const filters = {
    mine: tab === 'MINE' || undefined,
    status: tab === 'DRAFT' ? ('DRAFT' as const) : tab === 'FINAL' ? ('FINAL' as const) : ('ALL' as const),
    fulfilment: fulfilment || ('ALL' as const),
    search: debounced || undefined,
  }
  const list = useQuery(() => prescriptionService.list(filters), [JSON.stringify(filters)], { tags: ['customers', 'sales'] })

  const columns: Column<PrescriptionView>[] = [
    {
      key: 'rx',
      header: 'Prescription',
      sortable: true,
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <div>
          <div className="font-mono text-[13px] font-semibold text-ink-900">{r.rxNo}</div>
          <div className="text-xs text-ink-500">{formatDateTime(r.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      sortable: true,
      sortValue: (r) => r.patientName,
      cell: (r) => (
        <div>
          <div className="font-medium text-ink-900">{r.patientName}</div>
          <div className="font-mono text-[11px] text-ink-500">{r.patientCode}</div>
        </div>
      ),
    },
    { key: 'doctor', header: 'Doctor', hideBelow: 'md', cell: (r) => <span className="text-ink-700">{r.doctorName}</span> },
    { key: 'dx', header: 'Diagnosis', hideBelow: 'lg', cell: (r) => <span className="line-clamp-1 text-ink-600">{r.diagnosis}</span> },
    { key: 'items', header: 'Items', align: 'right', hideBelow: 'sm', cell: (r) => r.items.length },
    { key: 'status', header: 'Status', cell: (r) => (r.status === 'DRAFT' ? <Badge>Draft</Badge> : <FulfilmentBadge status={r.fulfilment} />) },
  ]

  return (
    <div>
      <PageHeader
        title="Prescriptions"
        description="Electronic prescriptions issued by authorised doctors, and their pharmacy fulfilment."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Healthcare' }, { label: 'Prescriptions' }]}
        actions={
          isDoctor && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/prescriptions/new')}>
              New prescription
            </Button>
          )
        }
      />
      <Card>
        <Tabs
          className="px-4 pt-1"
          value={tab}
          onChange={(k) => setParams({ tab: k }, { replace: true })}
          items={[
            ...(isDoctor ? [{ key: 'MINE' as const, label: 'My prescriptions' }] : []),
            { key: 'FINAL', label: 'Finalised' },
            ...(isDoctor ? [{ key: 'DRAFT' as const, label: 'My drafts' }] : []),
            { key: 'ALL', label: 'All' },
          ]}
        />
        <FilterBar active={!!(search || fulfilment)} onReset={() => { setSearch(''); setFulfilment('') }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Rx no., patient, doctor, diagnosis or medicine" />
          <FilterSelect label="Fulfilment" value={fulfilment} onChange={(v) => setFulfilment(v as FulfilmentStatus | '')} options={(Object.keys(FULFILMENT_LABEL) as FulfilmentStatus[]).map((k) => ({ value: k, label: FULFILMENT_LABEL[k] }))} />
        </FilterBar>
        <DataTable
          caption="Prescriptions"
          columns={columns}
          rows={list.data}
          rowKey={(r) => r.id}
          loading={list.fetching}
          error={list.error}
          onRetry={list.refetch}
          pageSize={15}
          onRowClick={(r) => navigate(`/prescriptions/${r.id}`)}
          empty={<EmptyState icon={<FileHeart className="h-5 w-5" />} title="No prescriptions" description="Prescriptions written after consultations appear here." />}
        />
      </Card>
    </div>
  )
}
