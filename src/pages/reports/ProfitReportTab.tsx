import { IndianRupee, Landmark, Percent, TrendingUp } from 'lucide-react'
import { CardBody, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { RankedBars, SERIES } from '../../components/charts/Charts'
import { useQuery } from '../../hooks/useQuery'
import { reportService } from '../../services'
import { formatINR, formatPct, round2, sumMoney } from '../../lib/money'
import type { DateRange } from '../../types/api'
import { KpiGrid, ReportActions, ReportCard, TotalsFooter } from './ReportParts'

interface CategoryRow {
  category: string
  revenue: number
  cost: number
  profit: number
  margin: number
  units: number
}

interface GstRow {
  rate: number
  taxable: number
  gst: number
}

export default function ProfitReportTab({ range }: { range: DateRange }) {
  const q = useQuery(
    async () => {
      const [sales, meds] = await Promise.all([reportService.sales(range, 'month'), reportService.medicineSales(range)])
      return { sales, meds }
    },
    [range.from, range.to],
    { tags: ['sales', 'reports'] },
  )
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />
  if (q.loading || !q.data) return <Skeleton className="h-96 rounded-2xl" />

  const t = q.data.sales.totals
  const margin = t.net > 0 ? (t.profit / t.net) * 100 : 0
  const byCat = new Map<string, CategoryRow>()
  for (const r of q.data.meds) {
    const c = byCat.get(r.category) ?? { category: r.category, revenue: 0, cost: 0, profit: 0, margin: 0, units: 0 }
    c.revenue += r.revenue
    c.cost += r.cost
    c.units += r.units
    byCat.set(r.category, c)
  }
  const categories = [...byCat.values()]
    .map((c) => ({ ...c, revenue: round2(c.revenue), cost: round2(c.cost), profit: round2(c.revenue - c.cost), margin: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit)
  const gst = q.data.sales.gstByRate

  const catCols: Column<CategoryRow>[] = [
    { key: 'category', header: 'Category', sortable: true, sortValue: (r) => r.category, cell: (r) => <span className="font-medium text-ink-900">{r.category}</span> },
    { key: 'revenue', header: 'Revenue', align: 'right', sortable: true, sortValue: (r) => r.revenue, cell: (r) => formatINR(r.revenue) },
    { key: 'cost', header: 'Cost', align: 'right', cell: (r) => formatINR(r.cost) },
    { key: 'profit', header: 'Profit', align: 'right', sortable: true, sortValue: (r) => r.profit, cell: (r) => <span className="font-semibold text-emerald-700">{formatINR(r.profit)}</span> },
    { key: 'margin', header: 'Margin', align: 'right', sortable: true, sortValue: (r) => r.margin, cell: (r) => formatPct(r.margin) },
  ]
  const gstCols: Column<GstRow>[] = [
    { key: 'rate', header: 'GST rate', cell: (r) => <span className="font-medium">{r.rate}%</span> },
    { key: 'taxable', header: 'Taxable value', align: 'right', cell: (r) => formatINR(r.taxable) },
    { key: 'cgst', header: 'CGST', align: 'right', cell: (r) => formatINR(r.gst / 2) },
    { key: 'sgst', header: 'SGST', align: 'right', cell: (r) => formatINR(r.gst / 2) },
    { key: 'gst', header: 'Total GST', align: 'right', cell: (r) => <span className="font-semibold">{formatINR(r.gst)}</span> },
  ]

  return (
    <div className="space-y-6">
      <KpiGrid>
        <StatCard label="Net revenue" value={formatINR(t.net)} icon={<IndianRupee className="h-4 w-4" />} footer={`${t.bills} bills`} />
        <StatCard label="Cost of goods" value={formatINR(t.cost)} icon={<Landmark className="h-4 w-4" />} tone="ink" />
        <StatCard label="Gross profit" value={formatINR(t.profit)} icon={<TrendingUp className="h-4 w-4" />} tone="violet" />
        <StatCard label="Gross margin" value={formatPct(margin)} icon={<Percent className="h-4 w-4" />} tone="blue" footer={`GST collected ${formatINR(t.gst)}`} />
      </KpiGrid>

      {categories.length === 0 ? (
        <ReportCard title="Profit by category">
          <EmptyState title="No sales in this period" description="Choose a different date range." />
        </ReportCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <ReportCard
            title="Profit by category"
            actions={
              <ReportActions
                filename={`profit-by-category-${range.from}-to-${range.to}`}
                rows={categories}
                columns={[
                  { header: 'Category', value: (r) => r.category },
                  { header: 'Revenue', value: (r) => r.revenue },
                  { header: 'Cost', value: (r) => r.cost },
                  { header: 'Profit', value: (r) => r.profit },
                  { header: 'Margin %', value: (r) => r.margin.toFixed(2) },
                ]}
              />
            }
          >
            <DataTable
              columns={catCols}
              rows={categories}
              rowKey={(r) => r.category}
              pageSize={0}
              dense
              caption="Profit by category"
              footer={
                <TotalsFooter
                  columns={catCols}
                  values={{
                    revenue: formatINR(sumMoney(categories.map((c) => c.revenue))),
                    cost: formatINR(sumMoney(categories.map((c) => c.cost))),
                    profit: formatINR(sumMoney(categories.map((c) => c.profit))),
                  }}
                />
              }
            />
          </ReportCard>
          <ReportCard title="Gross profit by category">
            <CardBody>
              <RankedBars color={SERIES[3]} items={categories.slice(0, 10).map((c) => ({ key: c.category, label: c.category, value: c.profit, sub: formatPct(c.margin) }))} />
            </CardBody>
          </ReportCard>
        </div>
      )}

      <ReportCard
        title="GST summary by rate"
        description="Output tax on sales (CGST/SGST split equally for intra-state supply)"
        actions={
          <ReportActions
            filename={`gst-summary-${range.from}-to-${range.to}`}
            rows={gst}
            columns={[
              { header: 'GST rate %', value: (r) => r.rate },
              { header: 'Taxable value', value: (r) => r.taxable },
              { header: 'CGST', value: (r) => round2(r.gst / 2) },
              { header: 'SGST', value: (r) => round2(r.gst / 2) },
              { header: 'Total GST', value: (r) => r.gst },
            ]}
          />
        }
      >
        <DataTable
          columns={gstCols}
          rows={gst}
          rowKey={(r) => String(r.rate)}
          pageSize={0}
          dense
          caption="GST summary"
          footer={gst.length ? <TotalsFooter columns={gstCols} values={{ taxable: formatINR(sumMoney(gst.map((g) => g.taxable))), gst: formatINR(sumMoney(gst.map((g) => g.gst))) }} /> : undefined}
        />
        <CardBody className="pt-4">
          <Alert tone="warning">Indicative figures for management review only. Tax treatment and returns filing must be verified by the store’s accountant.</Alert>
        </CardBody>
      </ReportCard>
    </div>
  )
}
