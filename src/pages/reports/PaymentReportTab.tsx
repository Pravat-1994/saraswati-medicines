import { Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react'
import { CardBody, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { SERIES, SegmentedBar } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { reportService } from '../../services'
import { formatINR, formatNumber, formatPct } from '../../lib/money'
import { PAYMENT_METHOD_LABEL } from '../../lib/sales'
import type { DateRange } from '../../types/api'
import type { PaymentBreakdownRow } from '../../types/views'
import { KpiGrid, ReportActions, ReportCard, TotalsFooter } from './ReportParts'

const ICONS = { CASH: Banknote, UPI: Smartphone, CARD: CreditCard, OTHER: Wallet }
const TONES = { CASH: 'brand', UPI: 'blue', CARD: 'violet', OTHER: 'ink' } as const

export default function PaymentReportTab({ range }: { range: DateRange }) {
  const q = useQuery(() => reportService.sales(range, 'month'), [range.from, range.to], { tags: ['sales', 'reports'] })
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (q.loading || !q.data) return <Skeleton className="h-96 rounded-2xl" />
  const rows = q.data.payments
  const total = rows.reduce((a, r) => a + r.amount, 0)
  const bills = rows.reduce((a, r) => a + r.bills, 0)
  const columns: Column<PaymentBreakdownRow>[] = [
    { key: 'method', header: 'Payment method', cell: (r) => <span className="font-medium text-ink-900">{PAYMENT_METHOD_LABEL[r.method]}</span> },
    { key: 'bills', header: 'Bills', align: 'right', cell: (r) => formatNumber(r.bills) },
    { key: 'avg', header: 'Average bill', align: 'right', cell: (r) => formatINR(r.bills ? r.amount / r.bills : 0) },
    { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <span className="font-semibold">{formatINR(r.amount)}</span> },
    { key: 'share', header: 'Share', align: 'right', cell: (r) => formatPct(r.share) },
  ]
  return (
    <div className="space-y-6">
      <KpiGrid>
        {rows.map((r) => {
          const I = ICONS[r.method]
          return <StatCard key={r.method} label={PAYMENT_METHOD_LABEL[r.method]} value={formatINR(r.amount)} icon={<I className="h-4 w-4" />} tone={TONES[r.method]} footer={`${formatNumber(r.bills)} bills · ${formatPct(r.share)}`} />
        })}
      </KpiGrid>
      <ReportCard title="Payment method mix" description="Net of approved returns">
        <CardBody>
          {bills === 0 ? (
            <EmptyState title="No sales in this period" compact />
          ) : (
            <SegmentedBar height={18} parts={rows.map((r, i) => ({ label: PAYMENT_METHOD_LABEL[r.method], value: r.amount, color: SERIES[i] }))} />
          )}
        </CardBody>
      </ReportCard>
      <ReportCard
        title="Payment method breakdown"
        actions={
          <ReportActions
            filename={`payment-methods-${range.from}-to-${range.to}`}
            rows={rows}
            columns={[
              { header: 'Method', value: (r) => PAYMENT_METHOD_LABEL[r.method] },
              { header: 'Bills', value: (r) => r.bills },
              { header: 'Amount', value: (r) => r.amount },
              { header: 'Share %', value: (r) => r.share.toFixed(2) },
            ]}
          />
        }
      >
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.method} pageSize={0} caption="Payment method breakdown" footer={<TotalsFooter columns={columns} values={{ bills: formatNumber(bills), amount: formatINR(total), share: bills ? '100%' : '—' }} />} />
      </ReportCard>
    </div>
  )
}
