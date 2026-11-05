import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Check, Download, ReceiptText, ScanBarcode, X } from 'lucide-react'
import { useMutation, useQuery } from '../../hooks/useQuery'
import { useTableState } from '../../hooks/useTableState'
import { salesService } from '../../services'
import { formatDateTime } from '../../lib/dates'
import { formatINR, sumMoney } from '../../lib/money'
import { downloadCsv } from '../../lib/export'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import { useCan } from '../../stores/sessionStore'
import type { SaleFilters } from '../../types/api'
import type { ApprovalStatus, SaleReturn } from '../../types/domain'
import type { SaleListItem } from '../../types/views'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '../../components/ui/FilterBar'
import { DateRangeFilter, type DateFilterValue } from '../../components/ui/DateRangeFilter'
import { dateFilter } from '../../lib/dates'
import { ApprovalBadge, Badge, SaleStatusBadge } from '../../components/ui/Badge'
import { Tabs } from '../../components/ui/Tabs'
import { EmptyState } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { Field, Textarea } from '../../components/ui/Form'

type TabKey = 'history' | 'returns'

export default function SalesPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) ?? 'history'
  const can = useCan()
  const navigate = useNavigate()
  const pending = useQuery(() => salesService.returns('PENDING'), [], { tags: ['sales'] })
  return (
    <div>
      <PageHeader
        title="Sales & Returns"
        description="Invoice history, customer returns and refund approvals."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Sales' }]}
        actions={
          can('sales.pos') && (
            <Button icon={<ScanBarcode className="h-4 w-4" />} onClick={() => navigate('/pos')}>
              New sale
            </Button>
          )
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(k) => setParams({ tab: k }, { replace: true })}
        items={[
          { key: 'history', label: 'Sales history' },
          { key: 'returns', label: 'Returns & refunds', count: pending.data?.length || undefined },
        ]}
      />
      {tab === 'history' ? <SalesHistory /> : <ReturnsTab />}
    </div>
  )
}

function SalesHistory() {
  const navigate = useNavigate()
  const [date, setDate] = useState<DateFilterValue>(dateFilter('MONTH'))
  const t = useTableState<SaleFilters>({ paymentMethod: 'ALL', status: 'ALL' }, { pageSize: 15 })
  const query = { ...t.query, filters: { ...t.query.filters, range: date.range } }
  const list = useQuery(() => salesService.list(query), [JSON.stringify(query)], { tags: ['sales'] })
  const totals = useQuery(
    async () => {
      const all = await salesService.list({ ...query, page: 1, pageSize: 100000 })
      return { revenue: sumMoney(all.items.map((s) => s.grandTotal)), bills: all.total, gst: sumMoney(all.items.map((s) => s.gstTotal)), discount: sumMoney(all.items.map((s) => s.discountTotal)), rows: all.items }
    },
    [JSON.stringify({ ...query, page: 1 })],
    { tags: ['sales'] },
  )

  const columns: Column<SaleListItem>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      sortable: true,
      cell: (s) => (
        <div>
          <div className="font-mono text-[13px] font-semibold text-ink-900">{s.invoiceNumber}</div>
          <div className="text-xs text-ink-500">{formatDateTime(s.date)}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      cell: (s) => (
        <div>
          <div className="text-ink-900">{s.customerName}</div>
          {s.customerPhone && <div className="text-xs text-ink-500">{s.customerPhone}</div>}
        </div>
      ),
    },
    { key: 'items', header: 'Items', align: 'right', hideBelow: 'md', cell: (s) => `${s.itemCount} / ${s.unitCount}u` },
    { key: 'payment', header: 'Payment', sortable: true, hideBelow: 'sm', cell: (s) => <Badge tone="neutral">{PAYMENT_METHOD_LABEL[s.paymentMethod]}</Badge> },
    { key: 'cashier', header: 'Cashier', hideBelow: 'xl', cell: (s) => <span className="text-ink-600">{s.cashierName}</span> },
    { key: 'status', header: 'Status', hideBelow: 'lg', cell: (s) => <SaleStatusBadge status={s.status} /> },
    { key: 'total', header: 'Amount', sortable: true, align: 'right', cell: (s) => <span className="font-semibold text-ink-900">{formatINR(s.grandTotal)}</span> },
  ]

  const exportCsv = () =>
    totals.data &&
    downloadCsv(`sales-${date.range.from}-to-${date.range.to}`, totals.data.rows, [
      { header: 'Invoice', value: (s) => s.invoiceNumber },
      { header: 'Date', value: (s) => s.date },
      { header: 'Customer', value: (s) => s.customerName },
      { header: 'Payment', value: (s) => PAYMENT_METHOD_LABEL[s.paymentMethod] },
      { header: 'Subtotal', value: (s) => s.subtotal },
      { header: 'Discount', value: (s) => s.discountTotal },
      { header: 'Taxable', value: (s) => s.taxableTotal },
      { header: 'CGST', value: (s) => s.cgstTotal },
      { header: 'SGST', value: (s) => s.sgstTotal },
      { header: 'Round off', value: (s) => s.roundOff },
      { header: 'Total', value: (s) => s.grandTotal },
      { header: 'Status', value: (s) => s.status },
      { header: 'Cashier', value: (s) => s.cashierName },
    ])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter value={date} onChange={(v) => { setDate(v); t.setPage(1) }} />
        <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!totals.data}>
          Export CSV
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Net sales" value={totals.data ? formatINR(totals.data.revenue) : '…'} />
        <StatCard label="Invoices" value={totals.data?.bills ?? '…'} tone="violet" />
        <StatCard label="GST collected" value={totals.data ? formatINR(totals.data.gst) : '…'} tone="blue" />
        <StatCard label="Discounts given" value={totals.data ? formatINR(totals.data.discount) : '…'} tone="amber" />
      </div>
      <Card>
        <FilterBar active={!!(t.search || t.filters.paymentMethod !== 'ALL' || t.filters.status !== 'ALL')} onReset={t.reset}>
          <SearchInput value={t.search} onChange={t.setSearch} placeholder="Invoice, customer, phone or medicine" />
          <FilterSelect
            label="Payment"
            value={t.filters.paymentMethod === 'ALL' ? '' : (t.filters.paymentMethod ?? '')}
            onChange={(v) => t.setFilters((f) => ({ ...f, paymentMethod: (v || 'ALL') as SaleFilters['paymentMethod'] }))}
            options={(['CASH', 'UPI', 'CARD', 'OTHER'] as const).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
          />
          <FilterSelect
            label="Status"
            value={t.filters.status === 'ALL' ? '' : (t.filters.status ?? '')}
            onChange={(v) => t.setFilters((f) => ({ ...f, status: v || 'ALL' }))}
            options={[
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'PARTIALLY_RETURNED', label: 'Partly returned' },
              { value: 'RETURNED', label: 'Returned' },
            ]}
          />
        </FilterBar>
        <DataTable
          caption="Sales"
          columns={columns}
          rows={list.data?.items}
          rowKey={(s) => s.id}
          loading={list.fetching}
          error={list.error}
          onRetry={list.refetch}
          onRowClick={(s) => navigate(`/sales/${s.id}`)}
          server={{ total: list.data?.total ?? 0, page: t.page, pageSize: t.pageSize, sortBy: t.sortBy, sortDir: t.sortDir, onPageChange: t.setPage, onPageSizeChange: t.setPageSize, onSort: t.toggleSort }}
          empty={<EmptyState icon={<ReceiptText className="h-5 w-5" />} title="No sales in this period" description="Change the date range or filters to see more invoices." />}
        />
      </Card>
    </div>
  )
}

function ReturnsTab() {
  const can = useCan()
  const [status, setStatus] = useState<ApprovalStatus | 'ALL'>('ALL')
  const [deciding, setDeciding] = useState<{ ret: SaleReturn; approve: boolean } | null>(null)
  const [note, setNote] = useState('')
  const list = useQuery(() => salesService.returns(status), [status], { tags: ['sales'] })
  const decide = useMutation((id: string, approve: boolean, n: string) => salesService.decideReturn(id, approve, n || undefined), {
    successMessage: (r) => (r.status === 'APPROVED' ? `Return ${r.returnNumber} approved` : `Return ${r.returnNumber} rejected`),
    onSuccess: () => {
      setDeciding(null)
      setNote('')
    },
  })

  const columns: Column<SaleReturn>[] = [
    {
      key: 'no',
      header: 'Return',
      cell: (r) => (
        <div>
          <div className="font-mono text-[13px] font-semibold">{r.returnNumber}</div>
          <div className="text-xs text-ink-500">{formatDateTime(r.date)}</div>
        </div>
      ),
    },
    {
      key: 'invoice',
      header: 'Original invoice',
      cell: (r) => (
        <Link to={`/sales/${r.saleId}`} className="font-mono text-[13px] text-brand-700 hover:underline">
          {r.invoiceNumber}
        </Link>
      ),
    },
    { key: 'customer', header: 'Customer', hideBelow: 'md', cell: (r) => r.customerName },
    { key: 'items', header: 'Items', hideBelow: 'lg', cell: (r) => <span className="text-ink-600">{r.items.map((i) => `${i.quantity} × ${i.medicineName}`).join(', ')}</span> },
    { key: 'reason', header: 'Reason', hideBelow: 'xl', cell: (r) => <span className="text-ink-600">{r.reason}</span> },
    { key: 'by', header: 'Requested by', hideBelow: 'xl', cell: (r) => <span className="text-ink-600">{r.requestedBy}{r.decidedBy ? ` · ${r.status.toLowerCase()} by ${r.decidedBy}` : ''}</span> },
    { key: 'refund', header: 'Refund', align: 'right', cell: (r) => <span className="font-semibold">{formatINR(r.totalRefund)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <ApprovalBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status === 'PENDING' && can('returns.approve') ? (
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="outline" icon={<X className="h-3 w-3" />} onClick={() => setDeciding({ ret: r, approve: false })}>
              Reject
            </Button>
            <Button size="xs" icon={<Check className="h-3 w-3" />} onClick={() => setDeciding({ ret: r, approve: true })}>
              Approve
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <Card>
      <Tabs
        variant="pill"
        className="m-4"
        value={status}
        onChange={setStatus}
        items={[
          { key: 'ALL', label: 'All' },
          { key: 'PENDING', label: 'Pending approval' },
          { key: 'APPROVED', label: 'Approved' },
          { key: 'REJECTED', label: 'Rejected' },
        ]}
      />
      <DataTable
        caption="Returns"
        columns={columns}
        rows={list.data}
        rowKey={(r) => r.id}
        loading={list.fetching}
        error={list.error}
        onRetry={list.refetch}
        pageSize={15}
        empty={<EmptyState title="No returns" description="Returns are started from an invoice (Sales → invoice → Return items)." />}
      />
      <Modal
        open={!!deciding}
        onClose={() => setDeciding(null)}
        dismissible={!decide.pending}
        size="sm"
        title={deciding?.approve ? `Approve ${deciding.ret.returnNumber}?` : `Reject ${deciding?.ret.returnNumber}?`}
        description={deciding ? `Refund ${formatINR(deciding.ret.totalRefund)} to ${deciding.ret.customerName}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeciding(null)} disabled={decide.pending}>
              Cancel
            </Button>
            <Button variant={deciding?.approve ? 'primary' : 'danger'} loading={decide.pending} onClick={() => deciding && decide.run(deciding.ret.id, deciding.approve, note)}>
              {deciding?.approve ? 'Approve & refund' : 'Reject return'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-600">
          {deciding?.approve ? 'Approving refunds the customer and returns restockable units to their original batches.' : 'Rejecting leaves stock and the invoice unchanged.'}
        </p>
        <Field label="Decision note">{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the audit trail" />}</Field>
      </Modal>
    </Card>
  )
}
