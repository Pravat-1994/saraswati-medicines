import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BedDouble, UserPlus, Users } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { patientService } from '../../services'
import { addDays, formatDate } from '../../lib/dates'
import { maskPhone } from '../../lib/clinic'
import { useCan } from '../../stores/sessionStore'
import type { PatientListItem } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, SearchInput } from '../../components/ui/FilterBar'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/Feedback'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { PatientFormModal } from './PatientFormModal'

const GENDER = { MALE: 'M', FEMALE: 'F', OTHER: 'O' } as const

export default function PatientsPage() {
  const navigate = useNavigate()
  const can = useCan()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const debounced = useDebounced(search)
  const list = useQuery(() => patientService.search(debounced || undefined), [debounced], { tags: ['customers'] })
  const all = useQuery(() => patientService.search(), [], { tags: ['customers'] })
  const [monthAgo] = useState(() => addDays(new Date(), -30).toISOString())

  const columns: Column<PatientListItem>[] = [
    {
      key: 'name',
      header: 'Patient',
      sortable: true,
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <PersonAvatar name={p.name} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink-900">{p.name}</div>
            <div className="font-mono text-xs text-ink-500">{p.patientCode}</div>
          </div>
        </div>
      ),
    },
    { key: 'age', header: 'Age / sex', sortable: true, sortValue: (p) => p.age, cell: (p) => `${p.age} yrs · ${GENDER[p.gender]}` },
    { key: 'phone', header: 'Mobile', hideBelow: 'md', cell: (p) => <span className="num text-ink-600">{maskPhone(p.phone)}</span> },
    {
      key: 'alerts',
      header: 'Alerts',
      hideBelow: 'lg',
      cell: (p) => (p.allergies.length ? <Badge tone="danger">Allergy: {p.allergies.slice(0, 2).join(', ')}</Badge> : <span className="text-ink-300">—</span>),
    },
    { key: 'last', header: 'Last visit', sortable: true, hideBelow: 'sm', sortValue: (p) => p.lastVisit ?? '', cell: (p) => (p.lastVisit ? formatDate(p.lastVisit) : <span className="text-ink-400">No visits</span>) },
    {
      key: 'status',
      header: 'Status',
      cell: (p) =>
        p.activeAdmission ? (
          <Badge tone="violet" icon={<BedDouble className="h-3 w-3" />}>
            Inpatient{p.activeAdmission.bed ? ` · ${p.activeAdmission.bed}` : ''}
          </Badge>
        ) : (
          <Badge>Outpatient</Badge>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Patient registration"
        description="Central patient registry shared by consultations, admissions, prescriptions and billing."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Patients' }]}
        actions={
          can('patients.manage') && (
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Register patient
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Registered patients" value={all.data?.length ?? '…'} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Currently admitted" value={all.data?.filter((p) => p.activeAdmission).length ?? '…'} tone="violet" icon={<BedDouble className="h-4 w-4" />} />
        <StatCard label="New in 30 days" value={all.data?.filter((p) => p.registeredAt >= monthAgo).length ?? '…'} tone="blue" />
        <StatCard label="With recorded allergies" value={all.data?.filter((p) => p.allergies.length > 0).length ?? '…'} tone="red" />
      </div>
      <Card>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, patient ID or mobile" className="sm:w-96" />
        </FilterBar>
        <DataTable
          caption="Patients"
          columns={columns}
          rows={list.data}
          rowKey={(p) => p.id}
          loading={list.fetching}
          error={list.error}
          onRetry={list.refetch}
          onRowClick={(p) => navigate(`/patients/${p.id}`)}
          pageSize={15}
          empty={
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No patients found"
              description={search ? 'Try another name, patient ID or mobile number.' : 'Register the first patient to get started.'}
              action={can('patients.manage') ? <Button size="sm" onClick={() => setCreating(true)}>Register patient</Button> : undefined}
            />
          }
        />
      </Card>
      {creating && <PatientFormModal open onClose={() => setCreating(false)} onSaved={(p) => navigate(`/patients/${p.id}`)} />}
    </div>
  )
}
