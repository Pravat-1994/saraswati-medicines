import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Plus, SlidersHorizontal, X } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Tabs } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { ApprovalBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/Feedback'
import { Field, Textarea } from '../../components/ui/Form'
import { Modal } from '../../components/ui/Modal'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { formatDateTime } from '../../lib/dates'
import { cn } from '../../lib/utils'
import { inventoryService, type AdjustmentView } from '../../services/inventoryService'
import { useCan } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import type { ApprovalStatus } from '../../types/domain'
import { AdjustmentModal } from './dialogs'
import { ADJUSTMENT_TYPE_LABEL } from './labels'

type StatusTab = ApprovalStatus | 'ALL'

function DecisionModal({ adjustment, approve, onClose }: { adjustment: AdjustmentView | null; approve: boolean; onClose: () => void }) {
  const [note, setNote] = useState('')
  const m = useMutation((id: string) => inventoryService.decideAdjustment(id, approve, note.trim() || undefined), {
    successMessage: approve ? 'Adjustment approved and applied to stock.' : 'Adjustment rejected.',
    onSuccess: () => {
      setNote('')
      onClose()
    },
  })
  const tooMuch = approve && adjustment && adjustment.type !== 'INCREASE' && adjustment.quantity > adjustment.available
  return (
    <Modal
      open={!!adjustment}
      onClose={onClose}
      size="sm"
      title={approve ? 'Approve adjustment' : 'Reject adjustment'}
      dismissible={!m.pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={m.pending}>
            Cancel
          </Button>
          <Button variant={approve ? 'primary' : 'danger'} loading={m.pending} disabled={!!tooMuch || (!approve && !note.trim())} onClick={() => adjustment && void m.run(adjustment.id)}>
            {approve ? 'Approve & apply' : 'Reject'}
          </Button>
        </>
      }
    >
      {adjustment && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-3.5 text-[13px]">
            <div>
              <dt className="text-xs text-ink-500">Medicine</dt>
              <dd className="font-medium text-ink-900">{adjustment.medicineName}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Batch</dt>
              <dd className="font-mono text-ink-800">{adjustment.batchNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Change</dt>
              <dd className="font-medium text-ink-900">
                {ADJUSTMENT_TYPE_LABEL[adjustment.type]} · {adjustment.quantity} units
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Currently available</dt>
              <dd className="num font-medium text-ink-900">{adjustment.available}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-ink-500">Reason ({adjustment.requestedBy})</dt>
              <dd className="text-ink-800">{adjustment.reason}</dd>
            </div>
          </dl>
          {tooMuch && <p className="text-xs font-medium text-red-600">Stock has changed since this request — only {adjustment.available} units are available now. Reject and ask for a new request.</p>}
          <Field label={approve ? 'Note (optional)' : 'Reason for rejection'} required={!approve}>
            {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={approve ? 'e.g. Verified physically' : 'e.g. Recount shows no variance'} />}
          </Field>
        </div>
      )}
    </Modal>
  )
}

export function AdjustmentsTab() {
  const can = useCan()
  const settings = useSettings()
  const [status, setStatus] = useState<StatusTab>('ALL')
  const [creating, setCreating] = useState(false)
  const [decision, setDecision] = useState<{ adj: AdjustmentView; approve: boolean } | null>(null)
  const q = useQuery(() => inventoryService.adjustments('ALL'), [], { tags: ['inventory'] })
  const all = q.data ?? []
  const rows = status === 'ALL' ? all : all.filter((a) => a.status === status)
  const count = (s: ApprovalStatus) => all.filter((a) => a.status === s).length

  const columns: Column<AdjustmentView>[] = [
    {
      key: 'number',
      header: 'Adjustment',
      sortValue: (a) => a.requestedAt,
      sortable: true,
      cell: (a) => (
        <span className="block">
          <span className="block font-medium text-ink-900">{a.adjustmentNumber}</span>
          <span className="num text-xs text-ink-500">{formatDateTime(a.requestedAt)}</span>
        </span>
      ),
    },
    {
      key: 'medicine',
      header: 'Medicine / batch',
      sortable: true,
      sortValue: (a) => a.medicineName,
      cell: (a) => (
        <Link to={`/medicines/${a.medicineId}`} className="block hover:text-brand-700">
          <span className="block font-medium text-ink-900">{a.medicineName}</span>
          <span className="font-mono text-[11px] text-ink-500">{a.batchNumber}</span>
        </Link>
      ),
    },
    { key: 'type', header: 'Type', hideBelow: 'md', cell: (a) => <span className="text-ink-700">{ADJUSTMENT_TYPE_LABEL[a.type]}</span> },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      sortable: true,
      sortValue: (a) => a.quantity,
      cell: (a) => <span className={cn('font-semibold', a.type === 'INCREASE' ? 'text-emerald-700' : 'text-red-600')}>{a.type === 'INCREASE' ? '+' : '−'}{a.quantity}</span>,
    },
    { key: 'reason', header: 'Reason', hideBelow: 'lg', cell: (a) => <span className="line-clamp-2 max-w-64 text-ink-600">{a.reason}</span> },
    {
      key: 'people',
      header: 'Requested / decided',
      hideBelow: 'xl',
      cell: (a) => (
        <span className="block text-xs text-ink-600">
          {a.requestedBy}
          {a.decidedBy && <span className="block text-ink-400">→ {a.decidedBy}{a.decisionNote ? ` · ${a.decisionNote}` : ''}</span>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (a) => <ApprovalBadge status={a.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (a) =>
        a.status === 'PENDING' && can('inventory.approve') ? (
          <div className="flex justify-end gap-1">
            <Button size="xs" variant="subtle" icon={<Check className="h-3.5 w-3.5" />} onClick={() => setDecision({ adj: a, approve: true })}>
              Approve
            </Button>
            <Button size="xs" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => setDecision({ adj: a, approve: false })}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          variant="pill"
          value={status}
          onChange={setStatus}
          items={[
            { key: 'ALL', label: 'All', count: all.length },
            { key: 'PENDING', label: 'Pending', count: count('PENDING') },
            { key: 'APPROVED', label: 'Approved', count: count('APPROVED') },
            { key: 'REJECTED', label: 'Rejected', count: count('REJECTED') },
          ]}
        />
        {can('inventory.adjust') && (
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New adjustment
          </Button>
        )}
      </div>
      <p className="border-b border-ink-100 bg-ink-50/50 px-4 py-2 text-xs text-ink-500">
        Approval policy: {settings.adjustmentApprovalThreshold > 0 ? `adjustments above ${settings.adjustmentApprovalThreshold} units` : 'all adjustments'} require a Store Manager or Administrator. Authorised roles’ adjustments apply immediately.
      </p>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        loading={q.loading}
        error={q.error}
        onRetry={q.refetch}
        pageSize={12}
        empty={<EmptyState compact icon={<SlidersHorizontal className="h-5 w-5" />} title={status === 'PENDING' ? 'Nothing awaiting approval' : 'No adjustments'} description="Stock adjustments and their approval decisions appear here." />}
      />
      <AdjustmentModal open={creating} onClose={() => setCreating(false)} />
      <DecisionModal key={decision ? `${decision.adj.id}-${decision.approve}` : 'none'} adjustment={decision?.adj ?? null} approve={decision?.approve ?? true} onClose={() => setDecision(null)} />
    </Card>
  )
}
