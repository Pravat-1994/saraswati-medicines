import { useState } from 'react'
import { BedDouble, Check } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { bedService, roomService } from '../../services'
import { formatINR } from '../../lib/money'
import { ROOM_TYPE_LABEL } from '../../lib/clinic'
import { cn } from '../../lib/utils'
import type { RoomType } from '../../types/clinic'
import type { AdmissionView } from '../../types/clinicApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Textarea } from '../../components/ui/Form'
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/Badge'

/** Visual grid of available beds grouped by room. */
export function BedGrid({ value, onChange, preferredType, excludeBedId }: { value?: string; onChange: (bedId: string) => void; preferredType?: RoomType; excludeBedId?: string }) {
  const rooms = useQuery(() => roomService.list(), [], { tags: ['customers'] })
  const [onlyPreferred, setOnlyPreferred] = useState(!!preferredType)
  if (rooms.loading) return <Skeleton className="h-64 rounded-xl" />
  const list = (rooms.data ?? [])
    .map((r) => ({ ...r, free: r.beds.filter((b) => b.status === 'AVAILABLE' && b.id !== excludeBedId) }))
    .filter((r) => r.free.length > 0 && (!onlyPreferred || !preferredType || r.type === preferredType))
    .sort((a, b) => Number(b.type === preferredType) - Number(a.type === preferredType))
  return (
    <div className="space-y-3">
      {preferredType && (
        <label className="flex items-center gap-2 text-[13px] text-ink-600">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={onlyPreferred} onChange={(e) => setOnlyPreferred(e.target.checked)} />
          Show only {ROOM_TYPE_LABEL[preferredType]} beds (requested)
        </label>
      )}
      {list.length === 0 ? (
        <EmptyState compact icon={<BedDouble className="h-5 w-5" />} title="No available beds" description={onlyPreferred ? 'No beds of the requested type are free — show all room types.' : 'All beds are occupied, reserved or under maintenance.'} />
      ) : (
        list.map((r) => (
          <div key={r.id} className={cn('rounded-xl border p-3', r.type === preferredType ? 'border-brand-200 bg-brand-50/30' : 'border-ink-200')}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px]">
                <span className="font-semibold text-ink-900">{r.number}</span> <span className="text-ink-500">· {ROOM_TYPE_LABEL[r.type]} · {r.department} · Floor {r.floor}</span>
              </div>
              <span className="flex items-center gap-2 text-xs text-ink-500">
                {r.type === preferredType && <Badge tone="brand">Requested type</Badge>}
                {formatINR(r.dailyRate)}/day
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.free.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onChange(b.id)}
                  aria-pressed={value === b.id}
                  className={cn(
                    'flex min-w-24 items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition',
                    value === b.id ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400',
                  )}
                >
                  {value === b.id ? <Check className="h-4 w-4" /> : <BedDouble className="h-4 w-4" />}
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

/** Allocate (reserve) a bed for an approved admission, or transfer an admitted patient. */
export function BedPickerModal({ open, onClose, admission, mode }: { open: boolean; onClose: () => void; admission: AdmissionView; mode: 'allocate' | 'transfer' }) {
  const [bedId, setBedId] = useState<string>()
  const [reason, setReason] = useState('')
  const allocate = useMutation(() => bedService.allocate(admission.id, bedId!), { successMessage: (a) => `Bed ${a.bedLabel} reserved for ${a.patientName}`, onSuccess: onClose })
  const transfer = useMutation(() => bedService.transfer(admission.id, bedId!, reason), { successMessage: (a) => `Transferred to bed ${a.bedLabel}`, onSuccess: onClose })
  const pending = allocate.pending || transfer.pending
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      dismissible={!pending}
      icon={<BedDouble className="h-4 w-4" />}
      title={mode === 'allocate' ? 'Allocate a bed' : 'Transfer to another bed'}
      description={`${admission.patientName} · ${admission.admissionNo}${admission.bedLabel ? ` · currently ${admission.bedLabel}` : ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!bedId || (mode === 'transfer' && !reason.trim())} loading={pending} onClick={() => (mode === 'allocate' ? allocate.run() : transfer.run())}>
            {mode === 'allocate' ? 'Reserve bed' : 'Transfer patient'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === 'allocate' ? (
          <Alert tone="info">The bed is reserved now and becomes occupied when the admission is confirmed. A bed can only be held by one active patient.</Alert>
        ) : (
          <Alert tone="info">The current bed is released only when the transfer completes. Room charges for the nights already spent are posted to the patient’s bill.</Alert>
        )}
        <BedGrid value={bedId} onChange={setBedId} excludeBedId={admission.bedId} preferredType={mode === 'allocate' ? admission.preferredRoomType : undefined} />
        {mode === 'transfer' && (
          <Field label="Reason for transfer" required>
            {(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Shifted to private room on request / needs isolation" />}
          </Field>
        )}
      </div>
    </Modal>
  )
}
