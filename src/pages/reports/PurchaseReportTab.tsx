import { Link } from 'react-router'
import { IndianRupee, Landmark, ShoppingCart, Wallet } from 'lucide-react'
import { CardBody, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { ColumnChart, SERIES } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { reportService } from '../../services'
import { formatINR, formatNumber } from '../../lib/money'
import { cn } from '../../lib/utils'
import type { DateRange } from '../../types/api'
import type { PurchaseReportRow } from '../../types/views'
import { KpiGrid, ReportActions, ReportCard, TotalsFooter } from './ReportParts'

export default function PurchaseReportTab({ range }: { range: DateRange }) {
  const q = useQuery(() => reportService.purchases(range), [range.from, range.to], { tags: ['purchases', 'reports'] })
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (q.loading || !q.data) return <Skeleton className="h-96 rounded-2xl" />
  const { rows, monthly, totals } = q.data

  const columns: Column<PurchaseReportRow>[] = [
    {
      key: 'supplier',
      header: 'Supplier',
      sortable: true,
      sortValue: (r) => r.supplierName,
      cell: (r) => (
        <Link to={`/suppliers/${r.supplierId}`} className="font-medium text-ink-900 hover:text-brand-700">
          {r.supplierName}
        </Link>
      ),
    },
    { key: 'orders', header: 'Orders', align: 'right', sortable: true, sortValue: (r) => r.orders, cell: (r) => formatNumber(r.orders) },
    { key: 'received', header: 'Fully received', align: 'right', cell: (r) => formatNumber(r.received) },
    { key: 'value', header: 'Purchase value', align: 'right', sortable: true, sortValue: (r) => r.value, cell: (r) => <span className="font-semibold">{formatINR(r.value)}</span> },
    { key: 'gst', header: 'Input GST', align: 'right', cell: (r) => formatINR(r.gst) },
    { key: 'paid', header: 'Paid', align: 'right', cell: (r) => formatINR(r.paid) },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.outstanding,
      cell: (r) => <span className={cn('font-semibold', r.outstanding > 0 ? 'text-amber-700' : 'text-ink-400')}>{formatINR(r.outstanding)}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <KpiGrid>
        <StatCard label="Purchase orders" value={formatNumber(totals.orders)} icon={<ShoppingCart className="h-4 w-4" />} footer="Placed in this period" />
        <StatCard label="Goods received value" value={formatINR(totals.value)} icon={<IndianRupee className="h-4 w-4" />} tone="blue" />
        <StatCard label="Input GST" value={formatINR(totals.gst)} icon={<Landmark className="h-4 w-4" />} tone="ink" />
        <StatCard label="Outstanding to suppliers" value={formatINR(totals.outstanding)} icon={<Wallet className="h-4 w-4" />} tone="amber" footer={`${formatINR(totals.paid)} paid`} />
      </KpiGrid>

      <ReportCard title="Purchases by month" description="Value of goods received, by order month">
        <CardBody>
          {monthly.length ? <ColumnChart data={monthly} xKey="month" yKey="value" label="Purchase value" color={SERIES[1]} /> : <EmptyState title="No purchases in this period" compact />}
        </CardBody>
      </ReportCard>

      <ReportCard
        title="Supplier purchase report"
        actions={
          <ReportActions
            filename={`supplier-purchases-${range.from}-to-${range.to}`}
            rows={rows}
            columns={[
              { header: 'Supplier', value: (r) => r.supplierName },
              { header: 'Orders', value: (r) => r.orders },
              { header: 'Fully received', value: (r) => r.received },
              { header: 'Purchase value', value: (r) => r.value },
              { header: 'Input GST', value: (r) => r.gst },
              { header: 'Paid', value: (r) => r.paid },
              { header: 'Outstanding', value: (r) => r.outstanding },
            ]}
          />
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.supplierId}
          pageSize={0}
          caption="Supplier purchase report"
          empty={<EmptyState title="No purchase orders in this period" description="Purchase orders are reported by order date." compact />}
          footer={
            rows.length ? (
              <TotalsFooter
                columns={columns}
                values={{ orders: formatNumber(totals.orders), value: formatINR(totals.value), gst: formatINR(totals.gst), paid: formatINR(totals.paid), outstanding: formatINR(totals.outstanding) }}
              />
            ) : undefined
          }
        />
      </ReportCard>
    </div>
  )
}
