import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertTriangle, BedDouble, ChevronDown, ClipboardList, Plus, ShieldCheck } from 'lucide-react'
import { useQuery } from '../../hooks/useQuery'
import { admissionService, clinicalRecordService, patientService } from '../../services'
import { ACTIVE_ADMISSION, CLINICAL_KIND_LABEL } from '../../lib/clinic'
import { formatDate, relativeTime } from '../../lib/dates'
import { useCan } from '../../stores/sessionStore'
import type { ClinicalEntryKind } from '../../types/clinic'
import type { PatientListItem } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Menu, type MenuItem } from '../../components/ui/Menu'
import { Tabs } from '../../components/ui/Tabs'
import { Select } from '../../components/ui/Form'
import { Alert, EmptyState, ErrorState, PageLoader, Skeleton } from '../../components/ui/Feedback'
import { AdmissionStatusBadge } from '../../components/clinic/ClinicBadges'
import { PatientPicker } from '../../components/clinic/PatientPicker'
import { PersonAvatar } from '../../components/clinic/DoctorAvatar'
import { AddEntryDialog } from './entryDialogs'
import { EntryList, VitalsPanel } from './recordViews'

type Tab = 'timeline' | 'vitals' | 'medication' | 'notes' | 'documents'
const NOTE_KINDS: ClinicalEntryKind[] = ['ASSESSMENT', 'DOCTOR_NOTE', 'TREATMENT_PLAN', 'PROGRESS', 'FOLLOW_UP']
const ALL_KINDS: ClinicalEntryKind[] = ['ASSESSMENT', 'DOCTOR_NOTE', 'TREATMENT_PLAN', 'PROGRESS', 'VITALS', 'MEDICATION', 'DOCUMENT', 'FOLLOW_UP']

export default function ClinicalRecordsPage() {
  const [params, setParams] = useSearchParams()
  const patientId = params.get('patient') ?? undefined
  const admissionId = params.get('admission') ?? undefined

  const select = (p?: PatientListItem) => {
    if (!p) return setParams({}, { replace: true })
    const next: Record<string, string> = { patient: p.id }
    if (p.activeAdmission) next.admission = p.activeAdmission.id
    setParams(next)
  }

  return (
    <div>
      <PageHeader
        title="Clinical records"
        description="Assessments, vital signs, medication administration, notes and documents — a record-management view, not a diagnostic system."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Clinical records' }]}
      />
      {patientId ? <PatientRecord patientId={patientId} admissionId={admissionId} onChangeAdmission={(a) => setParams(a ? { patient: patientId, admission: a } : { patient: patientId }, { replace: true })} onClear={() => select(undefined)} /> : <PatientChooser onSelect={select} />}
    </div>
  )
}

function PatientChooser({ onSelect }: { onSelect: (p: PatientListItem) => void }) {
  const inpatients = useQuery(() => admissionService.list({ status: 'ACTIVE' }), [], { tags: ['customers'] })
  const [, setParams] = useSearchParams()
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Find a patient" description="Search by name, patient ID or mobile number." icon={<ClipboardList className="h-4 w-4" />} />
        <CardBody>
          <PatientPicker onChange={(p) => p && onSelect(p)} />
        </CardBody>
      </Card>
      <div>
        <h2 className="mb-3 font-display text-sm font-semibold text-ink-900">Current inpatients</h2>
        {inpatients.error ? (
          <ErrorState message={inpatients.error} onRetry={inpatients.refetch} />
        ) : !inpatients.data ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : inpatients.data.length === 0 ? (
          <Card>
            <EmptyState compact icon={<BedDouble className="h-5 w-5" />} title="No patients are admitted right now" />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inpatients.data.map((a) => (
              <button
                key={a.id}
                onClick={() => setParams({ patient: a.patientId, admission: a.id })}
                className="flex items-start gap-3 rounded-2xl border border-ink-200/70 bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised"
              >
                <PersonAvatar name={a.patientName} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink-900">{a.patientName}</span>
                  <span className="block text-xs text-ink-500">
                    {a.patientCode} · {a.patientAge} yrs · Bed {a.bedLabel ?? '—'}
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-600">{a.diagnosis}</span>
                  <span className="mt-2 flex items-center gap-2">
                    <AdmissionStatusBadge status={a.status} />
                    <span className="text-[11px] text-ink-400">{a.doctorName}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PatientRecord({ patientId, admissionId, onChangeAdmission, onClear }: { patientId: string; admissionId?: string; onChangeAdmission: (id?: string) => void; onClear: () => void }) {
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'timeline'
  const [kindFilter, setKindFilter] = useState<ClinicalEntryKind | ''>('')
  const [dialog, setDialog] = useState<ClinicalEntryKind | null>(null)
  const profile = useQuery(() => patientService.profile(patientId), [patientId], { tags: ['customers'] })
  const entries = useQuery(() => clinicalRecordService.list(patientId, admissionId), [patientId, admissionId], { tags: ['customers'] })

  if (profile.error) return <ErrorState message={profile.error} onRetry={profile.refetch} />
  if (!profile.data) return <PageLoader />
  const { patient: p, admissions } = profile.data
  const admission = admissions.find((a) => a.id === admissionId)
  const inactive = !!admission && !ACTIVE_ADMISSION.includes(admission.status)
  const list = entries.data ?? []
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }

  const rec = can('clinical.record')
  const notes = can('clinical.notes')
  const blockReason = inactive ? 'Entries can only be added to active admissions' : undefined
  const item = (kind: ClinicalEntryKind, allowed: boolean, why: string): MenuItem => ({
    label: (
      <span className="flex flex-col" title={!allowed ? why : blockReason}>
        <span>{CLINICAL_KIND_LABEL[kind]}</span>
        {!allowed && <span className="text-[11px] font-normal text-ink-400">{why}</span>}
      </span>
    ),
    onSelect: () => setDialog(kind),
    disabled: !allowed || inactive,
  })
  const menuItems: (MenuItem | 'divider')[] = [
    item('VITALS', rec, 'Requires clinical recording permission'),
    item('MEDICATION', rec, 'Requires clinical recording permission'),
    item('PROGRESS', rec, 'Requires clinical recording permission'),
    item('DOCUMENT', rec, 'Requires clinical recording permission'),
    'divider',
    item('ASSESSMENT', notes, 'Doctors only'),
    item('DOCTOR_NOTE', notes, 'Doctors only'),
    item('TREATMENT_PLAN', notes, 'Doctors only'),
    item('FOLLOW_UP', notes, 'Doctors only'),
  ]

  const timeline = list.filter((e) => !kindFilter || e.kind === kindFilter)
  const counts = { vitals: list.filter((e) => e.kind === 'VITALS').length, medication: list.filter((e) => e.kind === 'MEDICATION').length, notes: list.filter((e) => NOTE_KINDS.includes(e.kind)).length, documents: list.filter((e) => e.kind === 'DOCUMENT').length }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <PersonAvatar name={p.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/patients/${p.id}`} className="font-display text-lg font-bold text-ink-950 hover:text-brand-700">
                  {p.name}
                </Link>
                <Badge>{p.patientCode}</Badge>
                {p.bloodGroup && <Badge tone="danger">{p.bloodGroup}</Badge>}
              </div>
              <div className="mt-0.5 text-[13px] text-ink-500">
                {p.age} yrs · {p.gender.toLowerCase()} · DOB {formatDate(p.dateOfBirth)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.allergies.length ? (
                  p.allergies.map((a) => (
                    <Badge key={a} tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>
                      Allergy: {a}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="success">No known allergies</Badge>
                )}
                {p.conditions.map((c) => (
                  <Badge key={c} tone="info">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              aria-label="Admission"
              className="sm:min-w-64"
              value={admissionId ?? ''}
              onChange={(e) => onChangeAdmission(e.target.value || undefined)}
              options={[{ value: '', label: 'All records (OPD & IPD)' }, ...admissions.map((a) => ({ value: a.id, label: `${a.admissionNo} · ${a.status === 'DISCHARGED' ? 'discharged' : a.status.toLowerCase().replace(/_/g, ' ')}` }))]}
            />
            <Menu
              trigger={({ toggle, open }) => (
                <Button icon={<Plus className="h-4 w-4" />} iconRight={<ChevronDown className="h-3.5 w-3.5" />} onClick={toggle} aria-expanded={open} disabled={!rec && !notes}>
                  Add entry
                </Button>
              )}
              items={menuItems}
            />
            <Button variant="ghost" onClick={onClear}>
              Change patient
            </Button>
          </div>
        </div>
        {admission && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 px-5 py-3 text-[13px] text-ink-600">
            <AdmissionStatusBadge status={admission.status} />
            <Link to={`/admissions/${admission.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
              {admission.admissionNo}
            </Link>
            <span>Bed {admission.bedLabel ?? '—'}</span>
            <span>{admission.doctorName}</span>
            <span>{admission.diagnosis}</span>
            {admission.admittedAt && <span className="text-ink-400">admitted {relativeTime(admission.admittedAt)}</span>}
          </div>
        )}
      </Card>

      {inactive && <Alert tone="info">This admission is closed — its records are read-only.</Alert>}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'timeline', label: 'Timeline', count: list.length },
          { key: 'vitals', label: 'Vitals', count: counts.vitals },
          { key: 'medication', label: 'Medication', count: counts.medication },
          { key: 'notes', label: 'Notes & plans', count: counts.notes },
          { key: 'documents', label: 'Documents', count: counts.documents },
        ]}
      />

      {entries.error ? (
        <ErrorState message={entries.error} onRetry={entries.refetch} />
      ) : !entries.data ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : tab === 'vitals' ? (
        <VitalsPanel entries={list} />
      ) : (
        <Card>
          {tab === 'timeline' && (
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
              <span className="text-xs text-ink-500">{timeline.length} entries</span>
              <Select aria-label="Filter by entry type" selectSize="sm" className="w-56" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as ClinicalEntryKind | '')} options={[{ value: '', label: 'All entry types' }, ...ALL_KINDS.map((k) => ({ value: k, label: CLINICAL_KIND_LABEL[k] }))]} />
            </div>
          )}
          <CardBody className="pt-5">
            {tab === 'timeline' && <EntryList entries={timeline} empty="No clinical entries yet" />}
            {tab === 'medication' && <EntryList entries={list.filter((e) => e.kind === 'MEDICATION')} empty="No medication administration recorded" />}
            {tab === 'notes' && <EntryList entries={list.filter((e) => NOTE_KINDS.includes(e.kind))} empty="No notes or plans yet" />}
            {tab === 'documents' && <EntryList entries={list.filter((e) => e.kind === 'DOCUMENT')} empty="No documents uploaded" />}
          </CardBody>
        </Card>
      )}

      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Every entry is time-stamped and attributed to the signed-in user. Entries cannot be edited or deleted; add a new entry to correct a record.
      </p>

      {dialog && <AddEntryDialog kind={dialog} patientId={patientId} admissionId={admission && !inactive ? admission.id : undefined} onClose={() => setDialog(null)} />}
    </div>
  )
}
