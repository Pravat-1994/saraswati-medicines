import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Hospital, Plus } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { useDebounced } from '../../hooks/useTableState'
import { admissionService, clinicSettingsService, doctorService } from '../../services'
import { formatDateTime } from '../../lib/dates'
import { ADMISSION_STATUS_LABEL, ADMISSION_TYPE_LABEL, ROOM_TYPE_LABEL } from '../../lib/clinic'
import { useCan } from '../../stores/sessionStore'
import type { AdmissionStatus, RoomType } from '../../types/clinic'
import type { AdmissionView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { Tabs } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/Feedback'
import { AdmissionStatusBadge } from '../../components/clinic/ClinicBadges'

type TabKey = 'requests' | 'active' | 'discharged' | 'cancelled' | 'all'

const TAB_STATUSES: Record<TabKey, AdmissionStatus[] | null> = {
  requests: ['REQUESTED', 'APPROVED'],
  active: ['ADMITTED', 'UNDER_TREATMENT', 'DISCHARGE_REQUESTED'],
  discharged: ['DISCHARGED'],
  cancelled: ['CANCELLED'],
  all: null,
}

export default function AdmissionsPage() {
  const navigate = useNavigate()
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) ?? 'active'
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [roomType, setRoomType] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const debounced = useDebounced(search)
  const filters = { status: 'ALL' as const, department: department || undefined, doctorId: doctorId || undefined, roomType: (roomType || undefined) as RoomType | undefined, from: from || undefined, to: to || undefined, search: debounced || undefined }
  const all = useQuery(() => admissionService.list(filters), [JSON.stringify(filters)], { tags: ['customers'] })
  const doctors = useQuery(() => doctorService.list(), [], { tags: ['customers'] })
  const settings = useQuery(() => clinicSettingsService.get(), [], { tags: ['settings'] })

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { requests: 0, active: 0, discharged: 0, cancelled: 0, all: 0 }
    for (const a of all.data ?? []) {
      c.all++
      for (const k of ['requests', 'active', 'discharged', 'cancelled'] as const) if (TAB_STATUSES[k]!.includes(a.status)) c[k]++
    }
    return c
  }, [all.data])

  const rows = (all.data ?? []).filter((a) => (!TAB_STATUSES[tab] || TAB_STATUSES[tab]!.includes(a.status)) && (!status || a.status === status))
  const active = !!(search || department || doctorId || roomType || status || from || to)

  const columns: Column<AdmissionView>[] = [
    {
      key: 'no',
      header: 'Admission',
      sortable: true,
      sortValue: (a) => a.admissionNo,
      cell: (a) => (
        <div>
          <div className="font-mono text-[13px] font-semibold text-ink-900">{a.admissionNo}</div>
          <div className="text-xs text-ink-500">{ADMISSION_TYPE_LABEL[a.type]}</div>
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
          <div className="text-ink-900">{a.patientName}</div>
          <div className="text-xs text-ink-500">
            {a.patientCode} · {a.patientAge} yrs
          </div>
        </div>
      ),
    },
    { key: 'dept', header: 'Department / doctor', hideBelow: 'lg', cell: (a) => <div><div>{a.department}</div><div className="text-xs text-ink-500">{a.doctorName}</div></div> },
    { key: 'dx', header: 'Diagnosis', hideBelow: 'xl', cell: (a) => <span className="line-clamp-2 text-ink-600">{a.diagnosis || a.reason}</span> },
    { key: 'bed', header: 'Bed', hideBelow: 'sm', cell: (a) => (a.bedLabel ? <span><span className="font-medium">{a.bedLabel}</span>{a.roomType && <span className="block text-[11px] text-ink-500">{ROOM_TYPE_LABEL[a.roomType]}</span>}</span> : <span className="text-ink-400">Not allocated</span>) },
    { key: 'date', header: 'Admitted / requested', sortable: true, hideBelow: 'md', sortValue: (a) => a.admittedAt ?? a.requestedAt, cell: (a) => <span className="text-ink-600">{formatDateTime(a.admittedAt ?? a.requestedAt)}</span> },
    { key: 'los', header: 'Stay', align: 'right', hideBelow: 'md', sortable: true, sortValue: (a) => a.lengthOfStayDays ?? 0, cell: (a) => (a.lengthOfStayDays ? `${a.lengthOfStayDays} d` : '—') },
    { key: 'status', header: 'Status', cell: (a) => <AdmissionStatusBadge status={a.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Patient admissions"
        description="Admission requests, approvals, bed allocation and inpatient stays."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Admissions' }]}
        actions={
          can('admissions.manage') && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/admissions/new')}>
              New admission
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
            { key: 'requests', label: 'Requests', count: counts.requests },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'discharged', label: 'Discharged', count: counts.discharged },
            { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            { key: 'all', label: 'All', count: counts.all },
          ]}
        />
        <FilterBar
          active={active}
          onReset={() => {
            setSearch('')
            setDepartment('')
            setDoctorId('')
            setRoomType('')
            setStatus('')
            setFrom('')
            setTo('')
          }}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Admission no., patient, bed or diagnosis" />
          <FilterSelect label="Department" value={department} onChange={setDepartment} options={(settings.data?.departments ?? []).map((d) => ({ value: d, label: d }))} />
          <FilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect label="Room" value={roomType} onChange={setRoomType} options={(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => ({ value: t, label: ROOM_TYPE_LABEL[t] }))} />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={(TAB_STATUSES[tab] ?? (Object.keys(ADMISSION_STATUS_LABEL) as AdmissionStatus[])).map((s) => ({ value: s, label: ADMISSION_STATUS_LABEL[s] }))}
          />
          <div className="flex items-center gap-1.5 text-[13px]">
            <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-ink-200 px-2 text-ink-700 focus:border-brand-500 focus:outline-none" />
            <span className="text-ink-400">to</span>
            <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-ink-200 px-2 text-ink-700 focus:border-brand-500 focus:outline-none" />
          </div>
        </FilterBar>
        <DataTable
          caption="Admissions"
          columns={columns}
          rows={all.data ? rows : undefined}
          rowKey={(a) => a.id}
          loading={all.fetching}
          error={all.error}
          onRetry={all.refetch}
          onRowClick={(a) => navigate(`/admissions/${a.id}`)}
          rowClassName={(a) => (a.status === 'REQUESTED' ? 'bg-accent-50/40' : undefined)}
          pageSize={15}
          empty={
            <EmptyState
              icon={<Hospital className="h-5 w-5" />}
              title="No admissions here"
              description={active ? 'Adjust the filters to see more.' : tab === 'requests' ? 'New admission requests will appear here.' : undefined}
              action={tab === 'requests' && can('admissions.manage') ? <Button size="sm" onClick={() => navigate('/admissions/new')}>New admission</Button> : undefined}
            />
          }
        />
        {tab === 'requests' && counts.requests > 0 && (
          <div className="border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
            <Badge tone="accent" className="mr-2">Requested</Badge> needs approval · <Badge tone="info" className="mx-2">Approved</Badge> needs a bed and confirmation
          </div>
        )}
      </Card>
    </div>
  )
}
