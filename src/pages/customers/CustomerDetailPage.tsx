import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CalendarClock, IndianRupee, Mail, MapPin, Pencil, Phone, ReceiptText, ScanBarcode, ShoppingBag, StickyNote, Cake } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Badge, SaleStatusBadge } from '../../components/ui/Badge'
import { RankedBars, SERIES } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { customerService } from '../../services'
import { useCan } from '../../stores/sessionStore'
import { formatINR, formatNumber } from '../../lib/money'
import { formatDate, formatDateTime, relativeTime } from '../../lib/dates'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import { initials } from '../../lib/utils'
import type { SaleListItem } from '../../types/views'
import { CustomerFormModal } from './CustomerFormModal'

export default function CustomerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const can = useCan()
  const [editing, setEditing] = useState(false)
  const q = useQuery(() => customerService.get(id), [id], { tags: ['customers', 'sales'] })

  if (q.loading) return <PageLoader />
  if (q.error || !q.data)
    return (
      <Card>
        <ErrorState message={q.error ?? 'Customer not found.'} onRetry={q.refetch} />
      </Card>
    )

  const d = q.data
  const c = d.customer
  const columns: Column<SaleListItem>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      sortValue: (s) => s.invoiceNumber,
      sortable: true,
      cell: (s) => <span className="num font-medium text-brand-700">{s.invoiceNumber}</span>,
    },
    { key: 'date', header: 'Date', sortable: true, sortValue: (s) => s.date, cell: (s) => formatDateTime(s.date) },
    { key: 'items', header: 'Items', align: 'right', hideBelow: 'sm', cell: (s) => `${s.itemCount} · ${s.unitCount} units` },
    { key: 'payment', header: 'Payment', hideBelow: 'md', cell: (s) => <Badge tone="neutral">{PAYMENT_METHOD_LABEL[s.paymentMethod]}</Badge> },
    { key: 'status', header: 'Status', hideBelow: 'lg', cell: (s) => <SaleStatusBadge status={s.status} /> },
    { key: 'total', header: 'Amount', align: 'right', sortable: true, sortValue: (s) => s.grandTotal, cell: (s) => <span className="font-semibold">{formatINR(s.grandTotal)}</span> },
  ]

  return (
    <>
      <PageHeader
        title={c.name}
        breadcrumbs={[{ label: 'Customers', to: '/customers' }, { label: c.name }]}
        badge={d.visits >= 5 ? <Badge tone="brand">Regular customer</Badge> : undefined}
        description={`Customer since ${formatDate(c.createdAt)}`}
        actions={
          <>
            {can('customers.manage') && (
              <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can('sales.pos') && (
              <Button icon={<ScanBarcode className="h-4 w-4" />} onClick={() => navigate('/pos')}>
                New sale
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total spent" value={formatINR(d.totalSpent)} icon={<IndianRupee className="h-4 w-4" />} />
        <StatCard label="Visits" value={formatNumber(d.visits)} icon={<ShoppingBag className="h-4 w-4" />} tone="blue" />
        <StatCard label="Average bill" value={formatINR(d.averageBill)} icon={<ReceiptText className="h-4 w-4" />} tone="violet" />
        <StatCard
          label="Last visit"
          value={d.lastVisit ? relativeTime(d.lastVisit) : 'Never'}
          footer={d.lastVisit ? formatDate(d.lastVisit) : undefined}
          icon={<CalendarClock className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardBody className="pt-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-sm font-bold text-white">{initials(c.name)}</span>
                <div>
                  <div className="font-display font-semibold text-ink-900">{c.name}</div>
                  <div className="text-xs text-ink-500">Customer ID {c.id}</div>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-[13px]">
                <li className="flex items-center gap-2.5 text-ink-700">
                  <Phone className="h-4 w-4 text-ink-400" />
                  <span className="num">{c.phone}</span>
                </li>
                <li className="flex items-center gap-2.5 text-ink-700">
                  <Mail className="h-4 w-4 text-ink-400" />
                  {c.email ?? <span className="text-ink-400">No email</span>}
                </li>
                <li className="flex items-start gap-2.5 text-ink-700">
                  <MapPin className="mt-0.5 h-4 w-4 text-ink-400" />
                  {c.address ?? <span className="text-ink-400">No address</span>}
                </li>
                {c.dateOfBirth && (
                  <li className="flex items-center gap-2.5 text-ink-700">
                    <Cake className="h-4 w-4 text-ink-400" />
                    {formatDate(c.dateOfBirth)}
                  </li>
                )}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes" icon={<StickyNote className="h-4 w-4" />} />
            <CardBody>
              {c.notes ? <p className="text-[13px] leading-relaxed whitespace-pre-line text-ink-700">{c.notes}</p> : <p className="text-[13px] text-ink-400">No notes recorded.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Most purchased" description="By units, net of returns" />
            <CardBody>
              {d.topMedicines.length ? (
                <RankedBars
                  color={SERIES[0]}
                  items={d.topMedicines.map((m) => ({ key: m.medicineId, label: m.medicineName, value: m.units, sub: formatINR(m.spent) }))}
                  format={(v) => `${formatNumber(v)} units`}
                />
              ) : (
                <p className="text-[13px] text-ink-400">No purchases yet.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Purchase history" description={`${d.sales.length} invoice${d.sales.length === 1 ? '' : 's'}`} />
          <DataTable
            columns={columns}
            rows={d.sales}
            rowKey={(s) => s.id}
            onRowClick={(s) => navigate(`/sales/${s.id}`)}
            pageSize={10}
            caption="Customer purchase history"
            empty={<EmptyState icon={<ReceiptText className="h-5 w-5" />} title="No purchases yet" description="Sales billed to this customer will appear here." compact />}
          />
        </Card>
      </div>

      <CustomerFormModal open={editing} onClose={() => setEditing(false)} customer={c} />
    </>
  )
}
