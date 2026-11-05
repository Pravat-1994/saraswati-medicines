import { useState } from 'react'
import { IndianRupee, ReceiptText, TrendingUp, Undo2 } from 'lucide-react'
import { CardBody, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Tabs } from '../../components/ui/Tabs'
import { Legend, SERIES, TrendChart } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { reportService } from '../../services'
import { eachDay, formatDate, formatShortDay } from '../../lib/dates'
import { formatINR, formatNumber } from '../../lib/money'
import type { DateRange } from '../../types/api'
import type { SalesReportRow } from '../../types/views'
import { KpiGrid, ReportActions, ReportCard, TotalsFooter } from './ReportParts'

type Gran = 'day' | 'month'

export default function SalesReportTab({ range }: { range: DateRange }) {
  const auto: Gran = eachDay(range).length > 62 ? 'month' : 'day'
  const [chosen, setChosen] = useState<Gran | null>(null)
  const gran = chosen ?? auto
  const q = useQuery(() => reportService.sales(range, gran), [range.from, range.to, gran], { tags: ['sales', 'reports'] })

  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (q.loading || !q.data) return <Skeleton className="h-96 rounded-2xl" />

  const { rows, totals } = q.data
  const label = (p: string) => (gran === 'day' ? formatDate(p) : p)
  const columns: Column<SalesReportRow>[] = [
    { key: 'period', header: gran === 'day' ? 'Date' : 'Month', sortable: true, sortValue: (r) => r.period, cell: (r) => <span className="font-medium text-ink-900">{label(r.period)}</span> },
    { key: 'bills', header: 'Bills', align: 'right', sortable: true, sortValue: (r) => r.bills, cell: (r) => formatNumber(r.bills) },
    { key: 'units', header: 'Units', align: 'right', cell: (r) => formatNumber(r.units) },
    { key: 'gross', header: 'Gross', align: 'right', cell: (r) => formatINR(r.gross) },
    { key: 'discount', header: 'Discount', align: 'right', cell: (r) => formatINR(r.discount) },
    { key: 'taxable', header: 'Taxable', align: 'right', cell: (r) => formatINR(r.taxable) },
    { key: 'gst', header: 'GST', align: 'right', cell: (r) => formatINR(r.gst) },
    { key: 'returns', header: 'Returns', align: 'right', cell: (r) => (r.returns > 0 ? <span className="text-red-600">−{formatINR(r.returns)}</span> : formatINR(0)) },
    { key: 'net', header: 'Net sales', align: 'right', sortable: true, sortValue: (r) => r.net, cell: (r) => <span className="font-semibold">{formatINR(r.net)}</span> },
    { key: 'cost', header: 'Cost', align: 'right', cell: (r) => formatINR(r.cost) },
    { key: 'profit', header: 'Profit', align: 'right', sortable: true, sortValue: (r) => r.profit, cell: (r) => <span className="font-semibold text-emerald-700">{formatINR(r.profit)}</span> },
  ]
  const totalVals = {
    bills: formatNumber(totals.bills),
    units: formatNumber(totals.units),
    gross: formatINR(totals.gross),
    discount: formatINR(totals.discount),
    taxable: formatINR(totals.taxable),
    gst: formatINR(totals.gst),
    returns: formatINR(totals.returns),
    net: formatINR(totals.net),
    cost: formatINR(totals.cost),
    profit: formatINR(totals.profit),
  }

  return (
    <div className="space-y-6">
      <KpiGrid>
        <StatCard label="Net sales" value={formatINR(totals.net)} icon={<IndianRupee className="h-4 w-4" />} footer="After discounts & returns" />
        <StatCard label="Bills" value={formatNumber(totals.bills)} icon={<ReceiptText className="h-4 w-4" />} tone="blue" footer={`${formatNumber(totals.units)} units sold`} />
        <StatCard label="Gross profit" value={formatINR(totals.profit)} icon={<TrendingUp className="h-4 w-4" />} tone="violet" footer={totals.net > 0 ? `${((totals.profit / totals.net) * 100).toFixed(1)}% margin` : undefined} />
        <StatCard label="Returns refunded" value={formatINR(totals.returns)} icon={<Undo2 className="h-4 w-4" />} tone="amber" />
      </KpiGrid>

      <ReportCard
        title={gran === 'day' ? 'Daily sales' : 'Monthly sales'}
        description="Net sales and gross profit on a shared ₹ axis"
        actions={
          <Tabs<Gran>
            variant="pill"
            value={gran}
            onChange={setChosen}
            items={[
              { key: 'day', label: 'Daily' },
              { key: 'month', label: 'Monthly' },
            ]}
          />
        }
      >
        <CardBody>
          {totals.bills === 0 ? (
            <EmptyState title="No sales in this period" description="Choose a different date range to see sales." compact />
          ) : (
            <>
              <Legend
                className="mb-3"
                items={[
                  { label: 'Net sales', color: SERIES[0] },
                  { label: 'Gross profit', color: SERIES[1] },
                ]}
              />
              <TrendChart
                data={rows}
                xKey="period"
                formatX={gran === 'day' ? (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? formatShortDay(v) : v) : undefined}
                series={[
                  { key: 'net', label: 'Net sales', color: SERIES[0], type: 'area' },
                  { key: 'profit', label: 'Gross profit', color: SERIES[1], type: 'line' },
                ]}
              />
            </>
          )}
        </CardBody>
      </ReportCard>

      <ReportCard
        title="Sales register"
        description={`${rows.length} ${gran === 'day' ? 'days' : 'months'}`}
        actions={
          <ReportActions
            filename={`sales-${gran}-${range.from}-to-${range.to}`}
            rows={rows}
            columns={[
              { header: gran === 'day' ? 'Date' : 'Month', value: (r) => r.period },
              { header: 'Bills', value: (r) => r.bills },
              { header: 'Units', value: (r) => r.units },
              { header: 'Gross', value: (r) => r.gross },
              { header: 'Discount', value: (r) => r.discount },
              { header: 'Taxable', value: (r) => r.taxable },
              { header: 'GST', value: (r) => r.gst },
              { header: 'Returns', value: (r) => r.returns },
              { header: 'Net sales', value: (r) => r.net },
              { header: 'Cost', value: (r) => r.cost },
              { header: 'Profit', value: (r) => r.profit },
            ]}
          />
        }
      >
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.period} pageSize={31} dense caption="Sales register" footer={<TotalsFooter columns={columns} values={totalVals} />} />
      </ReportCard>
    </div>
  )
}
