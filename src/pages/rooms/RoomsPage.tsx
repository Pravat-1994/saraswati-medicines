import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRightLeft, BedDouble, ExternalLink, Info, Wrench } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { admissionService, bedService, roomService } from '../../services'
import { formatDateTime } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { BED_STATUS_LABEL, ROOM_TYPE_LABEL } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import { useCan } from '../../stores/sessionStore'
import type { BedStatus, RoomType } from '../../types/clinic'
import type { BedView } from '../../types/clinicApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, InfoRow } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { FilterSelect } from '../../components/ui/FilterBar'
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { Field, Input } from '../../components/ui/Form'
import { BedStatusBadge } from '../../components/clinic/ClinicBadges'
import { BedPickerModal } from '../admissions/BedPicker'

const TILE: Record<BedStatus, { box: string; dot: string }> = {
  AVAILABLE: { box: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-400', dot: 'bg-emerald-500' },
  OCCUPIED: { box: 'border-red-200 bg-red-50/70 hover:border-red-300', dot: 'bg-red-500' },
  RESERVED: { box: 'border-amber-200 bg-amber-50/80 hover:border-amber-300', dot: 'bg-amber-500' },
  MAINTENANCE: { box: 'border-ink-200 bg-ink-100/70 hover:border-ink-300', dot: 'bg-ink-400' },
}
const STATUSES: BedStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']

function BedDrawer({ bed, onClose }: { bed: BedView; onClose: () => void }) {
  const can = useCan()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [transfer, setTransfer] = useState(false)
  const admission = useQuery(() => admissionService.get(bed.admissionId!), [bed.admissionId], { enabled: !!bed.admissionId, tags: ['customers'] })
  const maint = useMutation((on: boolean) => bedService.setMaintenance(bed.id, on, note), { successMessage: (b) => (b.status === 'MAINTENANCE' ? `Bed ${b.label} taken out of service` : `Bed ${b.label} returned to service`), onSuccess: onClose })
  const free = bed.status === 'AVAILABLE' || bed.status === 'MAINTENANCE'

  return (
    <Modal
      open
      drawer
      size="md"
      onClose={onClose}
      icon={<BedDouble className="h-4 w-4" />}
      title={`Bed ${bed.label}`}
      description={`${bed.roomNumber} · ${ROOM_TYPE_LABEL[bed.roomType]} · ${bed.department}`}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {bed.admissionId && (
            <Button variant="outline" icon={<ExternalLink className="h-4 w-4" />} onClick={() => navigate(`/admissions/${bed.admissionId}`)}>
              Open admission
            </Button>
          )}
          {bed.status === 'OCCUPIED' && can('beds.manage') && admission.data && (
            <Button icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => setTransfer(true)}>
              Transfer patient
            </Button>
          )}
          {bed.status === 'AVAILABLE' && can('beds.manage') && (
            <Button variant="secondary" icon={<Wrench className="h-4 w-4" />} loading={maint.pending} onClick={() => maint.run(true)}>
              Set maintenance
            </Button>
          )}
          {bed.status === 'MAINTENANCE' && can('beds.manage') && (
            <Button loading={maint.pending} onClick={() => maint.run(false)}>
              Return to service
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <BedStatusBadge status={bed.status} />
          <span className="text-sm text-ink-600">{formatINR(bed.dailyRate)} per day</span>
        </div>
        {bed.patientName ? (
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
            <InfoRow label="Patient" value={bed.patientName} />
            <InfoRow label="Patient ID" value={<span className="font-mono">{bed.patientCode}</span>} />
            <InfoRow label="Admission" value={<span className="font-mono">{bed.admissionNo}</span>} />
            <InfoRow label={bed.status === 'RESERVED' ? 'Reserved since' : 'Admitted'} value={formatDateTime(bed.since)} />
            {admission.data && <InfoRow label="Doctor" value={admission.data.admission.doctorName} />}
            {admission.data && <InfoRow label="Diagnosis" value={admission.data.admission.diagnosis || '—'} />}
          </dl>
        ) : bed.status === 'MAINTENANCE' ? (
          <Alert tone="warning" icon={<Wrench className="h-4 w-4" />} title="Out of service">
            {bed.note ?? 'Under maintenance'}
          </Alert>
        ) : (
          <Alert tone="success">This bed is free and can be allocated from an approved admission.</Alert>
        )}
        {bed.status === 'AVAILABLE' && can('beds.manage') && (
          <Field label="Maintenance note" hint="Shown on the bed board while out of service">
            {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Mattress replacement" />}
          </Field>
        )}
        {!free && (
          <p className="flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> An allocated bed becomes available only after the patient is discharged, transferred or the admission is cancelled — it cannot be freed manually.
          </p>
        )}
      </div>
      {transfer && admission.data && <BedPickerModal open mode="transfer" admission={admission.data.admission} onClose={() => { setTransfer(false); onClose() }} />}
    </Modal>
  )
}

export default function RoomsPage() {
  const rooms = useQuery(() => roomService.list(), [], { tags: ['customers'] })
  const [type, setType] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<BedView>()

  const counts = useMemo(() => {
    const c: Record<BedStatus, number> = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0 }
    rooms.data?.forEach((r) => r.beds.forEach((b) => c[b.status]++))
    return c
  }, [rooms.data])
  const departments = [...new Set((rooms.data ?? []).map((r) => r.department))].sort()
  const visible = (rooms.data ?? []).filter((r) => (!type || r.type === type) && (!department || r.department === department) && (!status || r.beds.some((b) => b.status === status)))

  return (
    <div>
      <PageHeader title="Rooms & beds" description="Visual bed board. Click a bed for details, transfers or maintenance." breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Rooms & beds' }]} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? '' : s)}
            aria-pressed={status === s}
            className={cn('flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5', status === s ? 'border-brand-400 ring-2 ring-brand-500/15' : 'border-ink-200/70')}
          >
            <span className={cn('h-3 w-3 shrink-0 rounded-full', TILE[s].dot)} aria-hidden />
            <span>
              <span className="num block font-display text-2xl font-bold text-ink-950">{counts[s]}</span>
              <span className="text-xs text-ink-500">{BED_STATUS_LABEL[s]}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col flex-wrap gap-2 sm:flex-row">
        <FilterSelect label="Room type" value={type} onChange={setType} options={(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => ({ value: t, label: ROOM_TYPE_LABEL[t] }))} />
        <FilterSelect label="Department" value={department} onChange={setDepartment} options={departments.map((d) => ({ value: d, label: d }))} />
        <FilterSelect label="Bed status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: BED_STATUS_LABEL[s] }))} />
      </div>

      {rooms.error ? (
        <Card>
          <ErrorState message={rooms.error} onRetry={rooms.refetch} />
        </Card>
      ) : rooms.loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={<BedDouble className="h-5 w-5" />} title="No rooms match" description="Clear the filters to see all rooms." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div>
                  <h2 className="font-display text-base font-bold text-ink-950">{r.number}</h2>
                  <p className="text-xs text-ink-500">
                    {ROOM_TYPE_LABEL[r.type]} · {r.department} · Floor {r.floor}
                  </p>
                </div>
                <div className="text-right">
                  <div className="num text-sm font-semibold text-ink-900">{formatINR(r.dailyRate)}</div>
                  <div className="text-[11px] text-ink-400">per bed / day</div>
                </div>
              </div>
              <div className="px-5 pt-2 text-[11px] text-ink-500">
                {r.counts.AVAILABLE} available · {r.counts.OCCUPIED} occupied{r.counts.RESERVED ? ` · ${r.counts.RESERVED} reserved` : ''}
                {r.counts.MAINTENANCE ? ` · ${r.counts.MAINTENANCE} maintenance` : ''}
              </div>
              <div className="grid flex-1 grid-cols-2 content-start gap-2 p-5 sm:grid-cols-3">
                {r.beds.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelected(b)}
                    className={cn('flex min-h-[84px] flex-col items-start rounded-xl border p-2.5 text-left transition', TILE[b.status].box, status && b.status !== status && 'opacity-40')}
                    aria-label={`Bed ${b.label}, ${BED_STATUS_LABEL[b.status]}${b.patientName ? `, ${b.patientName}` : ''}`}
                  >
                    <span className="flex w-full items-center justify-between gap-1">
                      <span className="text-[12.5px] font-semibold text-ink-900">{b.label}</span>
                      <span className={cn('h-2 w-2 rounded-full', TILE[b.status].dot)} aria-hidden />
                    </span>
                    <span className="text-[11px] font-medium text-ink-600">{BED_STATUS_LABEL[b.status]}</span>
                    {b.patientName ? (
                      <span className="mt-auto w-full truncate text-[11px] text-ink-700">
                        {b.patientName}
                        <span className="block text-[10px] text-ink-400">{b.patientCode}</span>
                      </span>
                    ) : b.status === 'MAINTENANCE' ? (
                      <span className="mt-auto truncate text-[10px] text-ink-500">{b.note}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      {selected && <BedDrawer bed={selected} onClose={() => setSelected(undefined)} />}
    </div>
  )
}
