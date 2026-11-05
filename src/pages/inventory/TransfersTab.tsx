import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ArrowRightLeft, Plus } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Alert, EmptyState } from '../../components/ui/Feedback'
import { useQuery } from '../../hooks/useQuery'
import { formatDateTime } from '../../lib/dates'
import { inventoryService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import { useSettings } from '../../stores/settingsStore'
import type { StockTransfer } from '../../types/domain'
import { TransferModal } from './dialogs'

type Row = StockTransfer & { medicineName: string; batchNumber: string }

export function TransfersTab() {
  const can = useCan()
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const q = useQuery(() => inventoryService.transfers(), [], { tags: ['inventory'] })
  const allowed = settings.enableStockTransfers && can('inventory.transfer')

  const columns: Column<Row>[] = [
    {
      key: 'number',
      header: 'Transfer',
      sortable: true,
      sortValue: (t) => t.timestamp,
      cell: (t) => (
        <span className="block">
          <span className="block font-medium text-ink-900">{t.transferNumber}</span>
          <span className="num text-xs text-ink-500">{formatDateTime(t.timestamp)}</span>
        </span>
      ),
    },
    {
      key: 'medicine',
      header: 'Medicine / batch',
      cell: (t) => (
        <Link to={`/medicines/${t.medicineId}`} className="block hover:text-brand-700">
          <span className="block font-medium text-ink-900">{t.medicineName}</span>
          <span className="font-mono text-[11px] text-ink-500">{t.batchNumber}</span>
        </Link>
      ),
    },
    {
      key: 'route',
      header: 'From → to',
      cell: (t) => (
        <span className="inline-flex items-center gap-1.5 text-ink-700">
          {t.fromLocation} <ArrowRight className="h-3.5 w-3.5 text-ink-400" /> {t.toLocation}
        </span>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', sortable: true, sortValue: (t) => t.quantity, cell: (t) => <span className="font-semibold">{t.quantity}</span> },
    { key: 'by', header: 'By', hideBelow: 'md', cell: (t) => <span className="text-ink-600">{t.performedBy}</span> },
    { key: 'note', header: 'Note', hideBelow: 'lg', cell: (t) => <span className="text-ink-500">{t.note ?? '—'}</span> },
  ]

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-ink-900">Stock transfers</h3>
          <p className="text-[13px] text-ink-500">Locations: {settings.locations.join(' · ')}</p>
        </div>
        {allowed && (
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            New transfer
          </Button>
        )}
      </div>
      {!settings.enableStockTransfers && (
        <Alert tone="info" className="m-4">
          Stock transfers are disabled. An administrator can enable them in Settings.
        </Alert>
      )}
      <DataTable
        columns={columns}
        rows={q.data}
        rowKey={(t) => t.id}
        loading={q.loading}
        error={q.error}
        onRetry={q.refetch}
        pageSize={12}
        empty={
          <EmptyState
            compact
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="No transfers yet"
            description="Move stock between the back store, main shelf and cold storage while keeping batch traceability."
            action={allowed ? <Button size="sm" onClick={() => setOpen(true)}>Transfer stock</Button> : undefined}
          />
        }
      />
      <TransferModal open={open} onClose={() => setOpen(false)} />
    </Card>
  )
}
